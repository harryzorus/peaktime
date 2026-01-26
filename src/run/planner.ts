/**
 * Trail Run Planner
 *
 * Calculates optimal start times for catching sunrise, golden hour, or blue hour
 * at a destination on a trail running route.
 *
 * Delegates to the shared planner factory, adding run-specific wrappers
 * for backward compatibility (runningDuration field, formatPace, etc.)
 */

import type { GenericPlannerOptions } from "../common/planner-factory";
import { createPlanner } from "../common/planner-factory";
import type { ActivityPlan, PlanSummary as GenericPlanSummary } from "../common/types";
import type { GPXRoute } from "../gpx/types";
import type { Coordinates } from "../sun/types";
import { estimateRunningTime } from "./models";
import type { RunningParams, RunningTimeEstimate, RunPlan, SunTarget } from "./types";
import { getDefaultRunningParams } from "./types";

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
export interface RunPlannerOptions {
	/** Buffer time in minutes to arrive before target event (default: 10) */
	bufferMinutes?: number;
	/** Running parameters (uses defaults if not specified) */
	runningParams?: RunningParams;
	/** Night running speed multiplier (default: 0.8 = 20% slower) */
	nightRunningMultiplier?: number;
}

/** Complete plan summary with alternatives */
export interface RunPlanSummary {
	plan: RunPlan;
	alternatives: RunPlan[];
	estimate: RunningTimeEstimate;
	sunTimes: GenericPlanSummary<RunningTimeEstimate>["sunTimes"];
	coordinates: Coordinates;
}

/** Mode for planning - morning (sunrise) or evening (sunset) */
export type { PlanningMode } from "../common/types";

// Default running params factory
const defaultRunParams = () => getDefaultRunningParams("trained", "good_trail");

// Create the generic planner wired with running estimator
const runPlanner = createPlanner<RunningParams, RunningTimeEstimate>({
	estimate: (points, params) => estimateRunningTime(points, params),
	defaultParams: defaultRunParams,
	extractDuration: (est) => est.movingTime,
	defaultNightMultiplier: 0.8,
});

/** Convert run-specific options to generic planner options */
function toGenericOptions(options: RunPlannerOptions): GenericPlannerOptions<RunningParams> {
	return {
		bufferMinutes: options.bufferMinutes,
		params: options.runningParams,
		nightMultiplier: options.nightRunningMultiplier,
	};
}

/** Convert an ActivityPlan to a RunPlan (adds runningDuration alias) */
function toRunPlan(plan: ActivityPlan): RunPlan {
	return {
		target: plan.target,
		targetTime: plan.targetTime,
		bufferMinutes: plan.bufferMinutes,
		startTime: plan.startTime,
		runningDuration: plan.durationMinutes,
		feasible: plan.feasible,
		shortBy: plan.shortBy,
	};
}

/**
 * Calculate a run plan for a route
 */
export function planTrailRun(
	route: GPXRoute,
	date: Date,
	coordinates: Coordinates,
	target: SunTarget = "sunrise",
	options: RunPlannerOptions = {},
): RunPlan {
	return toRunPlan(runPlanner.plan(route, date, coordinates, target, toGenericOptions(options)));
}

/**
 * Plan for multiple targets to give user options
 */
export function planAllOptions(
	route: GPXRoute,
	date: Date,
	coordinates: Coordinates,
	mode: "sunrise" | "sunset" = "sunrise",
	options: RunPlannerOptions = {},
): RunPlan[] {
	return runPlanner
		.planAllOptions(route, date, coordinates, mode, toGenericOptions(options))
		.map(toRunPlan);
}

/**
 * Create a complete plan summary
 */
export function createRunPlanSummary(
	route: GPXRoute,
	date: Date,
	target: SunTarget = "sunrise",
	options: RunPlannerOptions = {},
): RunPlanSummary {
	const generic = runPlanner.createSummary(route, date, target, toGenericOptions(options));
	return {
		plan: toRunPlan(generic.plan),
		alternatives: generic.alternatives.map(toRunPlan),
		estimate: generic.estimate,
		sunTimes: generic.sunTimes,
		coordinates: generic.coordinates,
	};
}

/**
 * Format pace for display (e.g., "5:30/km")
 */
export function formatPace(paceMinPerKm: number): string {
	const minutes = Math.floor(paceMinPerKm);
	const seconds = Math.round((paceMinPerKm - minutes) * 60);
	return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}
