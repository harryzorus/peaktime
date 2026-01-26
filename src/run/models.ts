/**
 * Trail Running Models - Grade Adjusted Pace (GAP)
 *
 * Implements the GAP model based on Strava Engineering research (2017):
 * https://medium.com/strava-engineering/improved-grade-adjusted-pace-a2f5ac10cdfa
 *
 * Key findings from the research:
 * 1. Running efficiency (heart rate per unit distance) varies with grade
 * 2. The relationship is asymmetric for uphill vs downhill
 * 3. Optimal efficiency is at ~-9% grade (slight downhill)
 * 4. Very steep downhills (< -18%) become as hard as running flat
 *
 * The model uses metabolic cost data from treadmill studies combined with
 * real-world Strava data to create a grade-to-pace multiplier curve.
 *
 * References:
 * - Minetti et al. (2002). "Energy cost of walking and running at extreme slopes"
 * - Strava Engineering (2017). "Improved Grade Adjusted Pace"
 * - Kram & Taylor (1990). "Energetics of running: a new perspective"
 */

import type { BaseRouteMetrics } from "../common/route-metrics";
import { haversineDistance } from "../gpx/route-stats";
import type { GPXPoint } from "../gpx/types";
import type {
	RunFitnessLevel,
	RunningParams,
	RunningTimeEstimate,
	RunSegmentTime,
	RunTerrain,
} from "./types";
import { getDefaultRunningParams, RUN_FITNESS_LEVELS, RUN_TERRAIN_TYPES } from "./types";

/**
 * Calculate GAP multiplier for a given grade
 *
 * This is the heart of the GAP model. The multiplier represents how much
 * harder (>1) or easier (<1) a grade is compared to flat running.
 *
 * The formula is a piecewise polynomial fit to metabolic cost data:
 *
 * Uphill (grade > 0):
 *   multiplier = 1 + 0.033 * grade + 0.0009 * grade^2
 *   (~3.3% slower per 1% grade, with slight acceleration for steep grades)
 *
 * Downhill (grade < 0):
 *   Optimal point is at -9% where multiplier reaches minimum of ~0.88
 *   Below -9%, efficiency decreases (braking forces, impact)
 *   At -18%, efficiency returns to 1.0 (as hard as flat)
 *   Below -18%, continues to increase (very hard on legs)
 *
 * @param gradePercent - Grade as percentage (positive = uphill)
 * @returns Multiplier for flat pace (>1 = slower, <1 = faster)
 */
export function gapMultiplier(gradePercent: number): number {
	if (gradePercent >= 0) {
		// Uphill: polynomial fit to metabolic cost data
		// ~3.3% slower per 1% grade, accelerating slightly for steep grades
		return 1 + 0.033 * gradePercent + 0.0009 * gradePercent * gradePercent;
	} else {
		// Downhill: more complex behavior
		const grade = gradePercent; // negative

		if (grade >= -9) {
			// Gentle downhill: efficiency improves
			// Minimum at -9% where multiplier ≈ 0.88
			// Using quadratic fit: 1 + a*x + b*x^2 where minimum is at x=-9
			// a = -0.027, b = 0.0015 gives minimum of ~0.88 at -9%
			return 1 + 0.027 * grade + 0.0015 * grade * grade;
		} else if (grade >= -18) {
			// Moderate downhill: efficiency decreasing
			// Linear interpolation from 0.88 at -9% to 1.0 at -18%
			const t = (grade + 9) / (-18 + 9); // 0 at -9%, 1 at -18%
			return 0.88 + t * (1.0 - 0.88);
		} else {
			// Very steep downhill: harder than flat
			// Continue increasing beyond 1.0
			// Use similar polynomial to uphill, reflected
			const absGrade = Math.abs(grade) - 18; // Grade beyond -18%
			return 1.0 + 0.02 * absGrade;
		}
	}
}

/**
 * Calculate actual pace for a given grade and flat pace
 *
 * @param flatPaceMinPerKm - Flat running pace in min/km
 * @param gradePercent - Grade as percentage
 * @param terrainMultiplier - Additional terrain factor (default: 1.0)
 * @returns Actual pace in min/km
 */
export function paceForGrade(
	flatPaceMinPerKm: number,
	gradePercent: number,
	terrainMultiplier: number = 1.0,
): number {
	const gap = gapMultiplier(gradePercent);
	return flatPaceMinPerKm * gap * terrainMultiplier;
}

/**
 * Calculate running time for a segment between two points
 *
 * @param p1 - Start point
 * @param p2 - End point
 * @param params - Running parameters
 * @returns Time in minutes
 */
export function segmentTime(p1: GPXPoint, p2: GPXPoint, params: RunningParams): number {
	const distance = haversineDistance(p1, p2);
	if (distance === 0) return 0;

	const elevChange = p2.ele - p1.ele;
	const gradePercent = (elevChange / distance) * 100;

	// Calculate pace including terrain
	const pace = paceForGrade(params.flatPaceMinPerKm, gradePercent, params.terrainMultiplier);

	// Time = pace (min/km) * distance (km)
	const timeMinutes = pace * (distance / 1000);

	return timeMinutes;
}

/**
 * Estimate running time for a complete route
 *
 * @param points - Array of GPX points
 * @param params - Running parameters
 * @returns Complete time estimate with segment breakdown
 */
