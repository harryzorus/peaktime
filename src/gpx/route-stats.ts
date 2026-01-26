/**
 * Route Statistics
 *
 * Calculate distance, elevation gain/loss, and other statistics from GPX routes.
 */

import type { GPXPoint, GPXRoute, RouteStats } from "./types";

/** Earth's radius in meters */
const EARTH_RADIUS = 6371000;

/** Meters per foot for unit conversion */
const METERS_PER_FOOT = 0.3048;

/** Meters per mile for unit conversion */
const METERS_PER_MILE = 1609.344;

/**
 * Calculate the haversine distance between two points (ignoring elevation)
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in meters
 */
export function haversineDistance(p1: GPXPoint, p2: GPXPoint): number {
	const lat1 = (p1.lat * Math.PI) / 180;
	const lat2 = (p2.lat * Math.PI) / 180;
	const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
	const deltaLon = ((p2.lon - p1.lon) * Math.PI) / 180;

	const a =
		Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return EARTH_RADIUS * c;
}

/**
 * Calculate 3D distance between two points (including elevation)
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in meters
 */
export function distance3D(p1: GPXPoint, p2: GPXPoint): number {
	const horizontal = haversineDistance(p1, p2);
	const vertical = Math.abs(p2.ele - p1.ele);
	return Math.sqrt(horizontal * horizontal + vertical * vertical);
}

/**
 * Calculate grade (slope) between two points as a percentage
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Grade as percentage (positive = uphill, negative = downhill)
 */
export function calculateGrade(p1: GPXPoint, p2: GPXPoint): number {
	const horizontal = haversineDistance(p1, p2);
	if (horizontal === 0) return 0;

	const vertical = p2.ele - p1.ele;
	return (vertical / horizontal) * 100;
}

/**
 * Smooth elevation data using a simple moving average
 * This helps reduce GPS noise in elevation readings
 *
 * @param points - Track points
 * @param windowSize - Number of points to average (default 5)
 * @returns Smoothed elevation values
 */
export function smoothElevation(points: GPXPoint[], windowSize: number = 5): number[] {
	const elevations = points.map((p) => p.ele);
	const smoothed: number[] = [];

	const halfWindow = Math.floor(windowSize / 2);

	for (let i = 0; i < elevations.length; i++) {
		let sum = 0;
		let count = 0;

		for (let j = i - halfWindow; j <= i + halfWindow; j++) {
			if (j >= 0 && j < elevations.length) {
				sum += elevations[j];
				count++;
			}
		}

		smoothed.push(sum / count);
	}

	return smoothed;
}

/**
 * Calculate comprehensive statistics for a GPX route
 *
 * @param route - The GPX route
 * @param options - Optional settings
 * @returns Route statistics
 */
export function calculateRouteStats(
	route: GPXRoute,
	options: { smoothElevation?: boolean; smoothWindow?: number } = {},
): RouteStats {
	const { points } = route;
	const { smoothElevation: doSmooth = true, smoothWindow = 5 } = options;

	if (points.length === 0) {
		throw new Error("Cannot calculate stats for empty route");
	}

	// Get smoothed elevations if requested
	const elevations = doSmooth ? smoothElevation(points, smoothWindow) : points.map((p) => p.ele);

	let totalDistance = 0;
	let totalElevationGain = 0;
	let totalElevationLoss = 0;

	let minLat = Infinity;
	let maxLat = -Infinity;
	let minLon = Infinity;
	let maxLon = -Infinity;

	for (let i = 0; i < points.length; i++) {
		const point = points[i];

		// Update bounds
		minLat = Math.min(minLat, point.lat);
		maxLat = Math.max(maxLat, point.lat);
		minLon = Math.min(minLon, point.lon);
		maxLon = Math.max(maxLon, point.lon);

		// Calculate distance and elevation change
		if (i > 0) {
			const prev = points[i - 1];
			totalDistance += haversineDistance(prev, point);

			const elevChange = elevations[i] - elevations[i - 1];
			if (elevChange > 0) {
				totalElevationGain += elevChange;
			} else {
				totalElevationLoss += Math.abs(elevChange);
			}
		}
	}

	const rawElevations = points.map((p) => p.ele);

	return {
		totalDistance,
		totalElevationGain,
		totalElevationLoss,
		maxElevation: Math.max(...rawElevations),
		minElevation: Math.min(...rawElevations),
		startPoint: points[0],
		endPoint: points[points.length - 1],
		bounds: { minLat, maxLat, minLon, maxLon },
		pointCount: points.length,
	};
}

/**
 * Format distance for display
 *
 * @param meters - Distance in meters
 * @param unit - Unit system ('imperial' or 'metric')
 * @returns Formatted string
 */
export function formatDistance(meters: number, unit: "imperial" | "metric" = "metric"): string {
	if (unit === "imperial") {
		const feet = meters / METERS_PER_FOOT;
		if (feet < 1000) {
			return `${Math.round(feet)} ft`;
		}
		const miles = meters / METERS_PER_MILE;
		return `${miles.toFixed(1)} mi`;
	}

	if (meters < 1000) {
		return `${Math.round(meters)} m`;
	}
	return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format elevation for display
 *
 * @param meters - Elevation in meters
 * @param unit - Unit system ('imperial' or 'metric')
 * @returns Formatted string
 */
export function formatElevation(meters: number, unit: "imperial" | "metric" = "metric"): string {
	if (unit === "imperial") {
		const feet = Math.round(meters / METERS_PER_FOOT);
		return `${feet.toLocaleString()} ft`;
	}
	return `${Math.round(meters)} m`;
}
