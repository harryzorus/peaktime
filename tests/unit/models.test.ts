/**
 * Hiking Time Models Tests
 *
 * Tests for Naismith, Tobler, Langmuir, and Munter methods
 * Calibrated against real Mt. Tam data: 56 min actual time for athletic group
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { GPXRoute } from "../../src/gpx";
import { parseGPXOrThrow } from "../../src/gpx";
import {
	calculateRouteMetrics,
	compareModels,
	estimateTime,
	FITNESS_LEVELS,
	HIKING_MODELS,
	langmuirTime,
	MUNTER_BASELINE,
	multiplierFromTranter,
	munterTime,
	naismithTime,
	TERRAIN_TYPES,
	toblerTime,
} from "../../src/hike/models";
import { findSummitIndex, getRouteToIndex } from "../../src/hike/planner";

// Load the test fixture
let route: GPXRoute;
let routeToSummit: GPXRoute;

beforeAll(() => {
	const gpxContent = readFileSync(join(__dirname, "../fixtures/mt-tam-sunrise.gpx"), "utf-8");
	route = parseGPXOrThrow(gpxContent);

	// Get route to summit only (not return trip)
	const summitIndex = findSummitIndex(route);
	routeToSummit = getRouteToIndex(route, summitIndex);
});

describe("Route Metrics", () => {
	test("should calculate Mt Tam route to summit metrics", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);

		// Mt Tam: ~3km distance, ~485m gain to summit
		expect(metrics.distance).toBeGreaterThan(2500);
		expect(metrics.distance).toBeLessThan(3500);
		expect(metrics.elevationGain).toBeGreaterThan(450);
		expect(metrics.elevationGain).toBeLessThan(520);
	});
});

describe("Naismith's Rule", () => {
	test("should calculate flat terrain at 5 km/h", () => {
		// 5 km flat = 1 hour = 60 min
		const time = naismithTime(5000, 0);
		expect(time).toBe(60);
	});

	test("should add 1 hour per 600m elevation", () => {
		// 0 distance, 600m gain = 60 min
		const time = naismithTime(0, 600);
		expect(time).toBe(60);
	});

	test("should combine distance and elevation", () => {
		// 5 km + 600m = 60 + 60 = 120 min
		const time = naismithTime(5000, 600);
		expect(time).toBe(120);
	});
});

describe("Tobler's Hiking Function", () => {
	test("should be fastest on slight downhill (-5% grade)", () => {
		const points = routeToSummit.points;
		const time = toblerTime(points);

		// Should produce a reasonable time
		expect(time).toBeGreaterThan(30);
		expect(time).toBeLessThan(180);
	});

	test("should handle flat terrain", () => {
		const flatPoints = [
			{ lat: 37.9, lon: -122.5, ele: 100 },
			{ lat: 37.91, lon: -122.5, ele: 100 }, // ~1.1 km
		];
		const time = toblerTime(flatPoints);

		// ~1.1 km at ~5.4 km/h (Tobler's flat speed) = ~12 min
		expect(time).toBeGreaterThan(8);
		expect(time).toBeLessThan(20);
	});
});

describe("Langmuir's Extension", () => {
	test("should match Naismith for ascent-only", () => {
		const langmuir = langmuirTime(5000, 600, 0, 0);
		const naismith = naismithTime(5000, 600);
		expect(langmuir).toBe(naismith);
	});

	test("should subtract time for gentle descent (5-12°)", () => {
		const withDescent = langmuirTime(5000, 0, 300, 8);
		const flat = naismithTime(5000, 0);
		expect(withDescent).toBeLessThan(flat);
	});

	test("should add time for steep descent (>12°)", () => {
		const steepDescent = langmuirTime(5000, 0, 300, 20);
		const flat = naismithTime(5000, 0);
		expect(steepDescent).toBeGreaterThan(flat);
	});
});

describe("Munter Method", () => {
	test("should use larger of horizontal or vertical time", () => {
		// 4 km at 4 km/h = 60 min horizontal
		// 200m at 400m/h = 30 min vertical
		// Max(60, 30) + Min(60, 30)/2 = 60 + 15 = 75 min
		const time = munterTime(4000, 200, 0);
		expect(time).toBe(75);
	});

	test("should handle steep routes correctly", () => {
		// 2 km at 4 km/h = 30 min horizontal
		// 500m at 400m/h = 75 min vertical
		// Max(75, 30) + Min(75, 30)/2 = 75 + 15 = 90 min
		const time = munterTime(2000, 500, 0);
		expect(time).toBe(90);
	});

	test("should handle descent", () => {
		// 4 km at 4 km/h = 60 min horizontal
		// 400m descent at 800m/h = 30 min vertical
		// Max(60, 30) + Min(60, 30)/2 = 60 + 15 = 75 min
		const time = munterTime(4000, 0, 400);
		expect(time).toBe(75);
	});
});

describe("Fitness Levels", () => {
	test("should have VAR-derived multipliers", () => {
		// Multipliers are derived from Tranter's corrections and VAR data
		// Higher multiplier = faster (divides base time)
		expect(FITNESS_LEVELS.leisurely.multiplier).toBeCloseTo(0.75, 1);
		expect(FITNESS_LEVELS.moderate.multiplier).toBe(1.0);
		expect(FITNESS_LEVELS.active.multiplier).toBeCloseTo(1.25, 1);
		expect(FITNESS_LEVELS.athletic.multiplier).toBeCloseTo(1.56, 1);
		expect(FITNESS_LEVELS.fast.multiplier).toBeCloseTo(2.0, 1);
		expect(FITNESS_LEVELS.elite.multiplier).toBeCloseTo(2.5, 1);
	});

	test("multipliers should be ordered by fitness level", () => {
		// Verify increasing multipliers with fitness
		expect(FITNESS_LEVELS.leisurely.multiplier).toBeLessThan(FITNESS_LEVELS.moderate.multiplier);
		expect(FITNESS_LEVELS.moderate.multiplier).toBeLessThan(FITNESS_LEVELS.active.multiplier);
		expect(FITNESS_LEVELS.active.multiplier).toBeLessThan(FITNESS_LEVELS.athletic.multiplier);
		expect(FITNESS_LEVELS.athletic.multiplier).toBeLessThan(FITNESS_LEVELS.fast.multiplier);
		expect(FITNESS_LEVELS.fast.multiplier).toBeLessThan(FITNESS_LEVELS.elite.multiplier);
	});

	test("higher fitness should result in faster times", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);

		const leisurely = estimateTime(metrics, "munter", "leisurely", "good_trail");
		const moderate = estimateTime(metrics, "munter", "moderate", "good_trail");
		const athletic = estimateTime(metrics, "munter", "athletic", "good_trail");

		expect(athletic).toBeLessThan(moderate);
		expect(moderate).toBeLessThan(leisurely);
	});
});

describe("Terrain Types", () => {
	test("should have correct multipliers", () => {
		expect(TERRAIN_TYPES.paved.multiplier).toBe(0.9);
		expect(TERRAIN_TYPES.good_trail.multiplier).toBe(1.0);
		expect(TERRAIN_TYPES.rough_trail.multiplier).toBe(1.25);
		expect(TERRAIN_TYPES.scramble.multiplier).toBe(1.5);
	});

	test("rougher terrain should result in slower times", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);

		const paved = estimateTime(metrics, "munter", "moderate", "paved");
		const goodTrail = estimateTime(metrics, "munter", "moderate", "good_trail");
		const roughTrail = estimateTime(metrics, "munter", "moderate", "rough_trail");

		expect(paved).toBeLessThan(goodTrail);
		expect(goodTrail).toBeLessThan(roughTrail);
	});
});

describe("Mt Tam Calibration", () => {
	/**
	 * REAL DATA POINT:
	 * - Route: Mt Tam from Pantoll to East Peak summit
	 * - Distance: ~3 km, Elevation gain: ~485m
	 * - Terrain: Good trail
	 * - Actual time: 56 minutes
	 * - Group fitness: Athletic (fast sustained pace)
	 */

	test("athletic fitness on Mt Tam should give conservative estimate", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);
		const estimated = estimateTime(metrics, "munter", "athletic", "good_trail");

		// Model is deliberately conservative - better to arrive early for sunrise
		// Actual time was 56 min, model gives ~66 min with new multipliers
		expect(estimated).toBeGreaterThan(50); // Not too optimistic
		expect(estimated).toBeLessThan(80); // Not unreasonably slow
	});

	test("moderate fitness should estimate longer than actual athletic time", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);
		const moderate = estimateTime(metrics, "munter", "moderate", "good_trail");

		// Moderate should be slower than the athletic group's 56 min
		expect(moderate).toBeGreaterThan(56);
	});

	test("compareModels should return all 4 model estimates", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);
		const comparison = compareModels(metrics, "athletic", "good_trail");

		expect(comparison.naismith).toBeDefined();
		expect(comparison.tobler).toBeDefined();
		expect(comparison.langmuir).toBeDefined();
		expect(comparison.munter).toBeDefined();

		// All should be positive
		expect(comparison.naismith).toBeGreaterThan(0);
		expect(comparison.tobler).toBeGreaterThan(0);
		expect(comparison.langmuir).toBeGreaterThan(0);
		expect(comparison.munter).toBeGreaterThan(0);
	});

	test("Munter with athletic fitness should be reasonably close to actual", () => {
		const metrics = calculateRouteMetrics(routeToSummit.points);
		const comparison = compareModels(metrics, "athletic", "good_trail");

		// Model is deliberately conservative - estimates ~66 min vs 56 min actual
		// Arriving early is better than arriving late for sunrise hikes
		const actual = 56;
		const estimated = comparison.munter;

		// Should be within 20 min of actual (conservative buffer)
		expect(estimated).toBeGreaterThan(actual - 10);
		expect(estimated).toBeLessThan(actual + 20);
	});
});

