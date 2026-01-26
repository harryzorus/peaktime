/**
 * Common planner utilities shared across all activity modules
 *
 * Pure functions for sun target resolution, route slicing, and formatting.
 */

import type { GPXRoute } from "../gpx/types";
import type { Coordinates, SunTimes } from "../sun/types";
import type { SunTarget } from "./types";

/**
 * Get the target time based on sun target type
 */
export function getTargetTime(sunTimes: SunTimes, target: SunTarget): Date {
	switch (target) {
		// Morning targets
		case "sunrise":
		case "goldenHourStart":
			return sunTimes.sunrise;
		case "goldenHourEnd":
			return sunTimes.goldenHourMorningEnd;
		case "blueHourStart":
			return sunTimes.civilTwilightStart;
		case "blueHourEnd":
			return sunTimes.blueHourMorningEnd;
		// Evening targets
		case "sunset":
		case "goldenHourEveningEnd":
			return sunTimes.sunset;
		case "goldenHourEveningStart":
			return sunTimes.goldenHourEveningStart;
		case "blueHourEveningStart":
			return sunTimes.blueHourEveningStart;
		case "blueHourEveningEnd":
			return sunTimes.civilTwilightEnd;
	}
}

/**
 * Get a human-readable description of the target
 */
export function getTargetDescription(target: SunTarget): string {
	switch (target) {
		case "sunrise":
			return "Sunrise";
		case "goldenHourStart":
			return "Golden Hour Start";
		case "goldenHourEnd":
			return "Golden Hour End";
		case "blueHourStart":
			return "Blue Hour Start (First Light)";
		case "blueHourEnd":
			return "Blue Hour End";
		case "sunset":
			return "Sunset";
		case "goldenHourEveningStart":
			return "Golden Hour Start";
		case "goldenHourEveningEnd":
			return "Golden Hour End";
		case "blueHourEveningStart":
			return "Blue Hour Start";
		case "blueHourEveningEnd":
			return "Blue Hour End (Last Light)";
	}
}

/**
 * Find the highest elevation point in a route
 * @returns Index of the highest point
 */
export function findHighPointIndex(route: GPXRoute): number {
	if (route.points.length === 0) {
		throw new Error("Cannot find high point in empty route");
	}

	let maxEle = -Infinity;
	let maxIndex = 0;

	for (let i = 0; i < route.points.length; i++) {
		if (route.points[i].ele > maxEle) {
			maxEle = route.points[i].ele;
			maxIndex = i;
		}
	}

	return maxIndex;
}

/**
 * Extract a sub-route from start to a specific index (inclusive)
 */
export function getRouteToIndex(route: GPXRoute, endIndex: number): GPXRoute {
	return {
		metadata: route.metadata,
		points: route.points.slice(0, endIndex + 1),
	};
}

/**
 * Get the destination coordinates from a route (highest elevation point)
 * @throws Error if route has no points
 */
export function getDestinationCoordinates(route: GPXRoute): Coordinates {
	if (route.points.length === 0) {
		throw new Error("Cannot get destination from empty route");
	}
	const highPointIndex = findHighPointIndex(route);
	const point = route.points[highPointIndex];
	return {
		latitude: point.lat,
		longitude: point.lon,
	};
}

/**
 * Format a start time for display
 */
export function formatStartTime(date: Date, timezone: string = "UTC"): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone,
	});
}
