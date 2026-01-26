/**
 * Property-based tests for common module
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { findHighPointIndex, getRouteToIndex } from "../../src/common/planner";
import { createPlanner } from "../../src/common/planner-factory";
import type { SunTarget } from "../../src/common/types";
import { isSunriseTarget, isSunsetTarget } from "../../src/common/types";
import type { GPXPoint, GPXRoute } from "../../src/gpx/types";

const NUM_RUNS = 200;

const allSunTargets: SunTarget[] = [
	"sunrise",
	"goldenHourStart",
	"goldenHourEnd",
	"blueHourStart",
	"blueHourEnd",
	"sunset",
	"goldenHourEveningStart",
	"goldenHourEveningEnd",
	"blueHourEveningStart",
	"blueHourEveningEnd",
];

const sunTargetArb = fc.constantFrom<SunTarget>(...allSunTargets);

const gpxPointArb = fc.record({
	lat: fc.double({ min: -90, max: 90, noNaN: true }),
	lon: fc.double({ min: -180, max: 180, noNaN: true }),
	ele: fc.double({ min: 0, max: 9000, noNaN: true }),
});

/** Generate a non-empty array of GPX points (1 to 20 points) */
const gpxRouteArb = fc.array(gpxPointArb, { minLength: 1, maxLength: 20 }).map(
	(points): GPXRoute => ({
		metadata: { name: "Test", type: "hiking" },
		points,
	}),
);

describe("common property tests", () => {
	test("isSunriseTarget and isSunsetTarget partition all SunTargets", () => {
		fc.assert(
			fc.property(sunTargetArb, (target) => {
				const sunrise = isSunriseTarget(target);
				const sunset = isSunsetTarget(target);
				// Exactly one is true
				expect(sunrise !== sunset).toBe(true);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("findHighPointIndex returns index with elevation >= all others", () => {
		fc.assert(
			fc.property(gpxRouteArb, (route) => {
				const idx = findHighPointIndex(route);
				const maxEle = route.points[idx].ele;
				for (const p of route.points) {
					expect(maxEle).toBeGreaterThanOrEqual(p.ele);
				}
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("getRouteToIndex result has exactly endIndex + 1 points", () => {
		fc.assert(
			fc.property(gpxRouteArb, fc.integer({ min: 0, max: 19 }), (route, endIdx) => {
				const safeIdx = Math.min(endIdx, route.points.length - 1);
				const sub = getRouteToIndex(route, safeIdx);
				expect(sub.points.length).toBe(safeIdx + 1);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("planAllOptions always returns exactly 3 plans", () => {
		// Use a simple mock planner to test structure
		const planner = createPlanner({
			estimate: (points: GPXPoint[]) => ({ time: points.length }),
			defaultParams: () => ({}),
			extractDuration: (est: { time: number }) => est.time,
			defaultNightMultiplier: 0.8,
		});

		// Simple route at a realistic location
		const route: GPXRoute = {
			metadata: { name: "Test", type: "hiking" },
			points: [
				{ lat: 37.9, lon: -122.5, ele: 100 },
				{ lat: 37.91, lon: -122.5, ele: 200 },
			],
		};
		const date = new Date("2026-06-21T12:00:00Z");
		const coords = { latitude: 37.9, longitude: -122.5 };

		const sunrisePlans = planner.planAllOptions(route, date, coords, "sunrise");
		expect(sunrisePlans.length).toBe(3);

		const sunsetPlans = planner.planAllOptions(route, date, coords, "sunset");
		expect(sunsetPlans.length).toBe(3);
	});

	test("plan startTime is always before targetTime for feasible plans", () => {
		const planner = createPlanner({
			estimate: (_points: GPXPoint[]) => ({ time: 5 }), // Very short time to ensure feasibility
			defaultParams: () => ({}),
			extractDuration: (est: { time: number }) => est.time,
			defaultNightMultiplier: 0.8,
		});

		const route: GPXRoute = {
			metadata: { name: "Short", type: "hiking" },
			points: [
				{ lat: 37.9, lon: -122.5, ele: 100 },
				{ lat: 37.91, lon: -122.5, ele: 200 },
			],
		};
		const date = new Date("2026-06-21T12:00:00Z");
		const coords = { latitude: 37.9, longitude: -122.5 };

		fc.assert(
			fc.property(sunTargetArb, (target) => {
				const plan = planner.plan(route, date, coords, target);
				if (plan.feasible) {
					expect(plan.startTime.getTime()).toBeLessThan(plan.targetTime.getTime());
				}
			}),
			{ numRuns: NUM_RUNS },
		);
	});
});