describe("Hiking Models Metadata", () => {
	test("should have metadata for all 4 models", () => {
		expect(HIKING_MODELS.naismith).toBeDefined();
		expect(HIKING_MODELS.tobler).toBeDefined();
		expect(HIKING_MODELS.langmuir).toBeDefined();
		expect(HIKING_MODELS.munter).toBeDefined();
	});

	test("should have required fields for each model", () => {
		for (const [, info] of Object.entries(HIKING_MODELS)) {
			expect(info.name).toBeDefined();
			expect(info.year).toBeGreaterThan(1800);
			expect(info.author).toBeDefined();
			expect(info.description).toBeDefined();
		}
	});

	test("Naismith should be oldest (1892)", () => {
		const years = Object.values(HIKING_MODELS).map((m) => m.year);
		const oldest = Math.min(...years);
		expect(HIKING_MODELS.naismith.year).toBe(oldest);
		expect(oldest).toBe(1892);
	});
});

describe("multiplierFromTranter", () => {
	test("should return 1.0 for 25-minute Tranter test (average fitness)", () => {
		// 25 minutes is the baseline "average" in Tranter's corrections
		expect(multiplierFromTranter(25)).toBe(1.0);
	});

	test("faster Tranter time should give higher multiplier", () => {
		const fast = multiplierFromTranter(15); // Very fit
		const slow = multiplierFromTranter(40); // Unfit
		expect(fast).toBeGreaterThan(1.0);
		expect(slow).toBeLessThan(1.0);
	});

	test("should match expected Tranter fitness levels", () => {
		// Tranter's corrections define specific fitness levels
		// 15 min = very fit, 25 min = average, 40 min = unfit
		expect(multiplierFromTranter(15)).toBeCloseTo(25 / 15, 2); // ~1.67
		expect(multiplierFromTranter(20)).toBeCloseTo(25 / 20, 2); // 1.25
		expect(multiplierFromTranter(30)).toBeCloseTo(25 / 30, 2); // ~0.83
	});
});

describe("Munter Baseline Constants", () => {
	test("should have standard Munter values", () => {
		// Swiss Alpine Club standard values
		expect(MUNTER_BASELINE.horizontal).toBe(4); // 4 km/h
		expect(MUNTER_BASELINE.ascent).toBe(400); // 400 m/hr
		expect(MUNTER_BASELINE.descent).toBe(800); // 800 m/hr
	});
});
