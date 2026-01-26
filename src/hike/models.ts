/**
 * Hiking Time Models
 *
 * Implements four established hiking time estimation models:
 * 1. Naismith's Rule (1892) - Simple, traditional
 * 2. Tobler's Hiking Function (1993) - Academic, slope-based
 * 3. Langmuir's Extension - Adds steep descent penalty
 * 4. Munter Method - Swiss Alpine Club standard
 *
 * Each model can be combined with fitness and terrain multipliers.
 */

import type { BaseRouteMetrics } from "../common/route-metrics";
import { haversineDistance } from "../gpx/route-stats";
import type { GPXPoint } from "../gpx/types";

/** Available hiking time models */
export type HikingModel = "naismith" | "tobler" | "langmuir" | "munter";

/** Fitness levels based on Vertical Ascent Rate (VAR) */
export type FitnessLevel = "leisurely" | "moderate" | "active" | "athletic" | "fast" | "elite";

/** Terrain types affecting pace */
export type TerrainType =
	| "paved"
	| "good_trail"
	| "rough_trail"
	| "scramble"
	| "off_trail"
	| "snow";

/**
 * Fitness level metadata based on Vertical Ascent Rate (VAR)
 *
 * VAR is the standard metric used by mountaineers to measure uphill pace.
 * It measures meters of elevation gain per hour, independent of horizontal distance.
 *
 * References:
 * - Scarf, P. (2007). "Route choice in mountain navigation" Journal of Navigation
 * - Tobler, W. (1993). "Non-isotropic geographic modeling"
 * - Swiss Alpine Club guidelines for tour planning
 * - Strava global hiking data analysis
 */
export interface FitnessInfo {
	label: string;
	/** Vertical Ascent Rate range description */
	varRange: string;
	/** VAR midpoint in m/hr - used for time calculations */
	varMidpoint: number;
	/** Multiplier relative to baseline (400 m/hr moderate pace) */
	multiplier: number;
	description: string;
}

/** Model metadata for UI display */
export interface ModelInfo {
	name: string;
	year: number;
	author: string;
	description: string;
}

/** Terrain type metadata */
export interface TerrainInfo {
	label: string;
	multiplier: number;
	description: string;
}

/**
 * Baseline speeds for the Munter method.
 *
 * The Munter method (Swiss Alpine Club, ~1980) is the gold standard for
 * alpine time estimation because it handles variable terrain grades well.
 *
 * References:
 * - Swiss Alpine Club tour planning guidelines
 * - Munter, W. (1985). Bergwandern, Bergsteigen. SAC Verlag.
 * - Scarf, P. (2007). "Route choice in mountain navigation" Journal of Navigation
 */
export const MUNTER_BASELINE = {
	/** Horizontal speed in km/h */
	horizontal: 4,
	/** Vertical ascent rate in m/hr */
	ascent: 400,
	/** Vertical descent rate in m/hr */
	descent: 800,
};

/**
 * Calculate fitness multiplier from Tranter's test time.
 *
 * Tranter's corrections (cited in Langmuir, 1984) use a standardized fitness test:
 * Time to climb 1000 feet (305m) over ½ mile (800m) of horizontal distance.
 *
 * This is a ~38% grade, which tests both aerobic capacity and hiking technique.
 *
 * Reference times and implied fitness levels:
 * - 15 min = Very fit (VAR ~1220 m/hr on steep terrain)
 * - 25 min = Average (VAR ~732 m/hr)
 * - 40 min = Unfit (VAR ~458 m/hr)
 *
 * @param tranterMinutes - Time in minutes to complete Tranter's test
 * @returns Multiplier relative to 25-minute baseline
 */
export function multiplierFromTranter(tranterMinutes: number): number {
	// 25 minutes is the "average" baseline
	return 25 / tranterMinutes;
}

