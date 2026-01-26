/**
 * GPX parser and route stats tests
 *
 * Validates GPX parsing and distance/elevation calculations
 * using the Mt. Tam sunrise route fixture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { GPXPoint, GPXRoute } from "../../src/gpx";
import {
	calculateRouteStats,
	formatDistance,
	formatElevation,
	haversineDistance,
	parseGPX,
	parseGPXOrThrow,
} from "../../src/gpx";

// Load the test fixture
let mtTamGPX: string;
let route: GPXRoute;

beforeAll(() => {
	mtTamGPX = readFileSync(join(__dirname, "../fixtures/mt-tam-sunrise.gpx"), "utf-8");
	const result = parseGPX(mtTamGPX);
	if (!result.success) {
		throw new Error(`Failed to parse fixture: ${result.error.message}`);
	}
	route = result.route;
});

describe("parseGPX", () => {
	test("should successfully parse valid GPX file", () => {
		const result = parseGPX(mtTamGPX);
		expect(result.success).toBe(true);
	});

	test("should extract route name from track", () => {
		expect(route.metadata.name).toBe("Tam Sunrise");
	});

	test("should detect activity type as hiking", () => {
		expect(route.metadata.type).toBe("hiking");
	});

	test("should extract author name", () => {
		expect(route.metadata.author).toContain("Harry");
	});

	test("should extract link", () => {
		expect(route.metadata.link).toContain("strava.com");
	});

	test("should parse all track points", () => {
		// The fixture has many points for the out-and-back route
		expect(route.points.length).toBeGreaterThan(100);
	});

	test("should parse coordinates correctly", () => {
		const firstPoint = route.points[0];
		expect(firstPoint.lat).toBeCloseTo(37.9099, 3);
		expect(firstPoint.lon).toBeCloseTo(-122.5772, 3);
	});

	test("should parse elevation correctly", () => {
		const firstPoint = route.points[0];
		expect(firstPoint.ele).toBeCloseTo(294.67, 1);
	});

	test("should return error for invalid XML", () => {
		const result = parseGPX("not xml");
		expect(result.success).toBe(false);
		if (!result.success) {
			// Error message varies between browser (Invalid GPX) and Node/jsdom (DOMParser not available or parse error)
			expect(result.error.message.length).toBeGreaterThan(0);
		}
	});

	test("should return error for missing gpx element", () => {
		const result = parseGPX('<?xml version="1.0"?><root></root>');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toContain("missing <gpx>");
		}
	});

	test("should return error for empty track", () => {
		const emptyGPX = `<?xml version="1.0"?>
			<gpx version="1.1">
				<trk><name>Empty</name><trkseg></trkseg></trk>
			</gpx>`;
		const result = parseGPX(emptyGPX);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toContain("no track points");
		}
	});
});

describe("parseGPX waypoints", () => {
	test("should parse <wpt> elements", () => {
		const gpx = `<?xml version="1.0"?>
			<gpx version="1.1">
				<wpt lat="37.7749" lon="-122.4194">
					<ele>10</ele>
					<name>Mission Blue</name>
					<sym>Cafe</sym>
					<type>food</type>
				</wpt>
				<wpt lat="37.7600" lon="-122.4100">
					<name>Sunset View</name>
				</wpt>
				<trk><name>Test</name><trkseg>
					<trkpt lat="37.78" lon="-122.42"><ele>20</ele></trkpt>
					<trkpt lat="37.77" lon="-122.41"><ele>30</ele></trkpt>
				</trkseg></trk>
			</gpx>`;
		const result = parseGPX(gpx);
		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.route.waypoints).toBeDefined();
		expect(result.route.waypoints).toHaveLength(2);

		const wp1 = result.route.waypoints?.[0];
		expect(wp1.name).toBe("Mission Blue");
		expect(wp1.lat).toBeCloseTo(37.7749, 4);
		expect(wp1.lon).toBeCloseTo(-122.4194, 4);
		expect(wp1.ele).toBeCloseTo(10, 1);
		expect(wp1.sym).toBe("Cafe");
		expect(wp1.type).toBe("food");

		const wp2 = result.route.waypoints?.[1];
		expect(wp2.name).toBe("Sunset View");
		expect(wp2.ele).toBeUndefined();
		expect(wp2.sym).toBeUndefined();
	});

	test("should not include waypoints field when no <wpt> elements", () => {
		const gpx = `<?xml version="1.0"?>
			<gpx version="1.1">
				<trk><name>No WP</name><trkseg>
					<trkpt lat="37.78" lon="-122.42"><ele>20</ele></trkpt>
					<trkpt lat="37.77" lon="-122.41"><ele>30</ele></trkpt>
				</trkseg></trk>
			</gpx>`;
		const result = parseGPX(gpx);
		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.route.waypoints).toBeUndefined();
	});

	test("should skip waypoints with invalid coordinates", () => {
		const gpx = `<?xml version="1.0"?>
			<gpx version="1.1">
				<wpt lat="invalid" lon="-122.42"><name>Bad</name></wpt>
				<wpt lat="37.78" lon="-122.42"><name>Good</name></wpt>
				<trk><name>Test</name><trkseg>
					<trkpt lat="37.78" lon="-122.42"><ele>20</ele></trkpt>
				</trkseg></trk>
			</gpx>`;
		const result = parseGPX(gpx);
		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.route.waypoints).toHaveLength(1);
		expect(result.route.waypoints?.[0].name).toBe("Good");
	});

	test("should assign default name for nameless waypoints", () => {
		const gpx = `<?xml version="1.0"?>
			<gpx version="1.1">
				<wpt lat="37.78" lon="-122.42"></wpt>
				<trk><name>Test</name><trkseg>
					<trkpt lat="37.78" lon="-122.42"><ele>20</ele></trkpt>
				</trkseg></trk>
			</gpx>`;
		const result = parseGPX(gpx);
		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.route.waypoints?.[0].name).toBe("Waypoint 1");
	});
});

describe("parseGPXOrThrow", () => {
	test("should return route for valid GPX", () => {
		const result = parseGPXOrThrow(mtTamGPX);
		expect(result.metadata.name).toBe("Tam Sunrise");
	});

	test("should throw for invalid GPX", () => {
		expect(() => parseGPXOrThrow("not xml")).toThrow();
	});
});

describe("haversineDistance", () => {
	test("should calculate zero distance for same point", () => {
		const point: GPXPoint = { lat: 37.9, lon: -122.5, ele: 100 };
		expect(haversineDistance(point, point)).toBe(0);
	});

	test("should calculate reasonable distance between nearby points", () => {
		const p1: GPXPoint = { lat: 37.9099, lon: -122.5772, ele: 294 };
		const p2: GPXPoint = { lat: 37.9101, lon: -122.5772, ele: 294 };
		const distance = haversineDistance(p1, p2);

		// ~22 meters for 0.0002 degrees latitude
		expect(distance).toBeGreaterThan(15);
		expect(distance).toBeLessThan(30);
	});

	test("should handle large distances", () => {
		const sf: GPXPoint = { lat: 37.7749, lon: -122.4194, ele: 0 };
		const la: GPXPoint = { lat: 34.0522, lon: -118.2437, ele: 0 };
		const distance = haversineDistance(sf, la);

		// SF to LA is roughly 560 km
		expect(distance).toBeGreaterThan(500000);
		expect(distance).toBeLessThan(600000);
	});
});

describe("calculateRouteStats", () => {
	test("should calculate total distance", () => {
		const stats = calculateRouteStats(route);

		// Mt. Tam sunrise route is roughly 3-4 miles out and back
		// That's about 5-7 km total
		expect(stats.totalDistance).toBeGreaterThan(4000); // > 4 km
		expect(stats.totalDistance).toBeLessThan(10000); // < 10 km
	});

	test("should calculate elevation gain", () => {
		const stats = calculateRouteStats(route);

		// Route goes from ~295m to ~780m and back
		// Elevation gain should be roughly 485m
		expect(stats.totalElevationGain).toBeGreaterThan(400);
		expect(stats.totalElevationGain).toBeLessThan(600);
	});

	test("should calculate elevation loss", () => {
		const stats = calculateRouteStats(route);

		// Out-and-back, so loss should be similar to gain
		expect(stats.totalElevationLoss).toBeGreaterThan(400);
		expect(stats.totalElevationLoss).toBeLessThan(600);
	});

	test("should find max elevation near summit", () => {
		const stats = calculateRouteStats(route);

		// Summit is ~780m
		expect(stats.maxElevation).toBeGreaterThan(750);
		expect(stats.maxElevation).toBeLessThan(800);
	});

	test("should find min elevation at trailhead", () => {
		const stats = calculateRouteStats(route);

		// Trailhead is ~293m
		expect(stats.minElevation).toBeGreaterThan(280);
		expect(stats.minElevation).toBeLessThan(300);
	});

	test("should set start and end points", () => {
		const stats = calculateRouteStats(route);

		expect(stats.startPoint).toBeDefined();
		expect(stats.endPoint).toBeDefined();
		expect(stats.startPoint.lat).toBeCloseTo(37.9099, 2);
	});

	test("should calculate bounds", () => {
		const stats = calculateRouteStats(route);

		expect(stats.bounds.minLat).toBeLessThan(stats.bounds.maxLat);
		expect(stats.bounds.minLon).toBeLessThan(stats.bounds.maxLon);
	});

	test("should count points", () => {
		const stats = calculateRouteStats(route);
		expect(stats.pointCount).toBe(route.points.length);
	});

	test("should throw for empty route", () => {
		const emptyRoute: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [],
		};
		expect(() => calculateRouteStats(emptyRoute)).toThrow("empty route");
	});

	test("should support disabling elevation smoothing", () => {
		const smoothed = calculateRouteStats(route, { smoothElevation: true });
		const raw = calculateRouteStats(route, { smoothElevation: false });

		// Raw should have slightly different elevation gain due to GPS noise
		// They should be close but not identical
		expect(raw.totalElevationGain).not.toBe(smoothed.totalElevationGain);
	});
});

describe("formatDistance", () => {
	test("should format small distances in meters", () => {
		expect(formatDistance(500, "metric")).toBe("500 m");
	});

	test("should format large distances in kilometers", () => {
		expect(formatDistance(5000, "metric")).toBe("5.0 km");
	});

	test("should format imperial distances in feet", () => {
		expect(formatDistance(100, "imperial")).toMatch(/\d+ ft/);
	});

	test("should format imperial distances in miles", () => {
		expect(formatDistance(5000, "imperial")).toMatch(/\d+\.\d mi/);
	});
});

describe("formatElevation", () => {
	test("should format metric elevation", () => {
		expect(formatElevation(750, "metric")).toBe("750 m");
	});

	test("should format imperial elevation", () => {
		const formatted = formatElevation(750, "imperial");
		expect(formatted).toMatch(/[\d,]+ ft/);
		// 750m is about 2460 ft
		expect(formatted).toContain("2,");
	});
});
