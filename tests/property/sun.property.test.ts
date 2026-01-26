import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { calculateSunTimes, getTwilightPhase } from "../../src/sun";

// Constrain to latitudes where sun rises/sets normally (avoid polar extremes)
const latitude = fc.double({ min: -60, max: 60, noNaN: true });
const longitude = fc.double({ min: -180, max: 180, noNaN: true });
const coords = fc.record({ latitude, longitude });

// Dates within NOAA algorithm valid range (1901-2099)
const date = fc.date({ min: new Date("1950-01-01"), max: new Date("2050-12-31") });

const NUM_RUNS = 500;

describe("Sun property tests", () => {
	test("sunrise < solar noon < sunset", () => {
		fc.assert(
			fc.property(date, coords, (d, c) => {
				const times = calculateSunTimes(d, c);
				expect(times.sunrise.getTime()).toBeLessThan(times.solarNoon.getTime());
				expect(times.solarNoon.getTime()).toBeLessThan(times.sunset.getTime());
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("day length is between 0 and 24 hours", () => {
		fc.assert(
			fc.property(date, coords, (d, c) => {
				const times = calculateSunTimes(d, c);
				expect(times.dayLength).toBeGreaterThanOrEqual(0);
				expect(times.dayLength).toBeLessThanOrEqual(24 * 60);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("twilight ordering: astronomical < nautical < civil < sunrise < noon", () => {
		fc.assert(
			fc.property(date, coords, (d, c) => {
				const t = calculateSunTimes(d, c);
				expect(t.astronomicalTwilightStart.getTime()).toBeLessThanOrEqual(
					t.nauticalTwilightStart.getTime(),
				);
				expect(t.nauticalTwilightStart.getTime()).toBeLessThanOrEqual(
					t.civilTwilightStart.getTime(),
				);
				expect(t.civilTwilightStart.getTime()).toBeLessThanOrEqual(t.sunrise.getTime());
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("golden hour is within civil twilight window", () => {
		fc.assert(
			fc.property(date, coords, (d, c) => {
				const t = calculateSunTimes(d, c);
				// Morning golden hour starts at sunrise, ends after sunrise
				expect(t.goldenHourMorningStart.getTime()).toBeGreaterThanOrEqual(
					t.civilTwilightStart.getTime(),
				);
				// Evening golden hour ends at sunset, which is before civil twilight end
				expect(t.goldenHourEveningEnd.getTime()).toBeLessThanOrEqual(t.civilTwilightEnd.getTime());
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("getTwilightPhase returns valid phase for any elevation", () => {
		fc.assert(
			fc.property(fc.double({ min: -90, max: 90, noNaN: true }), (elevation) => {
				const phase = getTwilightPhase(elevation);
				expect(["day", "golden", "civil", "nautical", "astronomical", "night"]).toContain(phase);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("getTwilightPhase is monotonic with elevation", () => {
		const phases = ["night", "astronomical", "nautical", "civil", "golden", "day"];
		fc.assert(
			fc.property(
				fc.double({ min: -90, max: 90, noNaN: true }),
				fc.double({ min: 0.1, max: 10, noNaN: true }),
				(elevation, delta) => {
					const lowerPhase = getTwilightPhase(elevation);
					const higherPhase = getTwilightPhase(elevation + delta);
					expect(phases.indexOf(higherPhase)).toBeGreaterThanOrEqual(phases.indexOf(lowerPhase));
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});
});
