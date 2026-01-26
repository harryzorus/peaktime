/**
 * Cycling Physics Models
 *
 * Calculates cycling speed from power output using physics-based models.
 * The fundamental equation balances power against resistance forces:
 *
 * P = (F_gravity + F_rolling + F_drag) × V
 *
 * Where:
 * - F_gravity = m × g × sin(θ) (weight component along slope)
 * - F_rolling = Crr × m × g × cos(θ) (rolling resistance)
 * - F_drag = 0.5 × ρ × CdA × V² (aerodynamic drag)
 *
 * On flat/rolling terrain, this is a cubic equation in V (solved with Cardano's formula).
 * On steep climbs (>6%), aero is negligible and we use the simplified formula.
 *
 * References:
 * - Martin et al. (1998). "Validation of a Mathematical Model for Road Cycling Power"
 * - Coggan, A. "Training and Racing with a Power Meter"
 * - Wilson, D.G. "Bicycling Science"
 */

import type { BaseRouteMetrics } from "../common/route-metrics";
import { haversineDistance } from "../gpx/route-stats";
import type { GPXPoint } from "../gpx/types";
import type {
	BikeFitnessLevel,
	BikeSegmentTime,
	BikeTerrain,
	BikeType,
	CyclingParams,
	CyclingTimeEstimate,
} from "./types";
import {
	BIKE_FITNESS_LEVELS,
	BIKE_TERRAIN_TYPES,
	BIKE_TYPES,
	getDefaultCyclingParams,
} from "./types";

/** Gravitational acceleration in m/s² */
const GRAVITY = 9.81;

/** Minimum speed in m/s (to avoid division by zero) */
const MIN_SPEED_MS = 0.5; // ~1.8 km/h

/** Maximum speed in m/s (sanity check) */
const MAX_SPEED_MS = 30; // ~108 km/h

/**
 * Calculate intensity (fraction of FTP) based on grade
 *
 * Cyclists naturally modulate effort based on terrain:
 * - Descents: coast/recover (0.2-0.4 FTP)
 * - Flat: steady endurance (0.65-0.75 FTP)
 * - Gentle climbs: tempo (0.75-0.85 FTP)
 * - Moderate climbs: threshold (0.85-0.95 FTP)
 * - Steep climbs: cap at threshold (0.95 FTP)
 *
 * @param gradePercent - Grade as percentage (positive = uphill)
 * @returns Intensity as fraction of FTP (0-1)
 */
export function intensityFromGrade(gradePercent: number): number {
	if (gradePercent <= -10) return 0.2; // Steep descent: coast
	if (gradePercent <= -5) return 0.3; // Moderate descent: light pedaling
	if (gradePercent <= 0) return 0.65 + (gradePercent + 5) * 0.02; // -5 to 0: 0.65-0.75
	if (gradePercent <= 4) return 0.75 + gradePercent * 0.025; // 0-4%: 0.75-0.85
	if (gradePercent <= 8) return 0.85 + (gradePercent - 4) * 0.025; // 4-8%: 0.85-0.95
	return 0.95; // 8%+: cap at threshold
}

/**
 * Calculate speed from power using simplified gravity-only model
 *
 * Used for steep climbs (>6%) where aero drag is negligible.
 * P = (m × g × sin(θ) + Crr × m × g × cos(θ)) × V
 * V = P / (m × g × (sin(θ) + Crr × cos(θ)))
 *
 * @param powerWatts - Power at the wheel (after drivetrain losses)
 * @param totalMassKg - Combined rider + bike mass
 * @param gradeDecimal - Grade as decimal (0.08 = 8%)
 * @param crr - Coefficient of rolling resistance
 * @returns Speed in m/s
 */
export function speedFromPowerClimb(
	powerWatts: number,
	totalMassKg: number,
	gradeDecimal: number,
	crr: number,
): number {
	// For very steep grades, sin(θ) ≈ tan(θ) = grade
	// cos(θ) ≈ 1 for grades up to ~15%
	const sinTheta = gradeDecimal / Math.sqrt(1 + gradeDecimal * gradeDecimal);
	const cosTheta = 1 / Math.sqrt(1 + gradeDecimal * gradeDecimal);

	const gravityForce = totalMassKg * GRAVITY * sinTheta;
	const rollingForce = crr * totalMassKg * GRAVITY * cosTheta;
	const totalResistance = gravityForce + rollingForce;

	if (totalResistance <= 0) {
		// Downhill - use full physics model
		return MAX_SPEED_MS;
	}

	const speed = powerWatts / totalResistance;
	return Math.max(MIN_SPEED_MS, Math.min(MAX_SPEED_MS, speed));
}

/**
 * Calculate speed from power using Cardano's formula for cubic equation
 *
 * The full physics equation:
 * P = (F_grav + F_roll + F_drag) × V
 * P = (mg×sin(θ) + Crr×mg×cos(θ)) × V + 0.5×ρ×CdA×V³
 *
 * Rearranging: 0.5×ρ×CdA×V³ + (mg×sin(θ) + Crr×mg×cos(θ))×V - P = 0
 *
 * This is a depressed cubic: aV³ + bV - c = 0
 * Solved using Cardano's formula.
 *
 * @param powerWatts - Power at the wheel (after drivetrain losses)
 * @param params - Full cycling parameters
 * @param gradeDecimal - Grade as decimal
 * @returns Speed in m/s
 */
