/**
 * Planner factory tests using a mock estimator
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { PlannerConfig } from "../../src/common/planner-factory";
import { createPlanner } from "../../src/common/planner-factory";
import { parseGPXOrThrow } from "../../src/gpx";
import type { GPXRoute } from "../../src/gpx/types";
import type { Coordinates } from "../../src/sun/types";

// ─── Mock estimator ──────────────────────────────────────────

interface MockParams {
	speedFactor: number;
}

interface MockEstimate {
	movingTime: number;
	label: string;
}

const mockConfig: PlannerConfig<MockParams, MockEstimate> = {
	estimate: (points, params) => ({
		movingTime: points.length * 2 * params.speedFactor,
		label: "mock",
	}),
	defaultParams: () => ({ speedFactor: 1 }),
	extractDuration: (est) => est.movingTime,
	defaultNightMultiplier: 0.8,
};

// ─── Fixtures ────────────────────────────────────────────────

let route: GPXRoute;

const TEST_DATE = new Date("2026-01-26T12:00:00Z");
const MT_TAM: Coordinates = { latitude: 37.9235, longitude: -122.5965 };

beforeAll(() => {
	const gpxContent = readFileSync(join(__dirname, "../fixtures/mt-tam-sunrise.gpx"), "utf-8");
	route = parseGPXOrThrow(gpxContent);
});

// ─── Tests ───────────────────────────────────────────────────

describe("createPlanner", () => {
	test("returns object with plan, planAllOptions, createSummary, getRouteEstimate", () => {
		const planner = createPlanner(mockConfig);

		expect(typeof planner.plan).toBe("function");
		expect(typeof planner.planAllOptions).toBe("function");
		expect(typeof planner.createSummary).toBe("function");
		expect(typeof planner.getRouteEstimate).toBe("function");
	});
});

describe("plan()", () => {
	const planner = createPlanner(mockConfig);

	test("calls estimator with route-to-high-point points", () => {
		const plan = planner.plan(route, TEST_DATE, MT_TAM, "sunrise");
		expect(plan.durationMinutes).toBeGreaterThan(0);
	});

	test("uses default params when none provided", () => {
		const plan = planner.plan(route, TEST_DATE, MT_TAM, "sunrise");
		// Default speedFactor=1, so duration = numPoints * 2 * 1 / nightMultiplier
		expect(plan.durationMinutes).toBeGreaterThan(0);
	});

	test("uses provided params over defaults", () => {
		const fastPlan = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", {
			params: { speedFactor: 0.5 },
		});
		const slowPlan = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", {
			params: { speedFactor: 2 },
		});
		// Faster factor = shorter time; but night multiplier divides, so slower factor = longer
		expect(fastPlan.durationMinutes).toBeLessThan(slowPlan.durationMinutes);
	});

	test("applies night multiplier for sunrise targets", () => {
		const planWithNight = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", {
			applyNightAdjustment: true,
		});
		const planWithoutNight = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", {
			applyNightAdjustment: false,
		});
		// Night adjustment makes it slower (divides by 0.8), so longer duration
		expect(planWithNight.durationMinutes).toBeGreaterThan(planWithoutNight.durationMinutes);
	});

	test("does NOT apply night multiplier for sunset targets", () => {
		const planSunset = planner.plan(route, TEST_DATE, MT_TAM, "sunset", {
			applyNightAdjustment: true,
		});
		const planSunsetNoNight = planner.plan(route, TEST_DATE, MT_TAM, "sunset", {
			applyNightAdjustment: false,
		});
		// Sunset targets never get night adjustment regardless of flag
		expect(planSunset.durationMinutes).toBe(planSunsetNoNight.durationMinutes);
	});

	test("respects applyNightAdjustment=false", () => {
		const plan = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", {
			applyNightAdjustment: false,
		});
		const planDefault = planner.plan(route, TEST_DATE, MT_TAM, "sunrise");
		// Default is applyNightAdjustment=true for sunrise, so turning it off should be faster
		expect(plan.durationMinutes).toBeLessThan(planDefault.durationMinutes);
	});

	test("calculates startTime = targetTime - buffer - duration", () => {
		const plan = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", {
			bufferMinutes: 15,
			applyNightAdjustment: false,
		});
		const expectedStart =
			plan.targetTime.getTime() - 15 * 60 * 1000 - plan.durationMinutes * 60 * 1000;
		expect(plan.startTime.getTime()).toBeCloseTo(expectedStart, -3);
	});

	test("feasibility: sunrise plan starting after 10PM prev day is feasible", () => {
		// With a short route and fast speed, start time should be early morning
		const shortRoute: GPXRoute = {
			metadata: { name: "Short", type: "hiking" },
			points: [
				{ lat: 37.9, lon: -122.5, ele: 100 },
				{ lat: 37.91, lon: -122.5, ele: 200 },
			],
		};
		const plan = planner.plan(shortRoute, TEST_DATE, MT_TAM, "sunrise");
		expect(plan.feasible).toBe(true);
	});

	test("feasibility: sunset plan starting after 6AM is feasible", () => {
		const shortRoute: GPXRoute = {
			metadata: { name: "Short", type: "hiking" },
			points: [
				{ lat: 37.9, lon: -122.5, ele: 100 },
				{ lat: 37.91, lon: -122.5, ele: 200 },
			],
		};
		const plan = planner.plan(shortRoute, TEST_DATE, MT_TAM, "sunset");
		expect(plan.feasible).toBe(true);
	});

	test("uses buffer from options (default 10)", () => {
		const plan10 = planner.plan(route, TEST_DATE, MT_TAM, "sunrise");
		const plan30 = planner.plan(route, TEST_DATE, MT_TAM, "sunrise", { bufferMinutes: 30 });

		expect(plan10.bufferMinutes).toBe(10);
		expect(plan30.bufferMinutes).toBe(30);
		// More buffer = earlier start
		expect(plan30.startTime.getTime()).toBeLessThan(plan10.startTime.getTime());
	});
});

describe("planAllOptions()", () => {
	const planner = createPlanner(mockConfig);

	test("returns 3 plans for sunrise mode", () => {
		const plans = planner.planAllOptions(route, TEST_DATE, MT_TAM, "sunrise");
		expect(plans.length).toBe(3);
	});

	test("returns 3 plans for sunset mode", () => {
		const plans = planner.planAllOptions(route, TEST_DATE, MT_TAM, "sunset");
		expect(plans.length).toBe(3);
	});

	test("uses correct targets per mode", () => {
		const sunrisePlans = planner.planAllOptions(route, TEST_DATE, MT_TAM, "sunrise");
		const targets = sunrisePlans.map((p) => p.target);
		expect(targets).toContain("blueHourStart");
		expect(targets).toContain("sunrise");
		expect(targets).toContain("goldenHourEnd");

		const sunsetPlans = planner.planAllOptions(route, TEST_DATE, MT_TAM, "sunset");
		const sunsetTargets = sunsetPlans.map((p) => p.target);
		expect(sunsetTargets).toContain("goldenHourEveningStart");
		expect(sunsetTargets).toContain("sunset");
		expect(sunsetTargets).toContain("blueHourEveningEnd");
	});
});

describe("createSummary()", () => {
	const planner = createPlanner(mockConfig);

	test("includes primary plan for requested target", () => {
		const summary = planner.createSummary(route, TEST_DATE, "sunrise");
		expect(summary.plan.target).toBe("sunrise");
	});

	test("includes 2 alternatives (same mode, excluding primary)", () => {
		const summary = planner.createSummary(route, TEST_DATE, "sunrise");
		expect(summary.alternatives.length).toBe(2);
		const targets = summary.alternatives.map((a) => a.target);
		expect(targets).not.toContain("sunrise");
	});

	test("includes estimate from estimator", () => {
		const summary = planner.createSummary(route, TEST_DATE, "sunrise");
		expect(summary.estimate.label).toBe("mock");
		expect(summary.estimate.movingTime).toBeGreaterThan(0);
	});

	test("includes sunTimes and coordinates", () => {
		const summary = planner.createSummary(route, TEST_DATE, "sunrise");
		expect(summary.sunTimes).toBeDefined();
		expect(summary.sunTimes.sunrise).toBeInstanceOf(Date);
		expect(summary.coordinates).toBeDefined();
		expect(summary.coordinates.latitude).toBeGreaterThan(37);
	});
});

describe("getRouteEstimate()", () => {
	const planner = createPlanner(mockConfig);

	test("estimates for route-to-high-point only", () => {
		const fullEstimate = mockConfig.estimate(route.points, mockConfig.defaultParams());
		const routeEstimate = planner.getRouteEstimate(route);
		// Route to high point has fewer points than full route
		expect(routeEstimate.movingTime).toBeLessThanOrEqual(fullEstimate.movingTime);
	});

	test("uses default params when none given", () => {
		const est = planner.getRouteEstimate(route);
		expect(est.movingTime).toBeGreaterThan(0);
	});

	test("uses provided params when given", () => {
		const est1 = planner.getRouteEstimate(route, { speedFactor: 1 });
		const est2 = planner.getRouteEstimate(route, { speedFactor: 2 });
		expect(est2.movingTime).toBeGreaterThan(est1.movingTime);
	});
});
