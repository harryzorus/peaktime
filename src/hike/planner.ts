/**
 * Hike Planner
 *
 * Calculates optimal start times for catching sunrise, golden hour, or blue hour
 * at the summit of a hiking route.
 *
 * Delegates to the shared planner factory, adding hike-specific wrappers
 * for backward compatibility (hikingDuration field, nightHiking flag, etc.)
 */

import type { GenericPlannerOptions } from "../common/planner-factory";
import { createPlanner } from "../common/planner-factory";
import type { ActivityPlan, PlanSummary as GenericPlanSummary } from "../common/types";
import type { GPXRoute } from "../gpx/types";
import type { Coordinates } from "../sun/types";
import { estimateHikingTime } from "./time-estimator";
import type { HikePlan, HikingParams, HikingTimeEstimate, SunTarget } from "./types";

// Re-export shared utilities from common
// Also export getRouteCoordinates as before
export {
	findHighPointIndex as findSummitIndex,
	findHighPointIndex,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
} from "../common/planner";

/**
 * Get coordinates for a specific point index in the route
 */
export function getRouteCoordinates(route: GPXRoute, index: number): Coordinates {
	const point = route.points[index];
	return {
		latitude: point.lat,
		longitude: point.lon,
	};
}

/** Planning options */
export interface PlannerOptions {
	/** Buffer time in minutes to arrive before target event (default: 10) */
	bufferMinutes?: number;
	/** Hiking parameters (uses defaults if not specified) */
	hikingParams?: Partial<HikingParams>;
	/** Whether hiking will be in darkness (adjusts time estimate) */
	nightHiking?: boolean;
	/** Night hiking speed multiplier (default: 0.8 = 20% slower) */
	nightHikingMultiplier?: number;
}

/** Complete plan summary with alternatives */
export interface PlanSummary {
	/** The recommended plan */
	plan: HikePlan;
	/** Alternative plans for other targets */
	alternatives: HikePlan[];
	/** Route hiking time estimate */
	estimate: HikingTimeEstimate;
	/** Sun times at destination */
	sunTimes: GenericPlanSummary<HikingTimeEstimate>["sunTimes"];
	/** Destination coordinates */
	coordinates: Coordinates;
}

/** Mode for planning - morning (sunrise) or evening (sunset) */
export type { PlanningMode } from "../common/types";

// Create the generic planner wired with hiking estimator
const hikePlanner = createPlanner<Partial<HikingParams>, HikingTimeEstimate>({
	estimate: (points, params) =>
		estimateHikingTime({ metadata: { name: "", type: "hiking" }, points }, params),
	defaultParams: () => ({}),
	extractDuration: (est) => est.movingTime,
	defaultNightMultiplier: 0.8,
});

/** Convert hike-specific options to generic planner options */
function toGenericOptions(options: PlannerOptions): GenericPlannerOptions<Partial<HikingParams>> {
	return {
		bufferMinutes: options.bufferMinutes,
		params: options.hikingParams,
		applyNightAdjustment: options.nightHiking ?? true,
		nightMultiplier: options.nightHikingMultiplier,
	};
}

/** Convert an ActivityPlan to a HikePlan (adds hikingDuration alias) */
function toHikePlan(plan: ActivityPlan): HikePlan {
	return {
		target: plan.target,
		targetTime: plan.targetTime,
		bufferMinutes: plan.bufferMinutes,
		startTime: plan.startTime,
		hikingDuration: plan.durationMinutes,
		feasible: plan.feasible,
		shortBy: plan.shortBy,
	};
}

/**
 * Calculate a hike plan for a route
 */
export function planHike(
	route: GPXRoute,
	date: Date,
	coordinates: Coordinates,
	target: SunTarget = "sunrise",
	options: PlannerOptions = {},
): HikePlan {
	return toHikePlan(hikePlanner.plan(route, date, coordinates, target, toGenericOptions(options)));
}

/**
 * Plan for multiple targets to give user options
 */
export function planAllOptions(
	route: GPXRoute,
	date: Date,
	coordinates: Coordinates,
	mode: "sunrise" | "sunset" = "sunrise",
	options: PlannerOptions = {},
): HikePlan[] {
	return hikePlanner
		.planAllOptions(route, date, coordinates, mode, toGenericOptions(options))
		.map(toHikePlan);
}

/**
 * Get the hiking time estimate for a route
 */
export function getRouteEstimate(
	route: GPXRoute,
	options: PlannerOptions = {},
): HikingTimeEstimate {
	return hikePlanner.getRouteEstimate(route, options.hikingParams);
}

/**
 * Create a complete plan summary
 */
export function createPlanSummary(
	route: GPXRoute,
	date: Date,
	target: SunTarget = "sunrise",
	options: PlannerOptions = {},
): PlanSummary {
	const generic = hikePlanner.createSummary(route, date, target, toGenericOptions(options));
	return {
		plan: toHikePlan(generic.plan),
		alternatives: generic.alternatives.map(toHikePlan),
		estimate: generic.estimate,
		sunTimes: generic.sunTimes,
		coordinates: generic.coordinates,
	};
}
