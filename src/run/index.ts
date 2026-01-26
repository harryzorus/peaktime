/**
 * Trail Running time estimation and planning module
 *
 * Based on Grade Adjusted Pace (GAP) model:
 * - Asymmetric uphill/downhill efficiency
 * - Optimal speed at ~-9% grade
 * - Terrain multipliers for trail conditions
 *
 * With fitness levels based on flat pace (min/km).
 */

// Models
export type { RunRouteMetrics } from "./models";
export {
	calculateRunRouteMetrics,
	equivalentFlatDistance,
	estimateRunningTime,
	gapMultiplier,
	paceForGrade,
	quickEstimate,
	segmentTime,
} from "./models";
// Planner
export type { PlanningMode, RunPlannerOptions, RunPlanSummary } from "./planner";
export {
	createRunPlanSummary,
	findHighPointIndex,
	formatPace,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
	isSunriseTarget,
	isSunsetTarget,
	planAllOptions,
	planTrailRun,
} from "./planner";
// Types
export type {
	RunFitnessInfo,
	RunFitnessLevel,
	RunningParams,
	RunningTimeEstimate,
	RunPlan,
	RunSegmentTime,
	RunTerrain,
	RunTerrainInfo,
	SunTarget,
} from "./types";
export { getDefaultRunningParams, RUN_FITNESS_LEVELS, RUN_TERRAIN_TYPES } from "./types";
