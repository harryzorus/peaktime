/**
 * Hiking Time Estimator
 *
 * Estimates hiking time based on distance, elevation change, and terrain.
 * Uses a modified Naismith's rule with Tobler's hiking function concepts.
 *
 * Naismith's rule: 5km/h + 30min per 300m of ascent
 * We use a more nuanced model with configurable parameters.
 */

import { haversineDistance } from "../gpx/route-stats";
import type { GPXPoint, GPXRoute } from "../gpx/types";
import type { HikingParams, HikingTimeEstimate, SegmentTime } from "./types";
import { DEFAULT_HIKING_PARAMS } from "./types";

/**
 * Calculate hiking time for a single segment between two points
 *
 * @param p1 - Starting point
 * @param p2 - Ending point
 * @param params - Hiking parameters
 * @returns Time in minutes
 */
export function segmentTime(p1: GPXPoint, p2: GPXPoint, params: HikingParams): number {
	const distance = haversineDistance(p1, p2);
	const elevationChange = p2.ele - p1.ele;

	// Base time from distance (convert km/h to m/min)
	const baseTimeMin = distance / ((params.baseSpeedKmh * 1000) / 60);

	// Elevation adjustment
	let elevationAdjustment = 0;
	if (elevationChange > 0) {
		// Uphill: add penalty
		elevationAdjustment = (elevationChange / 100) * params.uphillPenaltyMinPer100m;
	} else if (elevationChange < 0) {
		// Downhill: subtract bonus (but don't go negative)
		elevationAdjustment = (Math.abs(elevationChange) / 100) * -params.downhillBonusMinPer100m;
	}

	// Total time (minimum of base time - can't go faster than flat speed)
	const totalTime = Math.max(baseTimeMin, baseTimeMin + elevationAdjustment);

	return totalTime;
}

/**
 * Estimate total hiking time for a GPX route
 *
 * @param route - The GPX route
 * @param params - Hiking parameters (optional, uses defaults)
 * @returns Detailed time estimate with segment breakdown
 */
export function estimateHikingTime(
	route: GPXRoute,
	params: Partial<HikingParams> = {},
): HikingTimeEstimate {
	const fullParams: HikingParams = { ...DEFAULT_HIKING_PARAMS, ...params };
	const { points } = route;

	if (points.length < 2) {
		return {
			movingTime: 0,
			totalTime: 0,
			breakCount: 0,
			params: fullParams,
			segments: [],
		};
	}

	const segments: SegmentTime[] = [];
	let cumulativeDistance = 0;
	let cumulativeTime = 0;

	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];

		const distance = haversineDistance(prev, curr);
		const elevationChange = curr.ele - prev.ele;
		const time = segmentTime(prev, curr, fullParams);

		cumulativeDistance += distance;
		cumulativeTime += time;

		segments.push({
			fromIndex: i - 1,
			toIndex: i,
			distance,
			elevationChange,
			time,
			cumulativeDistance,
			cumulativeTime,
			point: curr,
		});
	}

	const movingTime = cumulativeTime;

	// Calculate breaks
	let breakCount = 0;
	if (fullParams.breakIntervalMinutes > 0) {
		breakCount = Math.floor(movingTime / fullParams.breakIntervalMinutes);
	}

	const totalBreakTime = breakCount * fullParams.breakDurationMinutes;
	const totalTime = movingTime + totalBreakTime;

	return {
		movingTime,
		totalTime,
		breakCount,
		params: fullParams,
		segments,
	};
}

/**
 * Get estimated time to reach a specific distance along the route
 *
 * @param estimate - The hiking time estimate
 * @param targetDistance - Target distance in meters
 * @returns Time in minutes to reach that distance, or undefined if past end
 */
export function timeToDistance(
	estimate: HikingTimeEstimate,
	targetDistance: number,
): number | undefined {
	if (targetDistance <= 0) return 0;

	for (const segment of estimate.segments) {
		if (segment.cumulativeDistance >= targetDistance) {
			// Interpolate within this segment
			const prevCumulativeDistance = segment.cumulativeDistance - segment.distance;
			const prevCumulativeTime = segment.cumulativeTime - segment.time;

			const progress = (targetDistance - prevCumulativeDistance) / segment.distance;
			return prevCumulativeTime + progress * segment.time;
		}
	}

	// Target is past the end of the route
	return undefined;
}

/**
 * Get estimated time to reach a specific elevation
 * (finds first point at or above target elevation)
 *
 * @param estimate - The hiking time estimate
 * @param targetElevation - Target elevation in meters
 * @returns Time in minutes to reach that elevation, or undefined if not found
 */
export function timeToElevation(
	estimate: HikingTimeEstimate,
	targetElevation: number,
): number | undefined {
	for (const segment of estimate.segments) {
		if (segment.point.ele >= targetElevation) {
			return segment.cumulativeTime;
		}
	}
	return undefined;
}

/**
 * Get the waypoint (point index and time) at a specific percentage of the route
 *
 * @param estimate - The hiking time estimate
 * @param percentage - Percentage of route (0-100)
 * @returns Segment at that percentage
 */
export function waypointAtPercentage(
	estimate: HikingTimeEstimate,
	percentage: number,
): SegmentTime | undefined {
	if (estimate.segments.length === 0) return undefined;

	const totalDistance = estimate.segments[estimate.segments.length - 1].cumulativeDistance;
	const targetDistance = (percentage / 100) * totalDistance;

	for (const segment of estimate.segments) {
		if (segment.cumulativeDistance >= targetDistance) {
			return segment;
		}
	}

	return estimate.segments[estimate.segments.length - 1];
}

/**
 * Format hiking time for display
 *
 * @param minutes - Time in minutes
 * @returns Formatted string like "2h 15m" or "45m"
 */
export function formatHikingTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = Math.round(minutes % 60);

	if (hours === 0) {
		return `${mins}m`;
	}

	if (mins === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${mins}m`;
}
