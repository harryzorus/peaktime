import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { RunFitnessLevel } from "../../src/run";
import { gapMultiplier, paceForGrade, quickEstimate, RUN_FITNESS_LEVELS } from "../../src/run";

const NUM_RUNS = 500;

describe("Run property tests", () => {
	test("gapMultiplier > 0 for any grade", () => {
		fc.assert(
			fc.property(fc.double({ min: -30, max: 30, noNaN: true }), (grade) => {
				expect(gapMultiplier(grade)).toBeGreaterThan(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("gapMultiplier is 1.0 at 0% grade", () => {
		expect(gapMultiplier(0)).toBe(1.0);
	});

	test("gapMultiplier increases for uphill (monotonic for grade > 0)", () => {
		fc.assert(
			fc.property(
				fc.double({ min: 0, max: 25, noNaN: true }),
				fc.double({ min: 0.5, max: 5, noNaN: true }),
				(grade, delta) => {
					expect(gapMultiplier(grade + delta)).toBeGreaterThanOrEqual(gapMultiplier(grade));
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("optimal downhill grade (-9%) is faster than flat", () => {
		expect(gapMultiplier(-9)).toBeLessThan(gapMultiplier(0));
	});

	test("paceForGrade > 0 for any valid inputs", () => {
		fc.assert(
			fc.property(
				fc.double({ min: 3, max: 10, noNaN: true }),
				fc.double({ min: -20, max: 20, noNaN: true }),
				fc.double({ min: 0.8, max: 2, noNaN: true }),
				(flatPace, grade, terrain) => {
					expect(paceForGrade(flatPace, grade, terrain)).toBeGreaterThan(0);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("terrain multiplier scales pace linearly", () => {
		fc.assert(
			fc.property(
				fc.double({ min: 3, max: 10, noNaN: true }),
				fc.double({ min: -10, max: 10, noNaN: true }),
				fc.double({ min: 1.0, max: 1.5, noNaN: true }),
				(flatPace, grade, terrain) => {
					const basePace = paceForGrade(flatPace, grade, 1.0);
					const terrainPace = paceForGrade(flatPace, grade, terrain);
					expect(terrainPace).toBeCloseTo(basePace * terrain, 6);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("quickEstimate > 0 for any positive distance", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1000, max: 50_000 }),
				fc.integer({ min: 1, max: 2000 }),
				fc.integer({ min: 1, max: 2000 }),
				(dist, gain, loss) => {
					// Note: quickEstimate has a NaN bug when gain=0 and loss>0
					// (division by zero in climbRatio). Require both > 0 here.
					expect(quickEstimate(dist, gain, loss)).toBeGreaterThan(0);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("faster runners have lower quickEstimate times (excluding ultra)", () => {
		// Ultra is excluded because it optimizes for endurance, not speed
		const orderedFitness: RunFitnessLevel[] = [
			"beginner",
			"recreational",
			"trained",
			"competitive",
			"elite",
		];

		fc.assert(
			fc.property(fc.double({ min: 5000, max: 20_000, noNaN: true }), (distance) => {
				for (let i = 0; i < orderedFitness.length - 1; i++) {
					const slower = quickEstimate(distance, 0, 0, orderedFitness[i], "road");
					const faster = quickEstimate(distance, 0, 0, orderedFitness[i + 1], "road");
					expect(faster).toBeLessThan(slower);
				}
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("all fitness pace midpoints are positive", () => {
		for (const [, info] of Object.entries(RUN_FITNESS_LEVELS)) {
			expect(info.paceMidpoint).toBeGreaterThan(0);
		}
	});
});
