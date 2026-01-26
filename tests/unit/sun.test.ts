/**
 * Sun calculations tests
 *
 * Validates calculations against known values for Mt. Tamalpais
 */

import { describe, expect, test } from "vitest";
import type { Coordinates } from "../../src/sun";
import { calculateSunTimes, formatSunTime, getSunPosition, getTwilightPhase } from "../../src/sun";

// Mt. Tam East Peak coordinates
const MT_TAM: Coordinates = {
	latitude: 37.9235,
	longitude: -122.5965,
};

// Jan 26, 2026 - test date
const TEST_DATE = new Date("2026-01-26T12:00:00Z");

describe("calculateSunTimes", () => {
	test("should calculate sunrise in reasonable range for Mt. Tam in January", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);

		// Sunrise should be between 7-8 AM PST (15-16 UTC) in late January
		const sunriseHourUTC = times.sunrise.getUTCHours();
		expect(sunriseHourUTC).toBeGreaterThanOrEqual(14);
		expect(sunriseHourUTC).toBeLessThanOrEqual(16);
	});

	test("should calculate sunset in reasonable range for Mt. Tam in January", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);

		// Sunset should be around 5:30 PM PST (1:30 UTC next day) in late January
		const sunsetHourUTC = times.sunset.getUTCHours();
		expect(sunsetHourUTC).toBeGreaterThanOrEqual(0);
		expect(sunsetHourUTC).toBeLessThanOrEqual(3);
	});

	test("should have sunrise before sunset", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.sunrise.getTime()).toBeLessThan(times.sunset.getTime());
	});

	test("should have solar noon between sunrise and sunset", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.solarNoon.getTime()).toBeGreaterThan(times.sunrise.getTime());
		expect(times.solarNoon.getTime()).toBeLessThan(times.sunset.getTime());
	});

	test("should have civil twilight before sunrise", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.civilTwilightStart.getTime()).toBeLessThan(times.sunrise.getTime());
	});

	test("should have nautical twilight before civil twilight", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.nauticalTwilightStart.getTime()).toBeLessThan(times.civilTwilightStart.getTime());
	});

	test("should have golden hour end after sunrise", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.goldenHourMorningEnd.getTime()).toBeGreaterThan(times.sunrise.getTime());
	});

	test("should calculate reasonable day length for January", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		// Day length in January at this latitude should be ~10 hours
		expect(times.dayLength).toBeGreaterThan(9 * 60);
		expect(times.dayLength).toBeLessThan(11 * 60);
	});

	test("should store input coordinates", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.coordinates).toEqual(MT_TAM);
	});
});

describe("getSunPosition", () => {
	test("should return high elevation at solar noon", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		const position = getSunPosition(times.solarNoon, MT_TAM);

		// At solar noon, sun should be at its highest
		expect(position.elevation).toBeGreaterThan(20);
		expect(position.elevation).toBeLessThan(60);
	});

	test("should return ~0 elevation at sunrise", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		const position = getSunPosition(times.sunrise, MT_TAM);

		// At sunrise, elevation should be near 0 (accounting for refraction)
		expect(position.elevation).toBeGreaterThan(-2);
		expect(position.elevation).toBeLessThan(2);
	});

	test("should return azimuth in valid range", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		const position = getSunPosition(times.solarNoon, MT_TAM);

		expect(position.azimuth).toBeGreaterThanOrEqual(0);
		expect(position.azimuth).toBeLessThanOrEqual(360);
	});
});

describe("getTwilightPhase", () => {
	test("should return day for high elevation", () => {
		expect(getTwilightPhase(45)).toBe("day");
		expect(getTwilightPhase(10)).toBe("day");
	});

	test("should return golden for low positive elevation", () => {
		expect(getTwilightPhase(3)).toBe("golden");
		expect(getTwilightPhase(0.5)).toBe("golden");
	});

	test("should return civil for small negative elevation", () => {
		expect(getTwilightPhase(-3)).toBe("civil");
		expect(getTwilightPhase(-5)).toBe("civil");
	});

	test("should return nautical for medium negative elevation", () => {
		expect(getTwilightPhase(-8)).toBe("nautical");
		expect(getTwilightPhase(-11)).toBe("nautical");
	});

	test("should return astronomical for large negative elevation", () => {
		expect(getTwilightPhase(-15)).toBe("astronomical");
		expect(getTwilightPhase(-17)).toBe("astronomical");
	});

	test("should return night for very negative elevation", () => {
		expect(getTwilightPhase(-20)).toBe("night");
		expect(getTwilightPhase(-45)).toBe("night");
	});
});

describe("formatSunTime", () => {
	test("should format time in 12-hour format", () => {
		const date = new Date("2026-01-26T15:30:00Z");
		const formatted = formatSunTime(date, "UTC");
		expect(formatted).toMatch(/3:30\s*PM/i);
	});

	test("should handle different timezones", () => {
		const date = new Date("2026-01-26T15:30:00Z");
		const pst = formatSunTime(date, "America/Los_Angeles");
		// 15:30 UTC = 7:30 AM PST
		expect(pst).toMatch(/7:30\s*AM/i);
	});
});

describe("Edge Cases", () => {
	test("should handle equator location", () => {
		const equator: Coordinates = { latitude: 0, longitude: 0 };
		const times = calculateSunTimes(TEST_DATE, equator);

		expect(times.sunrise).toBeInstanceOf(Date);
		expect(times.sunset).toBeInstanceOf(Date);
		expect(times.dayLength).toBeGreaterThan(0);
	});

	test("should handle high latitude location", () => {
		const arctic: Coordinates = { latitude: 65, longitude: 0 };
		const times = calculateSunTimes(TEST_DATE, arctic);

		// Should still calculate something (not polar night in January at 65N)
		expect(times.sunrise).toBeInstanceOf(Date);
		expect(times.dayLength).toBeLessThan(10 * 60); // Short day
	});

	test("should handle negative longitude (western hemisphere)", () => {
		const times = calculateSunTimes(TEST_DATE, MT_TAM);
		expect(times.sunrise).toBeInstanceOf(Date);
	});
});