/**
 * Fitness levels for hiking time estimation.
 *
 * These multipliers adjust the base Munter method times. The baseline (1.0)
 * represents a moderately fit recreational hiker - the "average" person who
 * would complete Tranter's test in about 25 minutes.
 *
 * The multipliers are derived from multiple sources:
 *
 * 1. **Tranter's Corrections** (Langmuir, 1984)
 *    - Fitness test: climb 305m over 800m horizontal
 *    - 15 min (very fit) to 50 min (unfit)
 *    - Widely used in UK mountain training
 *
 * 2. **Swiss Alpine Club Guidelines**
 *    - Standard planning uses 400 m/hr ascent rate
 *    - Fit parties may achieve 500-600 m/hr
 *    - Mountain guides routinely exceed 600 m/hr
 *
 * 3. **Vertical Kilometer (VK) Race Data**
 *    - Elite times: 1000m in ~30-35 min (1700-2000 m/hr!)
 *    - Recreational finishers: 1000m in 60-90 min (670-1000 m/hr)
 *
 * 4. **Strava Segment Analysis**
 *    - Global hiking data shows wide distribution
 *    - Median recreational pace ~350-450 m/hr VAR
 *
 * Note: These are for TIME estimation, not pace recommendations.
 * The multiplier divides the base time (faster = higher multiplier).
 */
export const FITNESS_LEVELS: Record<FitnessLevel, FitnessInfo> = {
	leisurely: {
		label: "Leisurely",
		varRange: "250-350 m/hr",
		varMidpoint: 300,
		multiplier: 0.75, // Tranter ~33 min
		description: "Casual pace, frequent stops, enjoying scenery",
	},
	moderate: {
		label: "Moderate",
		varRange: "350-450 m/hr",
		varMidpoint: 400,
		multiplier: 1.0, // Tranter 25 min (baseline)
		description: "Steady recreational pace, occasional breaks",
	},
	active: {
		label: "Active",
		varRange: "450-550 m/hr",
		varMidpoint: 500,
		multiplier: 1.25, // Tranter 20 min
		description: "Fit hikers, purposeful pace",
	},
	athletic: {
		label: "Athletic",
		varRange: "550-700 m/hr",
		varMidpoint: 625,
		multiplier: 1.56, // Tranter 16 min
		description: "Strong hikers, sustained fast pace",
	},
	fast: {
		label: "Fast",
		varRange: "700-900 m/hr",
		varMidpoint: 800,
		multiplier: 2.0, // Tranter 12.5 min
		description: "Trail runners, mountain guides",
	},
	elite: {
		label: "Elite",
		varRange: "900+ m/hr",
		varMidpoint: 1000,
		multiplier: 2.5, // Tranter 10 min
		description: "VK racers, ultra athletes",
	},
};

/**
 * Hiking model metadata for UI display
 */
export const HIKING_MODELS: Record<HikingModel, ModelInfo> = {
	naismith: {
		name: "Naismith's Rule",
		year: 1892,
		author: "William Naismith",
		description: "5 km/h + 1hr per 600m climb",
	},
	tobler: {
		name: "Tobler's Function",
		year: 1993,
		author: "Waldo Tobler",
		description: "Exponential model, peak speed at -5% grade",
	},
	langmuir: {
		name: "Langmuir's Extension",
		year: 1984,
		author: "Eric Langmuir",
		description: "Naismith + descent adjustments",
	},
	munter: {
		name: "Munter Method",
		year: 1980,
		author: "Swiss Alpine Club",
		description: "Max component + half of min",
	},
};

/**
 * Terrain multipliers (higher = slower)
 */
export const TERRAIN_TYPES: Record<TerrainType, TerrainInfo> = {
	paved: {
		label: "Paved/Gravel",
		multiplier: 0.9,
		description: "Road or smooth gravel",
	},
	good_trail: {
		label: "Good Trail",
		multiplier: 1.0,
		description: "Well-maintained hiking trail",
	},
	rough_trail: {
		label: "Rough Trail",
		multiplier: 1.25,
		description: "Rocky, roots, uneven",
	},
	scramble: {
		label: "Scramble",
		multiplier: 1.5,
		description: "Hands needed, talus, scree",
	},
	off_trail: {
		label: "Off-Trail",
		multiplier: 1.75,
		description: "Bushwhacking, no path",
	},
	snow: {
		label: "Snow",
		multiplier: 1.5,
		description: "Packed snow or postholing",
	},
};

