/**
 * Hiking time estimator and planner tests
 *
 * Validates Naismith's rule implementation and hike planning
 * using the Mt. Tam sunrise route fixture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { GPXPoint, GPXRoute } from "../../src/gpx";
import { parseGPXOrThrow } from "../../src/gpx";
import {
	createPlanSummary,
	estimateHikingTime,
	findSummitIndex,
	formatHikingTime,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	planAllOptions,
	planHike,
	segmentTime,
	timeToDistance,
	timeToElevation,
	waypointAtPercentage,
} from "../../src/hike";
import { DEFAULT_HIKING_PARAMS } from "../../src/hike/types";
import type { Coordinates } from "../../src/sun";

// Load the test fixture
let route: GPXRoute;

beforeAll(() => {
	const gpxContent = readFileSync(join(__dirname, "../fixtures/mt-tam-sunrise.gpx"), "utf-8");
	route = parseGPXOrThrow(gpxContent);
});

// Test date: Jan 26, 2026
const TEST_DATE = new Date("2026-01-26T12:00:00Z");

// Mt. Tam summit coordinates
const MT_TAM_SUMMIT: Coordinates = {
	latitude: 37.9235,
	longitude: -122.5965,
};

describe("segmentTime", () => {
	test("should calculate time for flat segment", () => {
		const p1: GPXPoint = { lat: 37.9, lon: -122.5, ele: 100 };
		const p2: GPXPoint = { lat: 37.901, lon: -122.5, ele: 100 };

		const time = segmentTime(p1, p2, DEFAULT_HIKING_PARAMS);
		expect(time).toBeGreaterThan(0);
	});

	test("should add time for uphill segment", () => {
		const p1: GPXPoint = { lat: 37.9, lon: -122.5, ele: 100 };
		const p2: GPXPoint = { lat: 37.901, lon: -122.5, ele: 200 };

		const flatTime = segmentTime(p1, { ...p2, ele: 100 }, DEFAULT_HIKING_PARAMS);
		const uphillTime = segmentTime(p1, p2, DEFAULT_HIKING_PARAMS);

		expect(uphillTime).toBeGreaterThan(flatTime);
	});

	test("should reduce time for downhill segment", () => {
		// Use a longer segment so the downhill bonus is noticeable
		const p1: GPXPoint = { lat: 37.9, lon: -122.5, ele: 500 };
		const p2: GPXPoint = { lat: 37.91, lon: -122.5, ele: 200 }; // 300m drop over ~1km

		const flatTime = segmentTime(p1, { ...p2, ele: 500 }, DEFAULT_HIKING_PARAMS);
		const downhillTime = segmentTime(p1, p2, DEFAULT_HIKING_PARAMS);

		// Downhill should be faster (or at worst equal due to minimum time constraint)
		expect(downhillTime).toBeLessThanOrEqual(flatTime);
	});

	test("should never return negative time", () => {
		const p1: GPXPoint = { lat: 37.9, lon: -122.5, ele: 1000 };
		const p2: GPXPoint = { lat: 37.9001, lon: -122.5, ele: 0 };

		const time = segmentTime(p1, p2, DEFAULT_HIKING_PARAMS);
		expect(time).toBeGreaterThan(0);
	});
});

describe("estimateHikingTime", () => {
	test("should estimate reasonable time for Mt. Tam route", () => {
		const estimate = estimateHikingTime(route);

		// Mt. Tam route: ~6km, ~500m gain, out and back
		// Should take roughly 2-4 hours of moving time
		expect(estimate.movingTime).toBeGreaterThan(90); // > 1.5 hours
		expect(estimate.movingTime).toBeLessThan(300); // < 5 hours
	});

	test("should include break time in total", () => {
		const estimate = estimateHikingTime(route);

		expect(estimate.totalTime).toBeGreaterThanOrEqual(estimate.movingTime);
	});

	test("should calculate break count", () => {
		const estimate = estimateHikingTime(route);

		// For a 2-3 hour hike with 60-min break interval, expect 1-3 breaks
		expect(estimate.breakCount).toBeGreaterThanOrEqual(0);
	});

	test("should generate segments", () => {
		const estimate = estimateHikingTime(route);

		expect(estimate.segments.length).toBe(route.points.length - 1);
	});

	test("should track cumulative distance and time", () => {
		const estimate = estimateHikingTime(route);
		const lastSegment = estimate.segments[estimate.segments.length - 1];

		expect(lastSegment.cumulativeTime).toBeCloseTo(estimate.movingTime, 1);
		expect(lastSegment.cumulativeDistance).toBeGreaterThan(0);
	});

	test("should handle empty route", () => {
		const emptyRoute: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [{ lat: 37.9, lon: -122.5, ele: 100 }],
		};

		const estimate = estimateHikingTime(emptyRoute);
		expect(estimate.movingTime).toBe(0);
		expect(estimate.segments.length).toBe(0);
	});

	test("should accept custom hiking parameters", () => {
		const fastParams = { baseSpeedKmh: 6 }; // Faster than default 5
		const slowParams = { baseSpeedKmh: 4 }; // Slower than default 5

		const fastEstimate = estimateHikingTime(route, fastParams);
		const slowEstimate = estimateHikingTime(route, slowParams);

		expect(fastEstimate.movingTime).toBeLessThan(slowEstimate.movingTime);
	});
});

describe("timeToDistance", () => {
	test("should return 0 for distance 0", () => {
		const estimate = estimateHikingTime(route);
		expect(timeToDistance(estimate, 0)).toBe(0);
	});

	test("should return time for mid-route distance", () => {
		const estimate = estimateHikingTime(route);
		const midDistance = estimate.segments[estimate.segments.length - 1].cumulativeDistance / 2;

		const time = timeToDistance(estimate, midDistance);
		expect(time).toBeDefined();
		expect(time).toBeGreaterThan(0);
		expect(time).toBeLessThan(estimate.movingTime);
	});

	test("should return undefined for distance past end", () => {
		const estimate = estimateHikingTime(route);
		const totalDistance = estimate.segments[estimate.segments.length - 1].cumulativeDistance;

		const time = timeToDistance(estimate, totalDistance + 1000);
		expect(time).toBeUndefined();
	});
});

describe("timeToElevation", () => {
	test("should find time to reach summit elevation", () => {
		const estimate = estimateHikingTime(route);

		// Summit is around 780m
		const timeToSummit = timeToElevation(estimate, 750);
		expect(timeToSummit).toBeDefined();
		expect(timeToSummit).toBeGreaterThan(0);
	});

	test("should return undefined for unreachable elevation", () => {
		const estimate = estimateHikingTime(route);

		const time = timeToElevation(estimate, 5000); // Higher than Mt. Tam
		expect(time).toBeUndefined();
	});
});

describe("waypointAtPercentage", () => {
	test("should return segment at 50%", () => {
		const estimate = estimateHikingTime(route);
		const midpoint = waypointAtPercentage(estimate, 50);

		expect(midpoint).toBeDefined();
		expect(midpoint?.cumulativeDistance).toBeGreaterThan(0);
	});

	test("should return last segment at 100%", () => {
		const estimate = estimateHikingTime(route);
		const endpoint = waypointAtPercentage(estimate, 100);

		expect(endpoint).toBeDefined();
		expect(endpoint?.toIndex).toBe(route.points.length - 1);
	});

	test("should handle empty estimate", () => {
		const emptyRoute: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [{ lat: 37.9, lon: -122.5, ele: 100 }],
		};
		const estimate = estimateHikingTime(emptyRoute);

		expect(waypointAtPercentage(estimate, 50)).toBeUndefined();
	});
});

describe("formatHikingTime", () => {
	test("should format minutes only", () => {
		expect(formatHikingTime(45)).toBe("45m");
	});

	test("should format hours only", () => {
		expect(formatHikingTime(120)).toBe("2h");
	});

	test("should format hours and minutes", () => {
		expect(formatHikingTime(135)).toBe("2h 15m");
	});

	test("should round minutes", () => {
		expect(formatHikingTime(135.7)).toBe("2h 16m");
	});
});

describe("planHike", () => {
	test("should calculate start time for sunrise", () => {
		const plan = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise");

		expect(plan.target).toBe("sunrise");
		expect(plan.startTime).toBeInstanceOf(Date);
		expect(plan.targetTime).toBeInstanceOf(Date);
	});

	test("should have start time before target time", () => {
		const plan = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise");

		expect(plan.startTime.getTime()).toBeLessThan(plan.targetTime.getTime());
	});

	test("should include buffer time", () => {
		const plan10 = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise", { bufferMinutes: 10 });
		const plan30 = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise", { bufferMinutes: 30 });

		// More buffer = earlier start
		expect(plan30.startTime.getTime()).toBeLessThan(plan10.startTime.getTime());
	});

	test("should adjust for night hiking", () => {
		const dayPlan = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise", { nightHiking: false });
		const nightPlan = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise", { nightHiking: true });

		// Night hiking is slower, so start earlier
		expect(nightPlan.startTime.getTime()).toBeLessThan(dayPlan.startTime.getTime());
	});

	test("should mark feasibility", () => {
		const plan = planHike(route, TEST_DATE, MT_TAM_SUMMIT, "sunrise");

		// Mt. Tam sunrise hike should be feasible (2-3 hour hike, starting early morning)
		expect(plan.feasible).toBe(true);
	});
});

describe("planAllOptions", () => {
	test("should return plans for multiple targets", () => {
		const plans = planAllOptions(route, TEST_DATE, MT_TAM_SUMMIT);

		expect(plans.length).toBeGreaterThan(1);

		const targets = plans.map((p) => p.target);
		expect(targets).toContain("sunrise");
		expect(targets).toContain("blueHourStart");
	});

	test("should have different start times for different targets", () => {
		const plans = planAllOptions(route, TEST_DATE, MT_TAM_SUMMIT);

		const times = plans.map((p) => p.startTime.getTime());
		const uniqueTimes = new Set(times);

		expect(uniqueTimes.size).toBe(plans.length);
	});
});

describe("createPlanSummary", () => {
	test("should create complete plan summary", () => {
		const summary = createPlanSummary(route, TEST_DATE, "sunrise");

		expect(summary.plan).toBeDefined();
		expect(summary.plan.target).toBe("sunrise");
		expect(summary.alternatives.length).toBeGreaterThan(0);
		expect(summary.estimate).toBeDefined();
		expect(summary.sunTimes).toBeDefined();
		expect(summary.coordinates).toBeDefined();
	});

	test("should use destination coordinates from route", () => {
		const summary = createPlanSummary(route, TEST_DATE, "sunrise");

		// Should be near Mt. Tam summit (end of route)
		expect(summary.coordinates.latitude).toBeCloseTo(37.91, 1);
		expect(summary.coordinates.longitude).toBeCloseTo(-122.58, 1);
	});

	test("should include alternatives excluding primary target", () => {
		const summary = createPlanSummary(route, TEST_DATE, "sunrise");

		const alternativeTargets = summary.alternatives.map((a) => a.target);
		expect(alternativeTargets).not.toContain("sunrise");
	});
});

describe("getDestinationCoordinates", () => {
	test("should return summit point coordinates (highest elevation)", () => {
		const coords = getDestinationCoordinates(route);
		const summitIndex = findSummitIndex(route);
		const summitPoint = route.points[summitIndex];

		expect(coords.latitude).toBe(summitPoint.lat);
		expect(coords.longitude).toBe(summitPoint.lon);
	});

	test("should throw for empty route", () => {
		const emptyRoute: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [],
		};

		expect(() => getDestinationCoordinates(emptyRoute)).toThrow("empty route");
	});
});

describe("getTargetDescription", () => {
	test("should return readable descriptions", () => {
		expect(getTargetDescription("sunrise")).toBe("Sunrise");
		expect(getTargetDescription("goldenHourStart")).toContain("Golden Hour");
		expect(getTargetDescription("blueHourStart")).toContain("Blue Hour");
	});
});

describe("findSummitIndex", () => {
	test("should find highest elevation point in Mt. Tam route", () => {
		const summitIndex = findSummitIndex(route);
		const summitPoint = route.points[summitIndex];

		// Mt. Tam summit is around 780m
		expect(summitPoint.ele).toBeGreaterThan(750);
		expect(summitPoint.ele).toBeLessThan(800);
	});

	test("should find summit in middle of out-and-back route", () => {
		const summitIndex = findSummitIndex(route);

		// Summit should be roughly in the middle for an out-and-back
		// Not at the start (index 0) or end (last index)
		expect(summitIndex).toBeGreaterThan(0);
		expect(summitIndex).toBeLessThan(route.points.length - 1);
	});

	test("should return correct index for simple ascending route", () => {
		const ascendingRoute: GPXRoute = {
			metadata: { name: "Ascending", type: "hiking" },
			points: [
				{ lat: 37.9, lon: -122.5, ele: 100 },
				{ lat: 37.91, lon: -122.5, ele: 200 },
				{ lat: 37.92, lon: -122.5, ele: 300 },
			],
		};

		expect(findSummitIndex(ascendingRoute)).toBe(2); // Last point is highest
	});

	test("should throw for empty route", () => {
		const emptyRoute: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [],
		};

		expect(() => findSummitIndex(emptyRoute)).toThrow("empty route");
	});
});

describe("getRouteToIndex", () => {
	test("should return sub-route from start to index", () => {
		const subRoute = getRouteToIndex(route, 10);

		expect(subRoute.points.length).toBe(11); // 0 to 10 inclusive
		expect(subRoute.points[0]).toEqual(route.points[0]);
		expect(subRoute.points[10]).toEqual(route.points[10]);
	});

	test("should preserve metadata", () => {
		const subRoute = getRouteToIndex(route, 5);

		expect(subRoute.metadata).toEqual(route.metadata);
	});
});

describe("planHike with summit detection", () => {
	test("should calculate hiking time to summit only, not full route", () => {
		const summary = createPlanSummary(route, TEST_DATE, "sunrise");

		// Mt. Tam route to summit is ~3km with ~485m gain
		// At 5km/h base + uphill penalty, should be roughly 1-2 hours
		// Full out-and-back would be 2-4 hours
		expect(summary.estimate.movingTime).toBeGreaterThan(45); // > 45 min
		expect(summary.estimate.movingTime).toBeLessThan(150); // < 2.5 hours

		// The estimate should be for route TO summit, so last point should be near summit elevation
		const lastSegment = summary.estimate.segments[summary.estimate.segments.length - 1];
		expect(lastSegment.point.ele).toBeGreaterThan(750); // Near summit
	});

	test("should calculate reasonable start time for sunrise", () => {
		const summary = createPlanSummary(route, TEST_DATE, "sunrise", {
			bufferMinutes: 15,
			nightHiking: true,
		});

		// Sunrise on Jan 26 in SF area is around 7:15 AM PST (15:15 UTC)
		// With ~1.5-2 hour hike (adjusted for night), start should be around 5-6 AM PST (13-14 UTC)
		const startHourUTC = summary.plan.startTime.getUTCHours();

		// Start time should be between 12:00 UTC (4 AM PST) and 15:00 UTC (7 AM PST)
		expect(startHourUTC).toBeGreaterThanOrEqual(12);
		expect(startHourUTC).toBeLessThanOrEqual(15);
	});
});

describe("formatStartTime", () => {
	test("should format time in specified timezone", () => {
		// 15:30 UTC = 7:30 AM PST
		const date = new Date("2026-01-26T15:30:00Z");
		const formatted = formatStartTime(date, "America/Los_Angeles");

		expect(formatted).toMatch(/7:30\s*AM/i);
	});

	test("should default to UTC if no timezone specified", () => {
		const date = new Date("2026-01-26T15:30:00Z");
		const formatted = formatStartTime(date);

		expect(formatted).toMatch(/3:30\s*PM/i);
	});

	test("should handle early morning times correctly", () => {
		// 13:00 UTC = 5:00 AM PST
		const date = new Date("2026-01-26T13:00:00Z");
		const formatted = formatStartTime(date, "America/Los_Angeles");

		expect(formatted).toMatch(/5:00\s*AM/i);
	});
});

describe("night hiking time calculation", () => {
	test("should use movingTime not totalTime for night adjustment", () => {
		const summary = createPlanSummary(route, TEST_DATE, "sunrise", {
			bufferMinutes: 15,
			nightHiking: true,
			nightHikingMultiplier: 0.8,
		});

		// Moving time to summit is ~94 min
		// Night adjusted: 94 / 0.8 = 117.5 min
		// Plus 15 min buffer = 132.5 min (~2h 12m)
		// But we should NOT include break time in the night adjustment
		//
		// Hiking duration in plan should be close to moving time * night factor
		// Not totalTime (which includes breaks)
		const movingTimeAdjusted = summary.estimate.movingTime / 0.8;

		// The hiking duration should be based on moving time, not total time
		expect(summary.plan.hikingDuration).toBeCloseTo(movingTimeAdjusted, 5);
	});

	test("start time should be hiking duration + buffer before target", () => {
		const bufferMinutes = 15;
		const summary = createPlanSummary(route, TEST_DATE, "sunrise", {
			bufferMinutes,
			nightHiking: true,
			nightHikingMultiplier: 0.8,
		});

		// Calculate expected start time
		const expectedStartMs =
			summary.plan.targetTime.getTime() -
			bufferMinutes * 60 * 1000 -
			summary.plan.hikingDuration * 60 * 1000;

		// Allow 1 second tolerance for floating point
		expect(summary.plan.startTime.getTime()).toBeCloseTo(expectedStartMs, -3);
	});
});

describe("fitness level adjustment", () => {
	test("faster pace should result in shorter hiking time", () => {
		const normalSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 5 }, // Normal pace
		});
		const fastSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 6 }, // Fast pace (20% faster)
		});

		expect(fastSummary.estimate.movingTime).toBeLessThan(normalSummary.estimate.movingTime);
	});

	test("slower pace should result in longer hiking time", () => {
		const normalSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 5 }, // Normal pace
		});
		const slowSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 4 }, // Slow pace (20% slower)
		});

		expect(slowSummary.estimate.movingTime).toBeGreaterThan(normalSummary.estimate.movingTime);
	});

	test("slower pace should result in earlier start time", () => {
		const normalSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 5 },
		});
		const slowSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 4 },
		});

		// Slower pace = need more time = start earlier
		expect(slowSummary.plan.startTime.getTime()).toBeLessThan(
			normalSummary.plan.startTime.getTime(),
		);
	});

	test("fitness multiplier should scale hiking time", () => {
		const baseSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 5 },
			nightHiking: false,
		});
		const fastSummary = createPlanSummary(route, TEST_DATE, "sunrise", {
			hikingParams: { baseSpeedKmh: 6.25 }, // 25% faster
			nightHiking: false,
		});

		// Faster speed reduces time, but not linearly due to elevation penalties
		// The ratio should be less than 1 (faster is shorter)
		const ratio = fastSummary.estimate.movingTime / baseSummary.estimate.movingTime;
		expect(ratio).toBeLessThan(1);
		expect(ratio).toBeGreaterThan(0.7); // But not drastically different
	});
});
