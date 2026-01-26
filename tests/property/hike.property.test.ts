import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { FitnessLevel, RouteMetrics, TerrainType } from "../../src/hike";
import {
	estimateTime,
	FITNESS_LEVELS,
	langmuirTime,
	munterTime,
	naismithTime,
	TERRAIN_TYPES,
} from "../../src/hike";

const NUM_RUNS = 500;

const posDistance = fc.double({ min: 100, max: 50_000, noNaN: true });
const posElevation = fc.double({ min: 0, max: 3000, noNaN: true });

const _fitnessLevel = fc.constantFrom<FitnessLevel>(
	"leisurely",
	"moderate",
	"active",
	"athletic",
	"fast",
	"elite",
);

const _terrainType = fc.constantFrom<TerrainType>(
	"paved",
	"good_trail",
	"rough_trail",
	"scramble",
	"off_trail",
	"snow",
);

describe("Hiking property tests", () => {
	test("naismithTime > 0 for any positive distance or elevation", () => {
		fc.assert(
			fc.property(posDistance, posElevation, (dist, elev) => {
				expect(naismithTime(dist, elev)).toBeGreaterThan(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("naismithTime increases with distance", () => {
		fc.assert(
			fc.property(
				posDistance,
				fc.double({ min: 1, max: 10_000, noNaN: true }),
				posElevation,
				(dist, extra, elev) => {
					expect(naismithTime(dist + extra, elev)).toBeGreaterThan(naismithTime(dist, elev));
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("naismithTime increases with elevation gain", () => {
		fc.assert(
			fc.property(
				posDistance,
				posElevation,
				fc.double({ min: 1, max: 1000, noNaN: true }),
				(dist, elev, extra) => {
					expect(naismithTime(dist, elev + extra)).toBeGreaterThan(naismithTime(dist, elev));
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("munterTime >= 0 for any valid inputs", () => {
		fc.assert(
			fc.property(posDistance, posElevation, posElevation, (dist, gain, loss) => {
				expect(munterTime(dist, gain, loss)).toBeGreaterThanOrEqual(0);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("langmuirTime >= 0 for any valid inputs", () => {
		fc.assert(
			fc.property(
				posDistance,
				posElevation,
				posElevation,
				fc.double({ min: 0, max: 45, noNaN: true }),
				(dist, gain, loss, grade) => {
					expect(langmuirTime(dist, gain, loss, grade)).toBeGreaterThanOrEqual(0);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});

	test("higher fitness = faster time (lower time)", () => {
		const orderedFitness: FitnessLevel[] = [
			"leisurely",
			"moderate",
			"active",
			"athletic",
			"fast",
			"elite",
		];

		fc.assert(
			fc.property(posDistance, posElevation, (dist, gain) => {
				const metrics: RouteMetrics = {
					distance: dist,
					elevationGain: gain,
					elevationLoss: 0,
					avgDescentGrade: 0,
					points: [],
				};

				for (let i = 0; i < orderedFitness.length - 1; i++) {
					const slower = estimateTime(metrics, "naismith", orderedFitness[i]);
					const faster = estimateTime(metrics, "naismith", orderedFitness[i + 1]);
					expect(faster).toBeLessThan(slower);
				}
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("rougher terrain = slower time", () => {
		const orderedTerrain: TerrainType[] = ["paved", "good_trail", "rough_trail", "scramble"];

		fc.assert(
			fc.property(posDistance, posElevation, (dist, gain) => {
				const metrics: RouteMetrics = {
					distance: dist,
					elevationGain: gain,
					elevationLoss: 0,
					avgDescentGrade: 0,
					points: [],
				};

				for (let i = 0; i < orderedTerrain.length - 1; i++) {
					const faster = estimateTime(metrics, "naismith", "moderate", orderedTerrain[i]);
					const slower = estimateTime(metrics, "naismith", "moderate", orderedTerrain[i + 1]);
					expect(slower).toBeGreaterThan(faster);
				}
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	test("all fitness multipliers are positive", () => {
		for (const [, info] of Object.entries(FITNESS_LEVELS)) {
			expect(info.multiplier).toBeGreaterThan(0);
		}
	});

	test("all terrain multipliers are positive", () => {
		for (const [, info] of Object.entries(TERRAIN_TYPES)) {
			expect(info.multiplier).toBeGreaterThan(0);
		}
	});
});
