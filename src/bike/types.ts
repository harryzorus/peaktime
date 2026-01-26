/**
 * Cycling time estimation types
 *
 * Physics-based model using power output and resistance forces:
 * - Gravity (dominant on climbs)
 * - Rolling resistance (always present)
 * - Aerodynamic drag (dominant at high speeds)
 *
 * Fitness model based on FTP (Functional Threshold Power):
 * - FTP = max power sustainable for ~1 hour
 * - Expressed as absolute watts or watts per kilogram (W/kg)
 *
 * Reference data points (FTP as W/kg):
 * - Pro cyclists: 5.5-6.5 W/kg
 * - Elite amateurs: 4.5-5.5 W/kg
 * - Competitive: 3.5-4.5 W/kg
 * - Recreational: 2.5-3.5 W/kg
 * - Casual: 1.5-2.5 W/kg
 */

import type { GPXPoint } from "../gpx/types";

/** Parameters for cycling time estimation */
export interface CyclingParams {
	/** Rider FTP in watts */
	ftpWatts: number;
	/** Rider weight in kg (for climbing calculations) */
	riderWeightKg: number;
	/** Bike weight in kg (default: 9 for road bike) */
	bikeWeightKg: number;
	/** Coefficient of rolling resistance (default: 0.004 for road tires) */
	crr: number;
	/** Drag coefficient * frontal area in m^2 (default: 0.32 for hoods position) */
	cdA: number;
	/** Air density in kg/m^3 (default: 1.225 at sea level) */
	airDensity: number;
	/** Drivetrain efficiency (default: 0.97) */
	drivetrainEfficiency: number;
}

/** Bike types with default physics parameters */
export type BikeType = "road" | "gravel" | "mtb" | "tt" | "ebike";

/** Terrain types affecting rolling resistance */
export type BikeTerrain =
	| "smooth_pavement"
	| "rough_pavement"
	| "gravel"
	| "hardpack"
	| "singletrack"
	| "mud";

/**
 * Fitness level presets based on FTP as W/kg
 *
 * These correlate with real cycling data:
 * - Your Twin Peaks ride (202W on climbs @ 77.6kg = 2.6 W/kg) suggests "recreational" level
 */
export type BikeFitnessLevel =
	| "casual"
	| "recreational"
	| "trained"
	| "competitive"
	| "elite"
	| "pro";

/**
 * Fitness level descriptions with FTP benchmarks
 */
export interface BikeFitnessInfo {
	label: string;
	/** FTP range in W/kg */
	ftpRange: string;
	/** FTP midpoint in W/kg - used for calculations */
	ftpWkgMidpoint: number;
	description: string;
}

/**
 * Fitness levels for cycling time estimation
 *
 * Based on:
 * - Coggan power zones and FTP benchmarks
 * - TrainingPeaks/Strava power data analysis
 * - Professional cycling performance standards
 */
export const BIKE_FITNESS_LEVELS: Record<BikeFitnessLevel, BikeFitnessInfo> = {
	casual: {
		label: "Casual",
		ftpRange: "1.5-2.0 W/kg",
		ftpWkgMidpoint: 2.0,
		description: "Recreational riding, commuting",
	},
	recreational: {
		label: "Recreational",
		ftpRange: "2.0-2.75 W/kg",
		ftpWkgMidpoint: 2.5,
		description: "Regular riders, weekend warriors",
	},
	trained: {
		label: "Trained",
		ftpRange: "2.75-3.5 W/kg",
		ftpWkgMidpoint: 3.25,
		description: "Consistent training, local group rides",
	},
	competitive: {
		label: "Competitive",
		ftpRange: "3.5-4.25 W/kg",
		ftpWkgMidpoint: 3.85,
		description: "Racing, structured training",
	},
	elite: {
		label: "Elite",
		ftpRange: "4.25-5.0 W/kg",
		ftpWkgMidpoint: 4.5,
		description: "Cat 1-2 racers, domestic pros",
	},
	pro: {
		label: "Pro",
		ftpRange: "5.0+ W/kg",
		ftpWkgMidpoint: 5.5,
		description: "World Tour level",
	},
};

/**
 * Bike type defaults
 *
 * CdA values based on wind tunnel data:
 * - TT position: 0.22-0.25 m^2
 * - Drops: 0.28-0.32 m^2
 * - Hoods: 0.32-0.36 m^2
 * - Tops: 0.36-0.40 m^2
 * - MTB upright: 0.40-0.50 m^2
 *
 * Crr values (coefficient of rolling resistance):
 * - Road tires on smooth: 0.003-0.004
 * - Gravel tires: 0.005-0.006
 * - MTB tires: 0.008-0.012
 */
