/**
 * GPX parsing and route analysis
 *
 * Parse GPX files and calculate route statistics.
 */

export { parseGPX, parseGPXOrThrow } from "./parser";

export {
	calculateGrade,
	calculateRouteStats,
	distance3D,
	formatDistance,
	formatElevation,
	haversineDistance,
	smoothElevation,
} from "./route-stats";

export type {
	ActivityType,
	GPXMetadata,
	GPXParseError,
	GPXParseResult,
	GPXPoint,
	GPXRoute,
	GPXWaypoint,
	RouteStats,
} from "./types";
