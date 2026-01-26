/**
 * Hiking time estimation and planning module
 *
 * Supports multiple hiking time models:
 * - Naismith's Rule (1892)
 * - Tobler's Hiking Function (1993)
 * - Langmuir's Extension
 * - Munter Method (Swiss Alpine Club) - default
 *
 * With fitness levels based on 10K run times and terrain multipliers.
 */

// New models-based API
export type {
	FitnessInfo,
	FitnessLevel,
	HikingModel,
	ModelInfo,
	RouteMetrics,
	TerrainInfo,
	TerrainType,
} from "./models";
export {
	calculateRouteMetrics,
	compareModels,
	estimateTime,
	FITNESS_LEVELS,
	HIKING_MODELS,
	langmuirTime,
	MUNTER_BASELINE,
	multiplierFromTranter,
	munterTime,
	naismithTime,
	TERRAIN_TYPES,
	toblerTime,
} from "./models";
export type { PlannerOptions, PlanningMode, PlanSummary } from "./planner";
export {
	createPlanSummary,
	findSummitIndex,
	formatStartTime,
	getDestinationCoordinates,
	getRouteCoordinates,
	getRouteEstimate,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
	planAllOptions,
	planHike,
} from "./planner";
export {
	estimateHikingTime,
	formatHikingTime,
	segmentTime,
	timeToDistance,
	timeToElevation,
	waypointAtPercentage,
} from "./time-estimator";
export type {
	HikePlan,
	HikingParams,
	HikingTimeEstimate,
	SegmentTime,
	SunriseTarget,
	SunsetTarget,
	SunTarget,
} from "./types";
export {
	DEFAULT_HIKING_PARAMS,
	FAST_HIKING_PARAMS,
	isSunriseTarget,
	isSunsetTarget,
	SLOW_HIKING_PARAMS,
} from "./types";
