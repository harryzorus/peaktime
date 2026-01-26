/**
 * Generic planner factory
 *
 * Higher-order function that creates a complete planner for any activity type.
 * Each activity injects its estimator, default params, and night multiplier.
 */

import type { GPXPoint, GPXRoute } from "../gpx/types";
import { calculateSunTimes } from "../sun/sun-times";
import type { Coordinates } from "../sun/types";
import {
	findHighPointIndex,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetTime,
} from "./planner";
import type { ActivityPlan, PlanningMode, PlanSummary, SunTarget } from "./types";
import { isSunriseTarget } from "./types";

const DEFAULT_BUFFER_MINUTES = 10;

/** Configuration injected by each activity module */
export interface PlannerConfig<P, E> {
	/** Activity-specific estimator: given route points and params, produce an estimate */
	estimate: (points: GPXPoint[], params: P) => E;
	/** Factory for default activity params */
	defaultParams: () => P;
	/** Extract duration in minutes from an estimate */
	extractDuration: (estimate: E) => number;
	/** Night activity speed multiplier (hike=0.8, bike=0.7, run=0.8) */
	defaultNightMultiplier: number;
}

/** Options passed to generic plan() */
export interface GenericPlannerOptions<P> {
	/** Buffer time in minutes (default: 10) */
	bufferMinutes?: number;
	/** Activity-specific params (uses defaults if not provided) */
	params?: P;
	/** Whether to apply night speed adjustment for sunrise targets (default: true) */
	applyNightAdjustment?: boolean;
	/** Override the night multiplier */
	nightMultiplier?: number;
}

/** The returned planner object */
export interface Planner<P, E> {
	plan: (
		route: GPXRoute,
		date: Date,
		coordinates: Coordinates,
		target?: SunTarget,
		options?: GenericPlannerOptions<P>,
	) => ActivityPlan;
	planAllOptions: (
		route: GPXRoute,
		date: Date,
		coordinates: Coordinates,
		mode?: PlanningMode,
		options?: GenericPlannerOptions<P>,
	) => ActivityPlan[];
	createSummary: (
		route: GPXRoute,
		date: Date,
		target?: SunTarget,
		options?: GenericPlannerOptions<P>,
	) => PlanSummary<E>;
	getRouteEstimate: (route: GPXRoute, params?: P) => E;
}

/**
 * Create a planner for an activity type.
 *
 * Returns four pure functions that share the activity-specific estimator
 * and night multiplier via closure.
 */
export function createPlanner<P, E>(config: PlannerConfig<P, E>): Planner<P, E> {
	function plan(
		route: GPXRoute,
		date: Date,
		coordinates: Coordinates,
		target: SunTarget = "sunrise",
		options: GenericPlannerOptions<P> = {},
	): ActivityPlan {
		const {
			bufferMinutes = DEFAULT_BUFFER_MINUTES,
			params,
			applyNightAdjustment = true,
			nightMultiplier = config.defaultNightMultiplier,
		} = options;

		const resolvedParams = params ?? config.defaultParams();

		// Calculate sun times for the destination
		const sunTimes = calculateSunTimes(date, coordinates);
		const targetTime = getTargetTime(sunTimes, target);

		// Get route to high point only
		const highPointIndex = findHighPointIndex(route);
		const routeToHighPoint = getRouteToIndex(route, highPointIndex);

		// Estimate time
		const estimate = config.estimate(routeToHighPoint.points, resolvedParams);
		let durationMinutes = config.extractDuration(estimate);

		// Apply night adjustment for sunrise targets only
		if (isSunriseTarget(target) && applyNightAdjustment) {
			durationMinutes = durationMinutes / nightMultiplier;
		}

		// Calculate required start time
		const requiredArrivalTime = targetTime.getTime() - bufferMinutes * 60 * 1000;
		const startTime = new Date(requiredArrivalTime - durationMinutes * 60 * 1000);

		// Check feasibility
		let feasible: boolean;
		let shortBy: number | undefined;

		if (isSunriseTarget(target)) {
			const previousDayTenPM = new Date(date);
			previousDayTenPM.setHours(22, 0, 0, 0);
			previousDayTenPM.setDate(previousDayTenPM.getDate() - 1);

			feasible = startTime >= previousDayTenPM;
			shortBy = feasible
				? undefined
				: Math.round((previousDayTenPM.getTime() - startTime.getTime()) / (60 * 1000));
		} else {
			const sameDaySixAM = new Date(date);
			sameDaySixAM.setHours(6, 0, 0, 0);

			feasible = startTime >= sameDaySixAM;
			shortBy = feasible
				? undefined
				: Math.round((sameDaySixAM.getTime() - startTime.getTime()) / (60 * 1000));
		}

		return {
			target,
			targetTime,
			bufferMinutes,
			startTime,
			durationMinutes,
			feasible,
			shortBy,
		};
	}

	function planAllOptions(
		route: GPXRoute,
		date: Date,
		coordinates: Coordinates,
		mode: PlanningMode = "sunrise",
		options: GenericPlannerOptions<P> = {},
	): ActivityPlan[] {
		const targets: SunTarget[] =
			mode === "sunrise"
				? ["blueHourStart", "sunrise", "goldenHourEnd"]
				: ["goldenHourEveningStart", "sunset", "blueHourEveningEnd"];

		return targets.map((target) => plan(route, date, coordinates, target, options));
	}

	function createSummary(
		route: GPXRoute,
		date: Date,
		target: SunTarget = "sunrise",
		options: GenericPlannerOptions<P> = {},
	): PlanSummary<E> {
		const highPointIndex = findHighPointIndex(route);
		const routeToHighPoint = getRouteToIndex(route, highPointIndex);
		const coordinates = getDestinationCoordinates(route);

		const resolvedParams = options.params ?? config.defaultParams();
		const sunTimes = calculateSunTimes(date, coordinates);
		const estimate = config.estimate(routeToHighPoint.points, resolvedParams);
		const primaryPlan = plan(route, date, coordinates, target, options);

		// Get alternatives (same mode, excluding primary)
		const mode: PlanningMode = isSunriseTarget(target) ? "sunrise" : "sunset";
		const allTargets: SunTarget[] =
			mode === "sunrise"
				? ["blueHourStart", "sunrise", "goldenHourEnd"]
				: ["goldenHourEveningStart", "sunset", "blueHourEveningEnd"];

		const alternatives = allTargets
			.filter((t) => t !== target)
			.map((t) => plan(route, date, coordinates, t, options));

		return {
			plan: primaryPlan,
			alternatives,
			estimate,
			sunTimes,
			coordinates,
		};
	}

	function getRouteEstimate(route: GPXRoute, params?: P): E {
		const highPointIndex = findHighPointIndex(route);
		const routeToHighPoint = getRouteToIndex(route, highPointIndex);
		const resolvedParams = params ?? config.defaultParams();
		return config.estimate(routeToHighPoint.points, resolvedParams);
	}

	return { plan, planAllOptions, createSummary, getRouteEstimate };
}
