/**
 * Base route metrics shared across all activity modules
 */

import { haversineDistance } from "../gpx/route-stats";
import type { GPXPoint } from "../gpx/types";

/** Base route metrics common to all activities */
export interface BaseRouteMetrics {
	/** Total horizontal distance in meters */
	distance: number;
	/** Total elevation gain in meters */
	elevationGain: number;
	/** Total elevation loss in meters */
	elevationLoss: number;
}

/**
 * Calculate base route metrics from GPX points
 *
 * Pure function that computes distance (via haversine), elevation gain,
 * and elevation loss. Activity-specific metrics (avgDescentGrade,
 * avgGrade, avgGapMultiplier, etc.) are added by each module.
 */
export function calculateBaseRouteMetrics(points: GPXPoint[]): BaseRouteMetrics {
	let distance = 0;
	let elevationGain = 0;
	let elevationLoss = 0;

	for (let i = 1; i < points.length; i++) {
		const d = haversineDistance(points[i - 1], points[i]);
		const elevChange = points[i].ele - points[i - 1].ele;

		distance += d;

		if (elevChange > 0) {
			elevationGain += elevChange;
		} else {
			elevationLoss += Math.abs(elevChange);
		}
	}

	return {
		distance,
		elevationGain,
		elevationLoss,
	};
}