/**
 * Naismith's Rule (1892)
 *
 * Classic Scottish mountaineering rule:
 * - 5 km/h on flat ground
 * - Add 1 hour per 600m of ascent
 * - Original rule ignores descent
 *
 * @param distance - Horizontal distance in meters
 * @param elevationGain - Total elevation gain in meters
 * @returns Time in minutes
 */
export function naismithTime(distance: number, elevationGain: number): number {
	const horizontalTime = (distance / 1000 / 5) * 60; // 5 km/h in minutes
	const verticalTime = (elevationGain / 600) * 60; // 1 hour per 600m
	return horizontalTime + verticalTime;
}

/**
 * Tobler's Hiking Function (1993)
 *
 * Speed varies with slope according to:
 * v = 6 * exp(-3.5 * |slope + 0.05|)
 *
 * Peak speed (~6 km/h) at -5% grade (slight downhill)
 * Speed decreases for both steep uphill and downhill
 *
 * @param p1 - Start point
 * @param p2 - End point
 * @returns Time in minutes for this segment
 */
export function toblerSegmentTime(p1: GPXPoint, p2: GPXPoint): number {
	const distance = haversineDistance(p1, p2);
	if (distance === 0) return 0;

	const slope = (p2.ele - p1.ele) / distance; // Rise over run
	const speed = 6 * Math.exp(-3.5 * Math.abs(slope + 0.05)); // km/h
	const time = (distance / 1000 / speed) * 60; // minutes

	return time;
}

/**
 * Calculate total time using Tobler's function for a route
 */
export function toblerTime(points: GPXPoint[]): number {
	let totalTime = 0;
	for (let i = 1; i < points.length; i++) {
		totalTime += toblerSegmentTime(points[i - 1], points[i]);
	}
	return totalTime;
}

/**
 * Langmuir's Extension
 *
 * Extends Naismith's rule with:
 * - Subtract 10 min per 300m descent on gentle slopes (5-12°)
 * - Add 10 min per 300m descent on steep slopes (>12°)
 *
 * @param distance - Horizontal distance in meters
 * @param elevationGain - Total ascent in meters
 * @param elevationLoss - Total descent in meters
 * @param avgDescentGrade - Average descent grade in degrees
 * @returns Time in minutes
 */
export function langmuirTime(
	distance: number,
	elevationGain: number,
	elevationLoss: number,
	avgDescentGrade: number = 10,
): number {
	// Start with Naismith base
	let time = naismithTime(distance, elevationGain);

	// Adjust for descent
	if (avgDescentGrade <= 5) {
		// Very gentle descent - no adjustment
	} else if (avgDescentGrade <= 12) {
		// Gentle descent - saves time
		time -= (elevationLoss / 300) * 10;
	} else {
		// Steep descent - adds time
		time += (elevationLoss / 300) * 10;
	}

	return Math.max(time, 0);
}

/**
 * Munter Method (Swiss Alpine Club)
 *
 * Simple and practical:
 * - Horizontal: 4 km/h (15 min per km)
 * - Vertical up: 400m/h (15 min per 100m)
 * - Vertical down: 800m/h (7.5 min per 100m)
 *
 * Take the LARGER of horizontal or vertical time,
 * then add HALF of the smaller.
 *
 * @param distance - Horizontal distance in meters
 * @param elevationGain - Total ascent in meters
 * @param elevationLoss - Total descent in meters
 * @returns Time in minutes
 */