export function estimateRunningTime(
	points: GPXPoint[],
	params: RunningParams,
): RunningTimeEstimate {
	const segments: RunSegmentTime[] = [];
	let totalTime = 0;
	let totalDistance = 0;
	let totalGapWeighted = 0; // For GAP pace calculation

	for (let i = 1; i < points.length; i++) {
		const p1 = points[i - 1];
		const p2 = points[i];
		const distance = haversineDistance(p1, p2);

		if (distance === 0) continue;

		const elevChange = p2.ele - p1.ele;
		const gradePercent = (elevChange / distance) * 100;

		const gap = gapMultiplier(gradePercent);
		const paceMinPerKm = paceForGrade(
			params.flatPaceMinPerKm,
			gradePercent,
			params.terrainMultiplier,
		);
		const timeMinutes = paceMinPerKm * (distance / 1000);

		totalDistance += distance;
		totalTime += timeMinutes;
		totalGapWeighted += params.flatPaceMinPerKm * gap * (distance / 1000);

		segments.push({
			fromIndex: i - 1,
			toIndex: i,
			distance,
			elevationChange: elevChange,
			gradePercent,
			gapMultiplier: gap,
			paceMinPerKm,
			time: timeMinutes,
			cumulativeDistance: totalDistance,
			cumulativeTime: totalTime,
			point: p2,
		});
	}

	// Calculate breaks
	let breakCount = 0;
	let breakTime = 0;
	if (params.breakIntervalMinutes > 0 && params.breakDurationMinutes > 0) {
		breakCount = Math.floor(totalTime / params.breakIntervalMinutes);
		breakTime = breakCount * params.breakDurationMinutes;
	}

	// Average pace = total time / total distance
	const averagePace = totalDistance > 0 ? totalTime / (totalDistance / 1000) : 0;
	// GAP pace = what this would be on flat ground
	const gapPace = totalDistance > 0 ? totalGapWeighted / (totalDistance / 1000) : 0;

	return {
		movingTime: totalTime,
		totalTime: totalTime + breakTime,
		breakCount,
		averagePace,
		gapPace,
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
 * @param terrain - Terrain type
 * @returns Estimated time in minutes
 */
export function quickEstimate(
	distance: number,
	elevationGain: number,
	elevationLoss: number,
	fitness: RunFitnessLevel = "trained",
	terrain: RunTerrain = "good_trail",
): number {
	const params = getDefaultRunningParams(fitness, terrain);

	// Estimate time for climbing sections
	// Assume climbing is proportional to elevation
	const totalElevation = elevationGain + elevationLoss;
	const climbRatio = totalElevation > 0 ? elevationGain / totalElevation : 0.5;
	const descentRatio = 1 - climbRatio;

	// Average grades (assuming even distribution)
	const avgClimbGrade = distance > 0 ? (elevationGain / (distance * climbRatio)) * 100 : 5;
	const avgDescentGrade = distance > 0 ? -(elevationLoss / (distance * descentRatio)) * 100 : -5;

	// Calculate time for each section
	const climbDistance = distance * climbRatio;
	const descentDistance = distance * descentRatio;

	const climbPace = paceForGrade(params.flatPaceMinPerKm, avgClimbGrade, params.terrainMultiplier);
	const descentPace = paceForGrade(
		params.flatPaceMinPerKm,
		avgDescentGrade,
		params.terrainMultiplier,
	);

	const climbTime = climbPace * (climbDistance / 1000);
	const descentTime = descentPace * (descentDistance / 1000);

	return climbTime + descentTime;
}

/**
 * Convert GAP pace to equivalent flat distance
 *
 * Useful for comparing hilly runs to flat runs.
 * "This 10km run with 500m climb is equivalent to 12km flat"
 *
 * @param actualDistance - Actual distance run in meters
 * @param movingTime - Actual moving time in minutes
 * @param flatPace - Flat running pace in min/km
 * @returns Equivalent flat distance in meters
 */
export function equivalentFlatDistance(
	_actualDistance: number,
	movingTime: number,
	flatPace: number,
): number {
	// Time = flatPace * equivalentDistance
	// equivalentDistance = time / flatPace
	// Note: actualDistance is provided for API consistency but not used in calculation
	return (movingTime / flatPace) * 1000;
}

/**
 * Calculate route metrics from GPX points
 */
export interface RunRouteMetrics extends BaseRouteMetrics {
	avgGrade: number;
	maxGrade: number;
	avgGapMultiplier: number;
	points: GPXPoint[];
}

export function calculateRunRouteMetrics(points: GPXPoint[]): RunRouteMetrics {
	let distance = 0;
	let elevationGain = 0;
	let elevationLoss = 0;
	let maxGrade = 0;
	let gapSum = 0;
	let _segmentCount = 0;

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
			const gradePercent = (Math.abs(elevChange) / d) * 100;
			maxGrade = Math.max(maxGrade, gradePercent);

			const actualGrade = (elevChange / d) * 100;
			gapSum += gapMultiplier(actualGrade) * d;
			_segmentCount++;
		}
	}

	const avgGrade = distance > 0 ? ((elevationGain + elevationLoss) / 2 / distance) * 100 : 0;
	const avgGapMultiplier = distance > 0 ? gapSum / distance : 1;

	return {
		distance,
		elevationGain,
		elevationLoss,
		avgGrade,
		maxGrade,
		avgGapMultiplier,
		points,
	};
}

// Re-export types and constants for convenience
export { RUN_FITNESS_LEVELS, RUN_TERRAIN_TYPES };
export type { RunFitnessLevel, RunTerrain };
