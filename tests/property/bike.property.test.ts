import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { BikeFitnessLevel } from "../../src/bike";
import {
	BIKE_FITNESS_LEVELS,
	getDefaultCyclingParams,
	intensityFromGrade,
	quickEstimate,
	speedFromPowerClimb,
	speedFromPowerFull,
} from "../../src/bike";

const NUM_RUNS = 500;

const gradePercent = fc.double({ min: -20, max: 20, noNaN: true });
const power = fc.double({ min: 50, max: 500, noNaN: true });
const mass = fc.double({ min: 50, max: 120, noNaN: true });
const crr = fc.double({ min: 0.002, max: 0.02, noNaN: true });

describe("Bike property tests", () => {
	test("intensityFromGrade is between 0 and 1", () => {
		fc.assert(
			fc.property(gradePercent, (grade) => {
				const intensity = intensityFromGrade(grade);
				expect(intensity).toBeGreaterThanOrEqual(0);
				expect(intensity).toBeLessThanOrEqual(1);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("intensity increases with grade (steeper uphill = more effort)", () => {
		fc.assert(
			fc.property(
				fc.double({ min: -5, max: 15, noNaN: true }),
				fc.double({ min: 0.5, max: 5, noNaN: true }),
				(grade, delta) => {
					expect(intensityFromGrade(grade + delta)).toBeGreaterThanOrEqual(
						intensityFromGrade(grade),
					);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("speedFromPowerClimb > 0 for positive power on uphills", () => {
		fc.assert(
			fc.property(
				power,
				mass,
				fc.double({ min: 0.01, max: 0.2, noNaN: true }),
				crr,
				(p, m, grade, c) => {
					expect(speedFromPowerClimb(p, m, grade, c)).toBeGreaterThan(0);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("speedFromPowerFull > 0 for positive power", () => {
		fc.assert(
			fc.property(power, fc.double({ min: -0.05, max: 0.05, noNaN: true }), (p, grade) => {
				const params = getDefaultCyclingParams("recreational", "road", 75);
				expect(speedFromPowerFull(p, params, grade)).toBeGreaterThan(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("higher FTP = faster for flat terrain", () => {
		const orderedFitness: BikeFitnessLevel[] = [
			"casual",
			"recreational",
			"trained",
			"competitive",
			"elite",
			"pro",
		];

		fc.assert(
			fc.property(fc.double({ min: 5000, max: 50_000, noNaN: true }), (distance) => {
				for (let i = 0; i < orderedFitness.length - 1; i++) {
					const slower = quickEstimate(
						distance,
						0,
						0,
						orderedFitness[i],
						"road",
						"smooth_pavement",
					);
					const faster = quickEstimate(
						distance,
						0,
						0,
						orderedFitness[i + 1],
						"road",
						"smooth_pavement",
					);
					expect(faster).toBeLessThan(slower);
				}
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("quickEstimate > 0 for any positive distance", () => {
		fc.assert(
			fc.property(
				fc.double({ min: 1000, max: 100_000, noNaN: true }),
				fc.double({ min: 0, max: 2000, noNaN: true }),
				fc.double({ min: 0, max: 2000, noNaN: true }),
				(dist, gain, loss) => {
					expect(quickEstimate(dist, gain, loss)).toBeGreaterThan(0);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("all fitness FTP midpoints are positive and ordered", () => {
		const ordered: BikeFitnessLevel[] = [
			"casual",
			"recreational",
			"trained",
			"competitive",
			"elite",
			"pro",
		];
		for (let i = 0; i < ordered.length - 1; i++) {
			expect(BIKE_FITNESS_LEVELS[ordered[i]].ftpWkgMidpoint).toBeLessThan(
				BIKE_FITNESS_LEVELS[ordered[i + 1]].ftpWkgMidpoint,
			);
		}
	});
});
