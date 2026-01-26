/**
 * GPX (GPS Exchange Format) types
 *
 * Represents parsed GPX track data for route analysis and visualization.
 */

/** A GPX waypoint — a named point of interest (e.g., coffee stop, viewpoint) */
export interface GPXWaypoint {
	/** Latitude in degrees */
	lat: number;
	/** Longitude in degrees */
	lon: number;
	/** Elevation in meters (optional) */
	ele?: number;
	/** Name of the waypoint */
	name: string;
	/** Symbol hint (e.g., "Campground", "Summit") */
	sym?: string;
	/** Type/category of the waypoint */
	type?: string;
}

/** A single GPS track point with coordinates and optional metadata */
export interface GPXPoint {
	/** Latitude in degrees (-90 to 90) */
	lat: number;
	/** Longitude in degrees (-180 to 180) */
	lon: number;
	/** Elevation in meters (optional in GPX spec but required for our analysis) */
	ele: number;
	/** Timestamp of the point (optional, typically present in activities but not routes) */
	time?: Date;
}

/** Activity type from GPX or Strava */
export type ActivityType = "hiking" | "cycling" | "running" | "walking" | "unknown";

/** Metadata about a GPX route */
export interface GPXMetadata {
	/** Name of the route/activity */
	name: string;
	/** Description (optional) */
	description?: string;
	/** Author name (optional) */
	author?: string;
	/** Link to source (e.g., Strava URL) */
	link?: string;
	/** Activity type */
	type: ActivityType;
	/** Creation/activity date */
	time?: Date;
}

/** A complete GPX route with all track points */
export interface GPXRoute {
	/** Route metadata */
	metadata: GPXMetadata;
	/** Ordered list of track points */
	points: GPXPoint[];
	/** Named waypoints (points of interest along the route) */
	waypoints?: GPXWaypoint[];
}

/** Statistics computed from a GPX route */
export interface RouteStats {
	/** Total distance in meters */
	totalDistance: number;
	/** Total elevation gain in meters (uphill only) */
	totalElevationGain: number;
	/** Total elevation loss in meters (downhill only, positive number) */
	totalElevationLoss: number;
	/** Maximum elevation in meters */
	maxElevation: number;
	/** Minimum elevation in meters */
	minElevation: number;
	/** Starting point */
	startPoint: GPXPoint;
	/** Ending point */
	endPoint: GPXPoint;
	/** Bounding box of the route */
	bounds: {
		minLat: number;
		maxLat: number;
		minLon: number;
		maxLon: number;
	};
	/** Number of track points */
	pointCount: number;
}

/** Parse error with details */
export interface GPXParseError {
	message: string;
	line?: number;
	column?: number;
}

/** Result of parsing a GPX file */
export type GPXParseResult =
	| { success: true; route: GPXRoute }
	| { success: false; error: GPXParseError };
