/**
 * Common types shared across all activity modules (hike, bike, run)
 */

import type { Coordinates, SunTimes } from "../sun/types";

/** Target event for sunrise planning */
export type SunriseTarget =
	| "sunrise"
	| "goldenHourStart"
	| "goldenHourEnd"
	| "blueHourStart"
	| "blueHourEnd";

/** Target event for sunset planning */
export type SunsetTarget =
	| "sunset"
	| "goldenHourEveningStart"
	| "goldenHourEveningEnd"
	| "blueHourEveningStart"
	| "blueHourEveningEnd";

/** Unified target for both sunrise and sunset planning */
export type SunTarget = SunriseTarget | SunsetTarget;

/** Whether a target is a sunrise (morning) event */
export function isSunriseTarget(target: SunTarget): target is SunriseTarget {
	return ["sunrise", "goldenHourStart", "goldenHourEnd", "blueHourStart", "blueHourEnd"].includes(
		target,
	);
}

/** Whether a target is a sunset (evening) event */
export function isSunsetTarget(target: SunTarget): target is SunsetTarget {
	return [
		"sunset",
		"goldenHourEveningStart",
		"goldenHourEveningEnd",
		"blueHourEveningStart",
		"blueHourEveningEnd",
	].includes(target);
}

/** Mode for planning - morning (sunrise) or evening (sunset) */
export type PlanningMode = "sunrise" | "sunset";

/** Activity plan with canonical duration field */
export interface ActivityPlan {
	/** Target event to catch */
	target: SunTarget;
	/** Time of the target event */
	targetTime: Date;
	/** Buffer time to arrive before target in minutes */
	bufferMinutes: number;
	/** Recommended start time */
	startTime: Date;
	/** Estimated activity duration in minutes */
	durationMinutes: number;
	/** Whether this plan is feasible (enough time) */
	feasible: boolean;
	/** If not feasible, how many minutes short we are */
	shortBy?: number;
}

/** Generic plan summary parameterized by estimate type */
export interface PlanSummary<E> {
	/** The recommended plan */
	plan: ActivityPlan;
	/** Alternative plans for other targets */
	alternatives: ActivityPlan[];
	/** Route time estimate */
	estimate: E;
	/** Sun times at destination */
	sunTimes: SunTimes;
	/** Destination coordinates */
	coordinates: Coordinates;
}