export function speedFromPowerFull(
	powerWatts: number,
	params: CyclingParams,
	gradeDecimal: number,
): number {
	const totalMass = params.riderWeightKg + params.bikeWeightKg;

	// For steep climbs, use simplified model (aero negligible)
	if (Math.abs(gradeDecimal) > 0.06) {
		return speedFromPowerClimb(powerWatts, totalMass, gradeDecimal, params.crr);
	}

	// Calculate force coefficients
	const sinTheta = gradeDecimal / Math.sqrt(1 + gradeDecimal * gradeDecimal);
	const cosTheta = 1 / Math.sqrt(1 + gradeDecimal * gradeDecimal);

	const gravityForce = totalMass * GRAVITY * sinTheta;
	const rollingForce = params.crr * totalMass * GRAVITY * cosTheta;
	const linearCoeff = gravityForce + rollingForce; // b in cubic
	const dragCoeff = 0.5 * params.airDensity * params.cdA; // a in cubic

	// For descents where gravity > rolling, rider may coast
	if (linearCoeff < 0 && powerWatts < 10) {
		// Terminal velocity when drag = gravity - rolling
		// 0.5×ρ×CdA×V² = |linearCoeff|
		const terminalVelocity = Math.sqrt(Math.abs(linearCoeff) / dragCoeff);
		return Math.min(terminalVelocity, MAX_SPEED_MS);
	}

	// Solve cubic: dragCoeff×V³ + linearCoeff×V - power = 0
	// Using Cardano's formula for depressed cubic: t³ + pt + q = 0
	// where p = linearCoeff/dragCoeff, q = -power/dragCoeff

	const p = linearCoeff / dragCoeff;
	const q = -powerWatts / dragCoeff;

	// Discriminant: (q/2)² + (p/3)³
	const discriminant = (q / 2) ** 2 + (p / 3) ** 3;

	let speed: number;

	if (discriminant >= 0) {
		// One real root
		const sqrtD = Math.sqrt(discriminant);
		const u = Math.cbrt(-q / 2 + sqrtD);
		const v = Math.cbrt(-q / 2 - sqrtD);
		speed = u + v;
	} else {
		// Three real roots - use the positive one
		const r = Math.sqrt((-p / 3) ** 3);
		const theta = Math.acos(-q / (2 * r));
		// The three roots are 2×cbrt(r)×cos((θ + 2πk)/3) for k=0,1,2
		// We want the positive one
		const cbrtR = Math.cbrt(r);
		speed = 2 * cbrtR * Math.cos(theta / 3);
	}

	return Math.max(MIN_SPEED_MS, Math.min(MAX_SPEED_MS, speed));
}

/**
 * Calculate cycling time for a segment between two points
 *
 * @param p1 - Start point
 * @param p2 - End point
 * @param params - Cycling parameters
 * @returns Time in minutes
 */
export function segmentTime(p1: GPXPoint, p2: GPXPoint, params: CyclingParams): number {
	const distance = haversineDistance(p1, p2);
	if (distance === 0) return 0;

	const elevChange = p2.ele - p1.ele;
	const gradeDecimal = elevChange / distance;
	const gradePercent = gradeDecimal * 100;

	// Calculate power based on grade-adaptive intensity
	const intensity = intensityFromGrade(gradePercent);
	const powerAtWheel = params.ftpWatts * intensity * params.drivetrainEfficiency;

	// Calculate speed
	const speedMs = speedFromPowerFull(powerAtWheel, params, gradeDecimal);
	const speedKmh = speedMs * 3.6;

	// Time in minutes
	const timeMinutes = (distance / 1000 / speedKmh) * 60;

	return timeMinutes;
}

/**
 * Estimate cycling time for a complete route
 *
 * @param points - Array of GPX points
 * @param params - Cycling parameters
 * @returns Complete time estimate with segment breakdown
 */
export function estimateCyclingTime(
	points: GPXPoint[],
	params: CyclingParams,
): CyclingTimeEstimate {
	const segments: BikeSegmentTime[] = [];
	let totalTime = 0;
	let totalDistance = 0;
	let totalPowerTime = 0; // For weighted average power
	let powerSumFourth = 0; // For normalized power (rolling 30s average ^ 4)

	for (let i = 1; i < points.length; i++) {
		const p1 = points[i - 1];
		const p2 = points[i];
		const distance = haversineDistance(p1, p2);

		if (distance === 0) continue;

		const elevChange = p2.ele - p1.ele;
		const gradeDecimal = elevChange / distance;
		const gradePercent = gradeDecimal * 100;

		const intensity = intensityFromGrade(gradePercent);
		const powerWatts = params.ftpWatts * intensity;
		const powerAtWheel = powerWatts * params.drivetrainEfficiency;

		const speedMs = speedFromPowerFull(powerAtWheel, params, gradeDecimal);
		const speedKmh = speedMs * 3.6;
		const timeMinutes = (distance / 1000 / speedKmh) * 60;

		totalDistance += distance;
		totalTime += timeMinutes;
		totalPowerTime += powerWatts * timeMinutes;
		powerSumFourth += powerWatts ** 4 * timeMinutes;

		segments.push({
			fromIndex: i - 1,
			toIndex: i,
			distance,
			elevationChange: elevChange,
			gradePercent,
			powerWatts,
			speedKmh,
			time: timeMinutes,
			cumulativeDistance: totalDistance,
			cumulativeTime: totalTime,
			point: p2,
		});
	}

	const averagePower = totalTime > 0 ? totalPowerTime / totalTime : 0;
	const normalizedPower = totalTime > 0 ? (powerSumFourth / totalTime) ** 0.25 : 0;
	const averageSpeed = totalTime > 0 ? totalDistance / 1000 / (totalTime / 60) : 0;

	return {
		movingTime: totalTime,
		averagePower,
		normalizedPower,
		averageSpeed,
		params,
		segments,
	};
}

