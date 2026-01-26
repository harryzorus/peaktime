/**
 * Trail Running time estimation types
 *
 * Based on Grade Adjusted Pace (GAP) model from Strava research:
 * - Running efficiency varies non-linearly with grade
 * - Uphill: ~6% slower per 1% grade
 * - Downhill: faster up to ~-9% grade, then slower
 *
 * Reference data points:
 * - Elite trail runners: 3:00-3:30/km flat
 * - Competitive runners: 4:00-4:30/km flat
 * - Trained runners: 4:30-5:30/km flat
 * - Recreational runners: 5:30-6:30/km flat
 * - Beginner/casual: 7:00+/km flat
 */

import type { GPXPoint } from "../gpx/types";

/** Parameters for running time estimation */
export interface RunningParams {
	/** Flat pace in min/km */
	flatPaceMinPerKm: number;
	/** Terrain multiplier (1.0 for road, higher for trails) */
	terrainMultiplier: number;
	/** Add rest breaks every N minutes (0 = no breaks) */
	breakIntervalMinutes: number;
	/** Duration of each break in minutes */
	breakDurationMinutes: number;
}

/** Terrain types affecting pace */
export type RunTerrain = "road" | "track" | "good_trail" | "technical_trail" | "alpine" | "sand";

/**
 * Fitness level presets based on flat pace
 *
 * Your running data:
 * - Half marathon: 4:40/km (race effort)
 * - Easy runs: 5:40/km
 * - This suggests "trained" level
 */
export type RunFitnessLevel =
	| "beginner"
	| "recreational"
	| "trained"
	| "competitive"
	| "elite"
	| "ultra";

/**
 * Fitness level descriptions with pace benchmarks
 */
export interface RunFitnessInfo {
	label: string;
	/** Flat pace range in min/km */
	paceRange: string;
	/** Pace midpoint in min/km - used for calculations */
	paceMidpoint: number;
	/** 5K time range (approx) */
	fiveKRange: string;
	description: string;
}

/**
 * Fitness levels for running time estimation
 *
 * Based on:
 * - Strava global running data
 * - Race result distributions
 * - Trail running community benchmarks
 */
export const RUN_FITNESS_LEVELS: Record<RunFitnessLevel, RunFitnessInfo> = {
	beginner: {
		label: "Beginner",
		paceRange: "7:00-8:00/km",
		paceMidpoint: 7.5,
		fiveKRange: "35-40 min",
		description: "New to running, building base fitness",
	},
	recreational: {
		label: "Recreational",
		paceRange: "5:45-7:00/km",
		paceMidpoint: 6.25,
		fiveKRange: "29-35 min",
		description: "Regular runners, social pace",
	},
	trained: {
		label: "Trained",
		paceRange: "4:30-5:45/km",
		paceMidpoint: 5.0,
		fiveKRange: "22-29 min",
		description: "Structured training, regular racing",
	},
	competitive: {
		label: "Competitive",
		paceRange: "3:45-4:30/km",
		paceMidpoint: 4.25,
		fiveKRange: "19-22 min",
		description: "Serious racers, high volume training",
	},
	elite: {
		label: "Elite",
		paceRange: "3:15-3:45/km",
		paceMidpoint: 3.75,
		fiveKRange: "16-19 min",
		description: "Top amateur/semi-pro level",
	},
	ultra: {
		label: "Ultra",
		paceRange: "5:00-6:00/km",
		paceMidpoint: 5.5,
		fiveKRange: "25-30 min",
		description: "Optimized for long distances, not speed",
	},
};

/**
 * Terrain type multipliers
 *
 * Based on trail running research and race time comparisons:
 * - Road marathon vs trail marathon times
 * - Strava segment analysis
 * - iRunFar race analysis
 */
export interface RunTerrainInfo {
	label: string;
	/** Multiplier for flat pace */
	multiplier: number;
	description: string;
}

export const RUN_TERRAIN_TYPES: Record<RunTerrain, RunTerrainInfo> = {
	track: {
		label: "Track",
		multiplier: 0.95,
		description: "Synthetic track surface",
	},
	road: {
		label: "Road",
		multiplier: 1.0,
		description: "Paved roads and sidewalks",
	},
	good_trail: {
		label: "Good Trail",
		multiplier: 1.1,
		description: "Well-maintained fire roads, smooth trails",
	},
	technical_trail: {
		label: "Technical Trail",
		multiplier: 1.25,
		description: "Rocky, roots, uneven terrain",
	},
	alpine: {
		label: "Alpine",
		multiplier: 1.4,
		description: "High altitude, scree, snow patches",
	},
	sand: {
		label: "Sand",
		multiplier: 1.5,
		description: "Beach, loose sand",
	},
};

/** Time estimate for a single segment */
export interface RunSegmentTime {
	/** Starting point index */
	fromIndex: number;
	/** Ending point index */
	toIndex: number;
	/** Distance of this segment in meters */
	distance: number;
	/** Elevation change in meters */
	elevationChange: number;
	/** Grade as percentage */
	gradePercent: number;
	/** GAP multiplier applied to this segment */
	gapMultiplier: number;
	/** Actual pace for this segment in min/km */
	paceMinPerKm: number;
	/** Estimated time for this segment in minutes */
	time: number;
	/** Cumulative distance from start in meters */
	cumulativeDistance: number;
	/** Cumulative time from start in minutes */
	cumulativeTime: number;
	/** Point at end of segment */
	point: GPXPoint;
}

/** Complete running time estimate for a route */
export interface RunningTimeEstimate {
	/** Total moving time in minutes (no breaks) */
	movingTime: number;
	/** Total time including breaks in minutes */
	totalTime: number;
	/** Number of breaks included */
	breakCount: number;
	/** Average pace in min/km */
	averagePace: number;
	/** Grade Adjusted Pace (GAP) in min/km */
	gapPace: number;
	/** Parameters used for estimation */
	params: RunningParams;
	/** Time breakdown by segment */
	segments: RunSegmentTime[];
}

// Re-export sun target type from common
import type { SunTarget as _SunTarget } from "../common/types";

export type { SunTarget } from "../common/types";

// Local alias for use within this file
type SunTarget = _SunTarget;

/** Trail run plan for catching a sun event */
export interface RunPlan {
	/** Target event to catch */
	target: SunTarget;
	/** Time of the target event */
	targetTime: Date;
	/** Buffer time to arrive before target in minutes */
	bufferMinutes: number;
	/** Recommended start time */
	startTime: Date;
	/** Estimated running duration in minutes */
	runningDuration: number;
	/** Whether this plan is feasible */
	feasible: boolean;
	/** If not feasible, how many minutes short we are */
	shortBy?: number;
}

/**
 * Get default running parameters for a fitness level and terrain
 */
export function getDefaultRunningParams(
	fitness: RunFitnessLevel,
	terrain: RunTerrain,
): RunningParams {
	const fitnessInfo = RUN_FITNESS_LEVELS[fitness];
	const terrainInfo = RUN_TERRAIN_TYPES[terrain];

	// For ultra-distance runners, add breaks
	const isUltra = fitness === "ultra";

	return {
		flatPaceMinPerKm: fitnessInfo.paceMidpoint,
		terrainMultiplier: terrainInfo.multiplier,
		breakIntervalMinutes: isUltra ? 60 : 0,
		breakDurationMinutes: isUltra ? 5 : 0,
	};
}