export interface BikeTypeInfo {
	label: string;
	/** Default bike weight in kg */
	bikeWeightKg: number;
	/** Default CdA in m^2 */
	cdA: number;
	/** Default Crr */
	crr: number;
	description: string;
}

export const BIKE_TYPES: Record<BikeType, BikeTypeInfo> = {
	road: {
		label: "Road Bike",
		bikeWeightKg: 8.5,
		cdA: 0.32,
		crr: 0.004,
		description: "Standard road bike, hoods position",
	},
	gravel: {
		label: "Gravel Bike",
		bikeWeightKg: 9.5,
		cdA: 0.34,
		crr: 0.006,
		description: "Gravel/adventure bike",
	},
	mtb: {
		label: "Mountain Bike",
		bikeWeightKg: 12,
		cdA: 0.45,
		crr: 0.01,
		description: "Mountain bike, upright position",
	},
	tt: {
		label: "Time Trial",
		bikeWeightKg: 9,
		cdA: 0.24,
		crr: 0.004,
		description: "TT/triathlon bike, aero position",
	},
	ebike: {
		label: "E-Bike",
		bikeWeightKg: 22,
		cdA: 0.4,
		crr: 0.005,
		description: "Electric-assist bike",
	},
};

/**
 * Terrain type multipliers for rolling resistance
 */
export interface BikeTerrainInfo {
	label: string;
	/** Multiplier for base Crr */
	crrMultiplier: number;
	description: string;
}

export const BIKE_TERRAIN_TYPES: Record<BikeTerrain, BikeTerrainInfo> = {
	smooth_pavement: {
		label: "Smooth Pavement",
		crrMultiplier: 1.0,
		description: "Fresh asphalt, velodrome",
	},
	rough_pavement: {
		label: "Rough Pavement",
		crrMultiplier: 1.3,
		description: "Cracked roads, chip seal",
	},
	gravel: {
		label: "Gravel",
		crrMultiplier: 1.5,
		description: "Packed gravel roads",
	},
	hardpack: {
		label: "Hardpack Dirt",
		crrMultiplier: 1.6,
		description: "Hard-packed fire roads",
	},
	singletrack: {
		label: "Singletrack",
		crrMultiplier: 2.0,
		description: "MTB singletrack trails",
	},
	mud: {
		label: "Mud/Soft",
		crrMultiplier: 3.0,
		description: "Wet, muddy conditions",
	},
};

/** Time estimate for a single segment */
export interface BikeSegmentTime {
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
	/** Power output for this segment in watts */
	powerWatts: number;
	/** Speed for this segment in km/h */
	speedKmh: number;
	/** Estimated time for this segment in minutes */
	time: number;
	/** Cumulative distance from start in meters */
	cumulativeDistance: number;
	/** Cumulative time from start in minutes */
	cumulativeTime: number;
	/** Point at end of segment */
	point: GPXPoint;
}

/** Complete cycling time estimate for a route */
export interface CyclingTimeEstimate {
	/** Total moving time in minutes */
	movingTime: number;
	/** Average power output in watts */
	averagePower: number;
	/** Normalized power in watts */
	normalizedPower: number;
	/** Average speed in km/h */
	averageSpeed: number;
	/** Parameters used for estimation */
	params: CyclingParams;
	/** Time breakdown by segment */
	segments: BikeSegmentTime[];
}

// Re-export sun target type from common
import type { SunTarget as _SunTarget } from "../common/types";

export type { SunTarget } from "../common/types";

// Local alias for use within this file
type SunTarget = _SunTarget;

/** Bike ride plan for catching a sun event */
export interface BikePlan {
	/** Target event to catch */
	target: SunTarget;
	/** Time of the target event */
	targetTime: Date;
	/** Buffer time to arrive before target in minutes */
	bufferMinutes: number;
	/** Recommended start time */
	startTime: Date;
	/** Estimated riding duration in minutes */
	ridingDuration: number;
	/** Whether this plan is feasible */
	feasible: boolean;
	/** If not feasible, how many minutes short we are */
	shortBy?: number;
}

/**
 * Get default cycling parameters for a fitness level and bike type
 */
export function getDefaultCyclingParams(
	fitness: BikeFitnessLevel,
	bikeType: BikeType,
	riderWeightKg: number,
): CyclingParams {
	const fitnessInfo = BIKE_FITNESS_LEVELS[fitness];
	const bikeInfo = BIKE_TYPES[bikeType];

	return {
		ftpWatts: fitnessInfo.ftpWkgMidpoint * riderWeightKg,
		riderWeightKg,
		bikeWeightKg: bikeInfo.bikeWeightKg,
		crr: bikeInfo.crr,
		cdA: bikeInfo.cdA,
		airDensity: 1.225,
		drivetrainEfficiency: 0.97,
	};
}
