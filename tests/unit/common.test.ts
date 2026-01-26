/**
 * Common module tests — shared types and planner utilities
 */

import { describe, expect, test } from "vitest";
import {
	findHighPointIndex,
	formatStartTime,
	getDestinationCoordinates,
	getRouteToIndex,
	getTargetDescription,
	getTargetTime,
} from "../../src/common/planner";
import type { SunriseTarget, SunsetTarget, SunTarget } from "../../src/common/types";
import { isSunriseTarget, isSunsetTarget } from "../../src/common/types";
import type { GPXRoute } from "../../src/gpx/types";
import type { SunTimes } from "../../src/sun/types";

const ALL_SUNRISE_TARGETS: SunriseTarget[] = [
	"sunrise",
	"goldenHourStart",
	"goldenHourEnd",
	"blueHourStart",
	"blueHourEnd",
];

const ALL_SUNSET_TARGETS: SunsetTarget[] = [
	"sunset",
	"goldenHourEveningStart",
	"goldenHourEveningEnd",
	"blueHourEveningStart",
	"blueHourEveningEnd",
];

const ALL_TARGETS: SunTarget[] = [...ALL_SUNRISE_TARGETS, ...ALL_SUNSET_TARGETS];

describe("SunTarget predicates", () => {
	test("isSunriseTarget returns true for all 5 morning targets", () => {
		for (const target of ALL_SUNRISE_TARGETS) {
			expect(isSunriseTarget(target)).toBe(true);
		}
	});

	test("isSunriseTarget returns false for all 5 evening targets", () => {
		for (const target of ALL_SUNSET_TARGETS) {
			expect(isSunriseTarget(target)).toBe(false);
		}
	});

	test("isSunsetTarget returns true for all 5 evening targets", () => {
		for (const target of ALL_SUNSET_TARGETS) {
			expect(isSunsetTarget(target)).toBe(true);
		}
	});

	test("isSunsetTarget returns false for all 5 morning targets", () => {
		for (const target of ALL_SUNRISE_TARGETS) {
			expect(isSunsetTarget(target)).toBe(false);
		}
	});

	test("every SunTarget is either sunrise or sunset (exhaustive)", () => {
		for (const target of ALL_TARGETS) {
			const isSunrise = isSunriseTarget(target);
			const isSunset = isSunsetTarget(target);
			// Exactly one must be true
			expect(isSunrise !== isSunset).toBe(true);
		}
	});
});

// ─── Test fixtures ───────────────────────────────────────────

/** Minimal SunTimes for testing getTargetTime */
const MOCK_SUN_TIMES: SunTimes = {
	date: new Date("2026-01-26T12:00:00Z"),
	coordinates: { latitude: 37.9, longitude: -122.6 },
	sunrise: new Date("2026-01-26T15:17:00Z"),
	sunset: new Date("2026-01-27T01:24:00Z"),
	solarNoon: new Date("2026-01-26T20:20:00Z"),
	civilTwilightStart: new Date("2026-01-26T14:49:00Z"),
	civilTwilightEnd: new Date("2026-01-27T01:52:00Z"),
	nauticalTwilightStart: new Date("2026-01-26T14:18:00Z"),
	nauticalTwilightEnd: new Date("2026-01-27T02:23:00Z"),
	astronomicalTwilightStart: new Date("2026-01-26T13:48:00Z"),
	astronomicalTwilightEnd: new Date("2026-01-27T02:53:00Z"),
	goldenHourMorningStart: new Date("2026-01-26T15:17:00Z"),
	goldenHourMorningEnd: new Date("2026-01-26T15:50:00Z"),
	goldenHourEveningStart: new Date("2026-01-27T00:51:00Z"),
	goldenHourEveningEnd: new Date("2026-01-27T01:24:00Z"),
	blueHourMorningStart: new Date("2026-01-26T14:49:00Z"),
	blueHourMorningEnd: new Date("2026-01-26T15:03:00Z"),
	blueHourEveningStart: new Date("2026-01-27T01:38:00Z"),
	blueHourEveningEnd: new Date("2026-01-27T01:52:00Z"),
	dayLength: 607,
};

const ASCENDING_ROUTE: GPXRoute = {
	metadata: { name: "Test ascending", type: "hiking" },
	points: [
		{ lat: 37.9, lon: -122.5, ele: 100 },
		{ lat: 37.91, lon: -122.5, ele: 200 },
		{ lat: 37.92, lon: -122.5, ele: 300 },
	],
};

const VALLEY_PEAK_ROUTE: GPXRoute = {
	metadata: { name: "Test valley-peak", type: "hiking" },
	points: [
		{ lat: 37.9, lon: -122.5, ele: 200 },
		{ lat: 37.91, lon: -122.5, ele: 100 },
		{ lat: 37.92, lon: -122.5, ele: 500 },
		{ lat: 37.93, lon: -122.5, ele: 300 },
	],
};

// ─── Planner utility tests ──────────────────────────────────

