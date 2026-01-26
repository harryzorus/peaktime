/**
 * Calibration tests: verify models against real-world reference data.
 *
 * These are not unit tests — they check that model outputs fall within
 * plausible ranges for known scenarios. If a model change causes these
 * to fail, it means the model has drifted from reality.
 */
import { describe, expect, test } from "vitest";
import { quickEstimate as bikeQuickEstimate } from "../../src/bike";
import type { RouteMetrics } from "../../src/hike";
import { estimateTime, munterTime, naismithTime } from "../../src/hike";
import { gapMultiplier, quickEstimate as runQuickEstimate } from "../../src/run";
import { calculateSunTimes } from "../../src/sun";

describe("Sun calibration", () => {
	test("San Francisco summer solstice 2025 sunrise ~5:48 AM PDT", () => {
		const times = calculateSunTimes(new Date("2025-06-21"), {
			latitude: 37.7749,
			longitude: -122.4194,
		});
		// Sunrise in UTC — PDT is UTC-7, so 5:48 AM PDT = 12:48 UTC
		const sunriseHourUTC = times.sunrise.getUTCHours() + times.sunrise.getUTCMinutes() / 60;
		expect(sunriseHourUTC).toBeGreaterThan(12); // after 12:00 UTC
		expect(sunriseHourUTC).toBeLessThan(13.5); // before 13:30 UTC
	});

	test("San Francisco winter solstice 2025 day length ~9.5 hours", () => {
		const times = calculateSunTimes(new Date("2025-12-21"), {
			latitude: 37.7749,
			longitude: -122.4194,
		});
		const dayLengthHours = times.dayLength / 60;
		expect(dayLengthHours).toBeGreaterThan(9);
		expect(dayLengthHours).toBeLessThan(10);
	});

	test("equator equinox day length ~12 hours", () => {
		const times = calculateSunTimes(new Date("2025-03-20"), {
			latitude: 0,
			longitude: 0,
		});
		const dayLengthHours = times.dayLength / 60;
		expect(dayLengthHours).toBeGreaterThan(11.5);
		expect(dayLengthHours).toBeLessThan(12.5);
	});
});

describe("Hiking calibration", () => {
	// Mt. Tam East Peak from Pantoll: ~3 km, ~480m gain
	const mtTamMetrics: RouteMetrics = {
		distance: 3000,
		elevationGain: 480,
		elevationLoss: 0,
		avgDescentGrade: 0,
		points: [],
	};

	test("Naismith: Mt. Tam to summit ~84 min for moderate hiker", () => {
		const time = naismithTime(3000, 480);
		expect(time).toBeGreaterThan(70);
		expect(time).toBeLessThan(100);
	});

	test("Munter: Mt. Tam to summit ~80-90 min", () => {
		const time = munterTime(3000, 480, 0);
		expect(time).toBeGreaterThan(70);
		expect(time).toBeLessThan(100);
	});

	test("athletic hiker does Mt. Tam in ~50-60 min", () => {
		const time = estimateTime(mtTamMetrics, "munter", "athletic");
		expect(time).toBeGreaterThan(40);
		expect(time).toBeLessThan(70);
	});

	test("leisurely hiker does Mt. Tam in ~100-130 min", () => {
		const time = estimateTime(mtTamMetrics, "munter", "leisurely");
		expect(time).toBeGreaterThan(90);
		expect(time).toBeLessThan(140);
	});
});

describe("Cycling calibration", () => {
	test("30 km flat ride: recreational ~60-90 min", () => {
		const time = bikeQuickEstimate(30_000, 0, 0, "recreational");
		expect(time).toBeGreaterThan(50);
		expect(time).toBeLessThan(100);
	});

	test("30 km flat ride: competitive ~45-60 min", () => {
		const time = bikeQuickEstimate(30_000, 0, 0, "competitive");
		expect(time).toBeGreaterThan(40);
		expect(time).toBeLessThan(65);
	});

	test("hilly 50 km ride (500m gain): trained ~100-150 min", () => {
		const time = bikeQuickEstimate(50_000, 500, 500, "trained");
		expect(time).toBeGreaterThan(80);
		expect(time).toBeLessThan(160);
	});

	test("pro cyclist 40 km flat TT ~50-55 min", () => {
		const time = bikeQuickEstimate(40_000, 0, 0, "pro", "tt", "smooth_pavement");
		expect(time).toBeGreaterThan(45);
		expect(time).toBeLessThan(60);
	});
});

describe("Running calibration", () => {
	test("10 km flat: trained runner ~45-55 min", () => {
		const time = runQuickEstimate(10_000, 0, 0, "trained", "road");
		expect(time).toBeGreaterThan(40);
		expect(time).toBeLessThan(60);
	});

	test("10 km flat: elite runner ~35-40 min", () => {
		const time = runQuickEstimate(10_000, 0, 0, "elite", "road");
		expect(time).toBeGreaterThan(33);
		expect(time).toBeLessThan(42);
	});

	test("half marathon: recreational ~120-150 min", () => {
		const time = runQuickEstimate(21_097, 0, 0, "recreational", "road");
		expect(time).toBeGreaterThan(110);
		expect(time).toBeLessThan(160);
	});

	test("GAP multiplier at 10% grade ~1.4-1.5x", () => {
		const mult = gapMultiplier(10);
		expect(mult).toBeGreaterThan(1.3);
		expect(mult).toBeLessThan(1.6);
	});

	test("trail 10 km with 500m gain: trained ~70-100 min", () => {
		const time = runQuickEstimate(10_000, 500, 500, "trained", "good_trail");
		expect(time).toBeGreaterThan(60);
		expect(time).toBeLessThan(110);
	});
});