export function munterTime(distance: number, elevationGain: number, elevationLoss: number): number {
	const horizontalTime = (distance / 1000 / 4) * 60; // 4 km/h
	const ascentTime = (elevationGain / 400) * 60; // 400m/h
	const descentTime = (elevationLoss / 800) * 60; // 800m/h

	// For ascent-dominant routes (hiking up)
	const upTime = Math.max(horizontalTime, ascentTime) + Math.min(horizontalTime, ascentTime) / 2;

	// For descent-dominant routes (hiking down)
	const downTime =
		Math.max(horizontalTime, descentTime) + Math.min(horizontalTime, descentTime) / 2;

	// If going up and down (like out-and-back to summit), we only care about the up portion
	// The caller should pass only the relevant segment
	if (elevationGain > elevationLoss) {
		return upTime;
	} else if (elevationLoss > elevationGain) {
		return downTime;
	}
	return horizontalTime; // Flat
}

/**
 * Calculate route statistics needed for models
 */
export interface RouteMetrics extends BaseRouteMetrics {
	avgDescentGrade: number; // Average descent grade in degrees
	points: GPXPoint[]; // For Tobler's point-by-point calculation
}

/**
 * Extract metrics from GPX points
 */
export function calculateRouteMetrics(points: GPXPoint[]): RouteMetrics {
	let distance = 0;
	let elevationGain = 0;
	let elevationLoss = 0;
	let descentDistance = 0;
	let descentDrop = 0;

	for (let i = 1; i < points.length; i++) {
		const d = haversineDistance(points[i - 1], points[i]);
		const elevChange = points[i].ele - points[i - 1].ele;

		distance += d;

		if (elevChange > 0) {
			elevationGain += elevChange;
		} else {
			elevationLoss += Math.abs(elevChange);
			descentDistance += d;
			descentDrop += Math.abs(elevChange);
		}
	}

	// Average descent grade in degrees
	const avgDescentGrade =
		descentDistance > 0 ? Math.atan(descentDrop / descentDistance) * (180 / Math.PI) : 0;

	return {
		distance,
		elevationGain,
		elevationLoss,
		avgDescentGrade,
		points,
	};
}

/**
 * Estimate hiking time using specified model
 *
 * @param metrics - Route metrics
 * @param model - Which model to use (default: munter)
 * @param fitness - Fitness level (default: moderate)
 * @param terrain - Terrain type (default: good_trail)
 * @returns Time in minutes
 */
export function estimateTime(
	metrics: RouteMetrics,
	model: HikingModel = "munter",
	fitness: FitnessLevel = "moderate",
	terrain: TerrainType = "good_trail",
): number {
	let baseTime: number;

	switch (model) {
		case "naismith":
			baseTime = naismithTime(metrics.distance, metrics.elevationGain);
			break;
		case "tobler":
			baseTime = toblerTime(metrics.points);
			break;
		case "langmuir":
			baseTime = langmuirTime(
				metrics.distance,
				metrics.elevationGain,
				metrics.elevationLoss,
				metrics.avgDescentGrade,
			);
			break;
		default:
			baseTime = munterTime(metrics.distance, metrics.elevationGain, metrics.elevationLoss);
			break;
	}

	// Apply fitness multiplier (higher = faster, so divide)
	const fitnessMultiplier = FITNESS_LEVELS[fitness].multiplier;
	const adjustedTime = baseTime / fitnessMultiplier;

	// Apply terrain multiplier (higher = slower, so multiply)
	const terrainMultiplier = TERRAIN_TYPES[terrain].multiplier;
	const finalTime = adjustedTime * terrainMultiplier;

	return finalTime;
}

/**
 * Compare all models for a route
 * Useful for debugging and understanding differences
 */
export function compareModels(
	metrics: RouteMetrics,
	fitness: FitnessLevel = "moderate",
	terrain: TerrainType = "good_trail",
): Record<HikingModel, number> {
	return {
		naismith: estimateTime(metrics, "naismith", fitness, terrain),
		tobler: estimateTime(metrics, "tobler", fitness, terrain),
		langmuir: estimateTime(metrics, "langmuir", fitness, terrain),
		munter: estimateTime(metrics, "munter", fitness, terrain),
	};
}
