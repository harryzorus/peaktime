/**
 * Bike Planner
 *
 * Calculates optimal start times for catching sunrise, golden hour, or blue hour
 * at a destination on a cycling route.
 *
 * Delegates to the shared planner factory, adding bike-specific wrappers
 * for backward compatibility (ridingDuration field, etc.)
 */

import type { GenericPlannerOptions } from "../common/planner-factory";
import { createPlanner } from "../common/planner-factory";
import type { ActivityPlan, PlanSummary as GenericPlanSummary } from "../common/types";
import type { GPXRoute } from "../gpx/types";
import type { Coordinates } from "../sun/types";
import { estimateCyclingTime } from "./models";
import type { BikePlan, CyclingParams, CyclingTimeEstimate, SunTarget } from "./types";
import { getDefaultCyclingParams } from "./types";

// Re-export shared utilities from common
export {
	findHighPointIndex,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
} from "../common/planner";

export { isSunriseTarget, isSunsetTarget } from "../common/types";

/** Planning options */
export interface BikePlannerOptions {
	/** Buffer time in minutes to arrive before target event (default: 10) */
	bufferMinutes?: number;
	/** Cycling parameters (uses defaults if not specified) */
	cyclingParams?: CyclingParams;
	/** Night riding speed multiplier (default: 0.7 = 30% slower) */
	nightRidingMultiplier?: number;
}

/** Complete plan summary with alternatives */
export interface BikePlanSummary {
	plan: BikePlan;
	alternatives: BikePlan[];
	estimate: CyclingTimeEstimate;
	sunTimes: GenericPlanSummary<CyclingTimeEstimate>["sunTimes"];
	coordinates: Coordinates;
}

/** Mode for planning - morning (sunrise) or evening (sunset) */
export type { PlanningMode } from "../common/types";

// Default cycling params factory
const defaultBikeParams = () => getDefaultCyclingParams("recreational", "road", 75);

// Create the generic planner wired with cycling estimator
const bikePlanner = createPlanner<CyclingParams, CyclingTimeEstimate>({
	estimate: (points, params) => estimateCyclingTime(points, params),
	defaultParams: defaultBikeParams,
	extractDuration: (est) => est.movingTime,
	defaultNightMultiplier: 0.7,
});

/** Convert bike-specific options to generic planner options */
function toGenericOptions(options: BikePlannerOptions): GenericPlannerOptions<CyclingParams> {
	return {
		bufferMinutes: options.bufferMinutes,
		params: options.cyclingParams,
		nightMultiplier: options.nightRidingMultiplier,
	};
}

/** Convert an ActivityPlan to a BikePlan (adds ridingDuration alias) */
function toBikePlan(plan: ActivityPlan): BikePlan {
	return {
		target: plan.target,
		targetTime: plan.targetTime,
		bufferMinutes: plan.bufferMinutes,
		startTime: plan.startTime,
		ridingDuration: plan.durationMinutes,
		feasible: plan.feasible,
		shortBy: plan.shortBy,
	};
}

/**
 * Calculate a bike plan for a route
 */
export function planBikeRide(
	route: GPXRoute,
	date: Date,
	coordinates: Coordinates,
	target: SunTarget = "sunrise",
	options: BikePlannerOptions = {},
): BikePlan {
	return toBikePlan(bikePlanner.plan(route, date, coordinates, target, toGenericOptions(options)));
}

/**
 * Plan for multiple targets to give user options
 */
export function planAllOptions(
	route: GPXRoute,
	date: Date,
	coordinates: Coordinates,
	mode: "sunrise" | "sunset" = "sunrise",
	options: BikePlannerOptions = {},
): BikePlan[] {
	return bikePlanner
		.planAllOptions(route, date, coordinates, mode, toGenericOptions(options))
		.map(toBikePlan);
}

/**
 * Create a complete plan summary
 */
export function createBikePlanSummary(
	route: GPXRoute,
	date: Date,
	target: SunTarget = "sunrise",
	options: BikePlannerOptions = {},
): BikePlanSummary {
	const generic = bikePlanner.createSummary(route, date, target, toGenericOptions(options));
	return {
		plan: toBikePlan(generic.plan),
		alternatives: generic.alternatives.map(toBikePlan),
		estimate: generic.estimate,
		sunTimes: generic.sunTimes,
		coordinates: generic.coordinates,
	};
}