describe("getTargetTime", () => {
	test("returns sunrise for 'sunrise' and 'goldenHourStart'", () => {
		expect(getTargetTime(MOCK_SUN_TIMES, "sunrise")).toEqual(MOCK_SUN_TIMES.sunrise);
		expect(getTargetTime(MOCK_SUN_TIMES, "goldenHourStart")).toEqual(MOCK_SUN_TIMES.sunrise);
	});

	test("returns goldenHourMorningEnd for 'goldenHourEnd'", () => {
		expect(getTargetTime(MOCK_SUN_TIMES, "goldenHourEnd")).toEqual(
			MOCK_SUN_TIMES.goldenHourMorningEnd,
		);
	});

	test("returns civilTwilightStart for 'blueHourStart'", () => {
		expect(getTargetTime(MOCK_SUN_TIMES, "blueHourStart")).toEqual(
			MOCK_SUN_TIMES.civilTwilightStart,
		);
	});

	test("returns correct times for all 5 evening targets", () => {
		expect(getTargetTime(MOCK_SUN_TIMES, "sunset")).toEqual(MOCK_SUN_TIMES.sunset);
		expect(getTargetTime(MOCK_SUN_TIMES, "goldenHourEveningEnd")).toEqual(MOCK_SUN_TIMES.sunset);
		expect(getTargetTime(MOCK_SUN_TIMES, "goldenHourEveningStart")).toEqual(
			MOCK_SUN_TIMES.goldenHourEveningStart,
		);
		expect(getTargetTime(MOCK_SUN_TIMES, "blueHourEveningStart")).toEqual(
			MOCK_SUN_TIMES.blueHourEveningStart,
		);
		expect(getTargetTime(MOCK_SUN_TIMES, "blueHourEveningEnd")).toEqual(
			MOCK_SUN_TIMES.civilTwilightEnd,
		);
	});

	test("handles all 10 SunTarget values exhaustively", () => {
		for (const target of ALL_TARGETS) {
			const time = getTargetTime(MOCK_SUN_TIMES, target);
			expect(time).toBeInstanceOf(Date);
		}
	});
});

describe("getTargetDescription", () => {
	test("returns non-empty string for all 10 targets", () => {
		for (const target of ALL_TARGETS) {
			const desc = getTargetDescription(target);
			expect(desc.length).toBeGreaterThan(0);
		}
	});
});

describe("findHighPointIndex", () => {
	test("finds highest point in ascending route", () => {
		expect(findHighPointIndex(ASCENDING_ROUTE)).toBe(2);
	});

	test("finds highest point in valley-then-peak route", () => {
		expect(findHighPointIndex(VALLEY_PEAK_ROUTE)).toBe(2);
	});

	test("returns first occurrence of max elevation", () => {
		const route: GPXRoute = {
			metadata: { name: "Tie", type: "hiking" },
			points: [
				{ lat: 37.9, lon: -122.5, ele: 500 },
				{ lat: 37.91, lon: -122.5, ele: 300 },
				{ lat: 37.92, lon: -122.5, ele: 500 },
			],
		};
		expect(findHighPointIndex(route)).toBe(0);
	});

	test("throws for empty route", () => {
		const empty: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [],
		};
		expect(() => findHighPointIndex(empty)).toThrow();
	});
});

describe("getRouteToIndex", () => {
	test("slices route from 0 to endIndex inclusive", () => {
		const sub = getRouteToIndex(VALLEY_PEAK_ROUTE, 2);
		expect(sub.points.length).toBe(3);
		expect(sub.points[0]).toEqual(VALLEY_PEAK_ROUTE.points[0]);
		expect(sub.points[2]).toEqual(VALLEY_PEAK_ROUTE.points[2]);
	});

	test("preserves metadata", () => {
		const sub = getRouteToIndex(VALLEY_PEAK_ROUTE, 1);
		expect(sub.metadata).toEqual(VALLEY_PEAK_ROUTE.metadata);
	});
});

describe("getDestinationCoordinates", () => {
	test("returns lat/lon of highest point as Coordinates", () => {
		const coords = getDestinationCoordinates(ASCENDING_ROUTE);
		// Highest point is index 2: lat=37.92, lon=-122.5
		expect(coords.latitude).toBe(37.92);
		expect(coords.longitude).toBe(-122.5);
	});

	test("throws for empty route", () => {
		const empty: GPXRoute = {
			metadata: { name: "Empty", type: "unknown" },
			points: [],
		};
		expect(() => getDestinationCoordinates(empty)).toThrow();
	});
});

describe("formatStartTime", () => {
	test("formats with timezone", () => {
		const date = new Date("2026-01-26T15:30:00Z");
		const formatted = formatStartTime(date, "America/Los_Angeles");
		expect(formatted).toMatch(/7:30\s*AM/i);
	});

	test("defaults to UTC", () => {
		const date = new Date("2026-01-26T15:30:00Z");
		const formatted = formatStartTime(date);
		expect(formatted).toMatch(/3:30\s*PM/i);
	});
});