/**
 * Quick time estimate using route totals (less accurate than segment-by-segment)
 *
 * @param distance - Total distance in meters
 * @param elevationGain - Total elevation gain in meters
 * @param elevationLoss - Total elevation loss in meters
 * @param fitness - Fitness level
 * @param bikeType - Bike type
 * @param terrain - Terrain type
 * @param riderWeightKg - Rider weight in kg
 * @returns Estimated time in minutes
 */
export function quickEstimate(
	distance: number,
	elevationGain: number,
	elevationLoss: number,
	fitness: BikeFitnessLevel = "recreational",
	bikeType: BikeType = "road",
	terrain: BikeTerrain = "smooth_pavement",
	riderWeightKg: number = 75,
): number {
	const params = getDefaultCyclingParams(fitness, bikeType, riderWeightKg);
	const terrainInfo = BIKE_TERRAIN_TYPES[terrain];
	params.crr *= terrainInfo.crrMultiplier;

	// Estimate average grade for climbing sections
	// Assume climbing is 1/3 of route, descent is 1/3, flat is 1/3
	const climbDistance = distance * (elevationGain / (elevationGain + elevationLoss + 1));
	const descentDistance = distance * (elevationLoss / (elevationGain + elevationLoss + 1));
	const flatDistance = distance - climbDistance - descentDistance;

	// Average climb grade
	const avgClimbGrade = climbDistance > 0 ? elevationGain / climbDistance : 0;
	// Average descent grade (negative)
	const avgDescentGrade = descentDistance > 0 ? -elevationLoss / descentDistance : 0;

	// Calculate time for each section
	// Climbing time
	const climbIntensity = intensityFromGrade(avgClimbGrade * 100);
	const climbPower = params.ftpWatts * climbIntensity * params.drivetrainEfficiency;
	const climbSpeed = speedFromPowerFull(climbPower, params, avgClimbGrade);
	const climbTime = climbDistance > 0 ? climbDistance / climbSpeed / 60 : 0;

	// Descent time
	const descentIntensity = intensityFromGrade(avgDescentGrade * 100);
	const descentPower = params.ftpWatts * descentIntensity * params.drivetrainEfficiency;
	const descentSpeed = speedFromPowerFull(descentPower, params, avgDescentGrade);
	const descentTime = descentDistance > 0 ? descentDistance / descentSpeed / 60 : 0;

	// Flat time
	const flatIntensity = intensityFromGrade(0);
	const flatPower = params.ftpWatts * flatIntensity * params.drivetrainEfficiency;
	const flatSpeed = speedFromPowerFull(flatPower, params, 0);
	const flatTime = flatDistance > 0 ? flatDistance / flatSpeed / 60 : 0;

	return climbTime + descentTime + flatTime;
}

/**
 * Calculate route metrics from GPX points (same as hike module)
 */
export interface BikeRouteMetrics extends BaseRouteMetrics {
	avgGrade: number;
	maxGrade: number;
	points: GPXPoint[];
}

export function calculateBikeRouteMetrics(points: GPXPoint[]): BikeRouteMetrics {
	let distance = 0;
	let elevationGain = 0;
	let elevationLoss = 0;
	let maxGrade = 0;

	for (let i = 1; i < points.length; i++) {
		const d = haversineDistance(points[i - 1], points[i]);
		const elevChange = points[i].ele - points[i - 1].ele;

		distance += d;

		if (elevChange > 0) {
			elevationGain += elevChange;
		} else {
			elevationLoss += Math.abs(elevChange);
		}

		if (d > 0) {
			const grade = Math.abs(elevChange / d) * 100;
			maxGrade = Math.max(maxGrade, grade);
		}
	}

	const avgGrade = distance > 0 ? ((elevationGain + elevationLoss) / 2 / distance) * 100 : 0;

	return {
		distance,
		elevationGain,
		elevationLoss,
		avgGrade,
		maxGrade,
		points,
	};
}

// Re-export types and constants for convenience
export { BIKE_FITNESS_LEVELS, BIKE_TYPES, BIKE_TERRAIN_TYPES };
export type { BikeFitnessLevel, BikeType, BikeTerrain };
