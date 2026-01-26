/**
 * Common module — shared types, planner utilities, and factory
 *
 * Provides the building blocks used by hike, bike, and run modules:
 * - SunTarget types and predicates
 * - Route utility functions (findHighPointIndex, getRouteToIndex, etc.)
 * - Generic planner factory (createPlanner)
 * - Base route metrics
 */

// Planner utilities
export {
	findHighPointIndex,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
} from "./planner";
export type { GenericPlannerOptions, Planner, PlannerConfig } from "./planner-factory";
// Planner factory
export { createPlanner } from "./planner-factory";
// Route metrics
export type { BaseRouteMetrics } from "./route-metrics";
export { calculateBaseRouteMetrics } from "./route-metrics";
// Types
export type {
	ActivityPlan,
	PlanningMode,
	PlanSummary,
	SunriseTarget,
	SunsetTarget,
	SunTarget,
} from "./types";
export { isSunriseTarget, isSunsetTarget } from "./types";
