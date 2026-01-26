/**
 * Cycling time estimation and planning module
 *
 * Physics-based model using power output and resistance forces:
 * - FTP-based intensity modeling
 * - Grade-adaptive power output
 * - Cardano's formula for speed calculation
 *
 * With fitness levels based on FTP (W/kg) and bike type presets.
 */

// Models
export type { BikeRouteMetrics } from "./models";
export {
	calculateBikeRouteMetrics,
	estimateCyclingTime,
	intensityFromGrade,
	quickEstimate,
	segmentTime,
	speedFromPowerClimb,
	speedFromPowerFull,
} from "./models";
// Planner
export type { BikePlannerOptions, BikePlanSummary, PlanningMode } from "./planner";
export {
	createBikePlanSummary,
	findHighPointIndex,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
	isSunriseTarget,
	isSunsetTarget,
	planAllOptions,
	planBikeRide,
} from "./planner";
// Types
export type {
	BikeFitnessInfo,
	BikeFitnessLevel,
	BikePlan,
	BikeSegmentTime,
	BikeTerrain,
	BikeTerrainInfo,
	BikeType,
	BikeTypeInfo,
	CyclingParams,
	CyclingTimeEstimate,
	SunTarget,
} from "./types";
export {
	BIKE_FITNESS_LEVELS,
	BIKE_TERRAIN_TYPES,
	BIKE_TYPES,
	getDefaultCyclingParams,
} from "./types";
