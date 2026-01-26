import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { GPXPoint } from "../../src/gpx";
import { calculateGrade, distance3D, haversineDistance } from "../../src/gpx";

const NUM_RUNS = 500;

const gpxPoint = fc.record({
	lat: fc.double({ min: -90, max: 90, noNaN: true }),
	lon: fc.double({ min: -180, max: 180, noNaN: true }),
	ele: fc.double({ min: -500, max: 9000, noNaN: true }),
}) as fc.Arbitrary<GPXPoint>;

describe("GPX property tests", () => {
	test("haversine distance is always >= 0", () => {
		fc.assert(
			fc.property(gpxPoint, gpxPoint, (p1, p2) => {
				expect(haversineDistance(p1, p2)).toBeGreaterThanOrEqual(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("haversine distance from a point to itself is 0", () => {
		fc.assert(
			fc.property(gpxPoint, (p) => {
				expect(haversineDistance(p, p)).toBe(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("haversine distance is symmetric", () => {
		fc.assert(
			fc.property(gpxPoint, gpxPoint, (p1, p2) => {
				const d1 = haversineDistance(p1, p2);
				const d2 = haversineDistance(p2, p1);
				expect(d1).toBeCloseTo(d2, 6);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("haversine distance <= half Earth circumference (~20,037 km)", () => {
		fc.assert(
			fc.property(gpxPoint, gpxPoint, (p1, p2) => {
				const d = haversineDistance(p1, p2);
				expect(d).toBeLessThanOrEqual(20_100_000); // slight margin
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("3D distance >= haversine distance", () => {
		fc.assert(
			fc.property(gpxPoint, gpxPoint, (p1, p2) => {
				const d2d = haversineDistance(p1, p2);
				const d3d = distance3D(p1, p2);
				expect(d3d).toBeGreaterThanOrEqual(d2d - 0.001); // floating point tolerance
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("grade is 0 when points are at same location", () => {
		fc.assert(
			fc.property(gpxPoint, (p) => {
				expect(calculateGrade(p, p)).toBe(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("grade is positive when going uphill", () => {
		fc.assert(
			fc.property(gpxPoint, fc.double({ min: 1, max: 5000, noNaN: true }), (p1, elevDiff) => {
				const p2: GPXPoint = { ...p1, lat: p1.lat + 0.001, ele: p1.ele + elevDiff };
				const grade = calculateGrade(p1, p2);
				expect(grade).toBeGreaterThan(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});
});
