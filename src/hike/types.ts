/**
 * Hiking time estimation types
 *
 * Fitness model based on research:
 * - VO2max correlates with sustainable hiking pace
 * - 10K run time is a good proxy for aerobic fitness
 * - Uphill pace degrades more for less fit individuals
 *
 * Reference data points:
 * - Elite trail runners: 10-12 km/h flat, 800-1000m/hr vertical
 * - Fit hikers (VO2max 50+): 6-7 km/h flat, 500-600m/hr vertical
 * - Average hikers (VO2max 35-45): 4-5 km/h flat, 300-400m/hr vertical
 * - Casual/beginner: 3-4 km/h flat, 200-300m/hr vertical
 */

import type { GPXPoint } from "../gpx/types";

/** Parameters for hiking time estimation */
export interface HikingParams {
	/** Base walking speed on flat terrain in km/h */
	baseSpeedKmh: number;
	/** Additional time penalty per 100m of elevation gain in minutes */
	uphillPenaltyMinPer100m: number;
	/** Time saved per 100m of elevation loss in minutes */
	downhillBonusMinPer100m: number;
	/** Add rest breaks every N minutes of hiking (0 = no breaks) */
	breakIntervalMinutes: number;
	/** Duration of each break in minutes */
	breakDurationMinutes: number;
}

/**
 * Fitness level presets based on 10K run times
 *
 * 10K time -> Approximate VO2max -> Hiking parameters
 *
 * These correlate with real hiking data:
 * - Your Mt Tam group (56 min actual) suggests "athletic" level
 */
export type FitnessLevel = "leisurely" | "moderate" | "active" | "athletic" | "fast" | "elite";

/**
 * Fitness level descriptions with 10K benchmarks
 * Helps users self-identify their level
 */
export const FITNESS_DESCRIPTIONS: Record<
	FitnessLevel,
	{ label: string; tenKTime: string; description: string }
> = {
	leisurely: {
		label: "Leisurely",
		tenKTime: "70+ min",
		description: "Casual pace, frequent stops to enjoy views",
	},
	moderate: {
		label: "Moderate",
		tenKTime: "55-70 min",
		description: "Steady pace, occasional breaks",
	},
	active: {
		label: "Active",
		tenKTime: "45-55 min",
		description: "Brisk pace, minimal breaks",
	},
	athletic: {
		label: "Athletic",
		tenKTime: "38-45 min",
		description: "Fast sustained pace",
	},
	fast: {
		label: "Fast",
		tenKTime: "32-38 min",
		description: "Trail running pace",
	},
	elite: {
		label: "Elite",
		tenKTime: "Under 32 min",
		description: "Competitive trail runner",
	},
};

/**
 * Hiking parameters by fitness level
 *
 * Derived from:
 * - Naismith's rule as baseline (modified)
 * - Tobler's hiking function for grade adjustments
 * - Real-world trail data
 */
export const PARAMS_BY_FITNESS: Record<FitnessLevel, HikingParams> = {
	leisurely: {
		baseSpeedKmh: 3.5,
		uphillPenaltyMinPer100m: 15, // ~240m/hr vertical
		downhillBonusMinPer100m: 2,
		breakIntervalMinutes: 45,
		breakDurationMinutes: 10,
	},
	moderate: {
		baseSpeedKmh: 4.5,
		uphillPenaltyMinPer100m: 12, // ~300m/hr vertical
		downhillBonusMinPer100m: 3,
		breakIntervalMinutes: 60,
		breakDurationMinutes: 5,
	},
	active: {
		baseSpeedKmh: 5.5,
		uphillPenaltyMinPer100m: 9, // ~400m/hr vertical
		downhillBonusMinPer100m: 3,
		breakIntervalMinutes: 90,
		breakDurationMinutes: 5,
	},
	athletic: {
		baseSpeedKmh: 6.5,
		uphillPenaltyMinPer100m: 7, // ~500m/hr vertical
		downhillBonusMinPer100m: 2,
		breakIntervalMinutes: 0, // No scheduled breaks
		breakDurationMinutes: 0,
	},
	fast: {
		baseSpeedKmh: 8.0,
		uphillPenaltyMinPer100m: 5, // ~700m/hr vertical (trail running)
		downhillBonusMinPer100m: 1,
		breakIntervalMinutes: 0,
		breakDurationMinutes: 0,
	},
	elite: {
		baseSpeedKmh: 10.0,
		uphillPenaltyMinPer100m: 4, // ~900m/hr vertical (VK racing)
		downhillBonusMinPer100m: 0.5,
		breakIntervalMinutes: 0,
		breakDurationMinutes: 0,
	},
};

/** Default hiking parameters (moderate fitness) */
export const DEFAULT_HIKING_PARAMS: HikingParams = PARAMS_BY_FITNESS.moderate;

/** Faster hiking parameters (athletic fitness) */
export const FAST_HIKING_PARAMS: HikingParams = PARAMS_BY_FITNESS.athletic;

/** Slower hiking parameters (leisurely pace) */
export const SLOW_HIKING_PARAMS: HikingParams = PARAMS_BY_FITNESS.leisurely;

/**
 * Get hiking parameters for a fitness level
 */
export function getParamsForFitness(level: FitnessLevel): HikingParams {
	return PARAMS_BY_FITNESS[level];
}

/** Time estimate for a single segment between two points */
export interface SegmentTime {
	/** Starting point index */
	fromIndex: number;
	/** Ending point index */
	toIndex: number;
	/** Distance of this segment in meters */
	distance: number;
	/** Elevation change in meters (positive = up, negative = down) */
	elevationChange: number;
	/** Estimated time for this segment in minutes */
	time: number;
	/** Cumulative distance from start in meters */
	cumulativeDistance: number;
	/** Cumulative time from start in minutes */
	cumulativeTime: number;
	/** Point at end of segment */
	point: GPXPoint;
}

/** Complete hiking time estimate for a route */
export interface HikingTimeEstimate {
	/** Total moving time in minutes (no breaks) */
	movingTime: number;
	/** Total time including breaks in minutes */
	totalTime: number;
	/** Number of breaks included */
	breakCount: number;
	/** Parameters used for estimation */
	params: HikingParams;
	/** Time breakdown by segment (useful for waypoint times) */
	segments: SegmentTime[];
}

// Re-export sun target types and predicates from common
import type { SunTarget as _SunTarget } from "../common/types";

export type { SunriseTarget, SunsetTarget, SunTarget } from "../common/types";
export { isSunriseTarget, isSunsetTarget } from "../common/types";

// Local alias for use within this file
type SunTarget = _SunTarget;

/** Hike plan for catching a sun event */
export interface HikePlan {
	/** Target event to catch */
	target: SunTarget;
	/** Time of the target event */
	targetTime: Date;
	/** Buffer time to arrive before target in minutes */
	bufferMinutes: number;
	/** Recommended start time */
	startTime: Date;
	/** Estimated hiking duration in minutes */
	hikingDuration: number;
	/** Whether this plan is feasible (enough time to hike) */
	feasible: boolean;
	/** If not feasible, how many minutes short we are */
	shortBy?: number;
}
