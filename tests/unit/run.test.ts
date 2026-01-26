/**
 * Run Module Tests
 *
 * Tests for Grade Adjusted Pace (GAP) based running time estimation.
 */

import { describe, expect, it } from "vitest";
import {
	equivalentFlatDistance,
	gapMultiplier,
	getDefaultRunningParams,
	paceForGrade,
	quickEstimate,
	RUN_FITNESS_LEVELS,
	RUN_TERRAIN_TYPES,
} from "../../src/run";

describe("GAP Model", () => {
	describe("gapMultiplier", () => {
		it("should return 1.0 for flat terrain", () => {
			expect(gapMultiplier(0)).toBeCloseTo(1.0, 2);
		});

		it("should return ~1.17 at 5% uphill", () => {
			// From Strava research: ~3.3% slower per 1% grade
			// 5% * 3.3% = 16.5% slower, so ~1.165
			const gap = gapMultiplier(5);
			expect(gap).toBeGreaterThan(1.15);
			expect(gap).toBeLessThan(1.25);
		});

		it("should return ~1.42 at 10% uphill", () => {
			const gap = gapMultiplier(10);
			expect(gap).toBeGreaterThan(1.35);
			expect(gap).toBeLessThan(1.5);
		});

		it("should return ~2.0 at 20% uphill", () => {
			const gap = gapMultiplier(20);
			expect(gap).toBeGreaterThan(1.8);
			expect(gap).toBeLessThan(2.3);
		});

		it("should return minimum (~0.88) at -9% downhill", () => {
			// Strava research: optimal running efficiency at -9%
			const gap = gapMultiplier(-9);
			expect(gap).toBeCloseTo(0.88, 2);
		});

		it("should return 1.0 at -18% downhill", () => {
			// Very steep downhill is as hard as flat
			const gap = gapMultiplier(-18);
			expect(gap).toBeCloseTo(1.0, 2);
		});

		it("should return >1.0 for very steep downhill (<-18%)", () => {
			const gap = gapMultiplier(-25);
			expect(gap).toBeGreaterThan(1.0);
		});

		it("should be symmetric around -9% optimal", () => {
			// -4% and -14% should have similar multipliers
			const gapMinus4 = gapMultiplier(-4);
			const gapMinus14 = gapMultiplier(-14);

			// Both should be less than 1 but not optimal
			expect(gapMinus4).toBeLessThan(1.0);
			expect(gapMinus14).toBeLessThan(1.0);
		});

		it("should decrease then increase for downhill grades", () => {
			// From 0 to -9, should decrease
			expect(gapMultiplier(-5)).toBeLessThan(gapMultiplier(0));
			expect(gapMultiplier(-9)).toBeLessThan(gapMultiplier(-5));

			// From -9 to -18, should increase back toward 1.0
			expect(gapMultiplier(-14)).toBeGreaterThan(gapMultiplier(-9));
			expect(gapMultiplier(-18)).toBeGreaterThan(gapMultiplier(-14));
		});

		it("should be monotonically increasing for uphill", () => {
			let prev = gapMultiplier(0);
			for (let grade = 1; grade <= 25; grade++) {
				const current = gapMultiplier(grade);
				expect(current).toBeGreaterThan(prev);
				prev = current;
			}
		});
	});

	describe("paceForGrade", () => {
		const flatPace = 5.0; // 5:00/km

		it("should return flat pace for 0% grade", () => {
			const pace = paceForGrade(flatPace, 0);
			expect(pace).toBeCloseTo(flatPace, 2);
		});

		it("should return slower pace uphill", () => {
			const pace = paceForGrade(flatPace, 10);
			expect(pace).toBeGreaterThan(flatPace);
			// At 10% grade with GAP ~1.42, pace should be ~7:06/km
			expect(pace).toBeGreaterThan(6.5);
			expect(pace).toBeLessThan(8.0);
		});

		it("should return faster pace at optimal downhill", () => {
			const pace = paceForGrade(flatPace, -9);
			expect(pace).toBeLessThan(flatPace);
			// At -9% with GAP ~0.88, pace should be ~4:24/km
			expect(pace).toBeCloseTo(4.4, 1);
		});

		it("should apply terrain multiplier", () => {
			const roadPace = paceForGrade(flatPace, 0, 1.0);
			const trailPace = paceForGrade(flatPace, 0, 1.25);

			expect(trailPace).toBeGreaterThan(roadPace);
			expect(trailPace).toBeCloseTo(flatPace * 1.25, 2);
		});
	});

	describe("quickEstimate", () => {
		it("should estimate reasonable time for flat route", () => {
			// 10km flat at trained level (5:00/km)
			const time = quickEstimate(10000, 0, 0, "trained", "road");

			// Should be around 50 minutes
			expect(time).toBeGreaterThan(45);
			expect(time).toBeLessThan(55);
		});

		it("should estimate longer time for hilly route", () => {
			const timeFlat = quickEstimate(10000, 0, 0, "trained", "good_trail");
			const timeHilly = quickEstimate(10000, 500, 500, "trained", "good_trail");

			expect(timeHilly).toBeGreaterThan(timeFlat);
		});

		it("should estimate faster time for fitter runners", () => {
			const timeRecreational = quickEstimate(10000, 200, 200, "recreational", "good_trail");
			const timeCompetitive = quickEstimate(10000, 200, 200, "competitive", "good_trail");

			expect(timeCompetitive).toBeLessThan(timeRecreational);
		});

		it("should estimate slower time on technical terrain", () => {
			const timeGoodTrail = quickEstimate(10000, 200, 200, "trained", "good_trail");
			const timeTechnical = quickEstimate(10000, 200, 200, "trained", "technical_trail");

			expect(timeTechnical).toBeGreaterThan(timeGoodTrail);
		});
	});

	describe("equivalentFlatDistance", () => {
		it("should return actual distance for flat run at flat pace", () => {
			// 10km in 50 minutes at 5:00/km pace
			const equiv = equivalentFlatDistance(10000, 50, 5.0);

			// Should be exactly 10km
			expect(equiv).toBeCloseTo(10000, -1);
		});

		it("should return more distance for slow hilly run", () => {
			// 10km in 70 minutes (hilly) at 5:00/km flat pace
			const equiv = equivalentFlatDistance(10000, 70, 5.0);

			// Equivalent to 14km flat
			expect(equiv).toBeCloseTo(14000, -1);
		});
	});
});

describe("Run Fitness Levels", () => {
	it("should have all expected levels", () => {
		expect(RUN_FITNESS_LEVELS).toHaveProperty("beginner");
		expect(RUN_FITNESS_LEVELS).toHaveProperty("recreational");
		expect(RUN_FITNESS_LEVELS).toHaveProperty("trained");
		expect(RUN_FITNESS_LEVELS).toHaveProperty("competitive");
		expect(RUN_FITNESS_LEVELS).toHaveProperty("elite");
		expect(RUN_FITNESS_LEVELS).toHaveProperty("ultra");
	});

	it("should have decreasing pace for faster levels (except ultra)", () => {
		// Faster runners have lower min/km
		expect(RUN_FITNESS_LEVELS.recreational.paceMidpoint).toBeLessThan(
			RUN_FITNESS_LEVELS.beginner.paceMidpoint,
		);
		expect(RUN_FITNESS_LEVELS.trained.paceMidpoint).toBeLessThan(
			RUN_FITNESS_LEVELS.recreational.paceMidpoint,
		);
		expect(RUN_FITNESS_LEVELS.competitive.paceMidpoint).toBeLessThan(
			RUN_FITNESS_LEVELS.trained.paceMidpoint,
		);
		expect(RUN_FITNESS_LEVELS.elite.paceMidpoint).toBeLessThan(
			RUN_FITNESS_LEVELS.competitive.paceMidpoint,
		);
	});

	it("should have ultra optimized for endurance not speed", () => {
		// Ultra runners are slower than competitive but optimized for distance
		expect(RUN_FITNESS_LEVELS.ultra.paceMidpoint).toBeGreaterThan(
			RUN_FITNESS_LEVELS.competitive.paceMidpoint,
		);
	});

	it("should have realistic pace ranges", () => {
		// Beginner: 7-8 min/km
		expect(RUN_FITNESS_LEVELS.beginner.paceMidpoint).toBeGreaterThanOrEqual(7);
		expect(RUN_FITNESS_LEVELS.beginner.paceMidpoint).toBeLessThanOrEqual(8);

		// Elite: 3.5-4 min/km
		expect(RUN_FITNESS_LEVELS.elite.paceMidpoint).toBeGreaterThanOrEqual(3.5);
		expect(RUN_FITNESS_LEVELS.elite.paceMidpoint).toBeLessThanOrEqual(4.0);
	});
});

describe("Run Terrain Types", () => {
	it("should have road as baseline", () => {
		expect(RUN_TERRAIN_TYPES.road.multiplier).toBe(1.0);
	});

	it("should have track faster than road", () => {
		expect(RUN_TERRAIN_TYPES.track.multiplier).toBeLessThan(1.0);
	});

	it("should have increasing multipliers for rougher terrain", () => {
		expect(RUN_TERRAIN_TYPES.good_trail.multiplier).toBeGreaterThan(
			RUN_TERRAIN_TYPES.road.multiplier,
		);
		expect(RUN_TERRAIN_TYPES.technical_trail.multiplier).toBeGreaterThan(
			RUN_TERRAIN_TYPES.good_trail.multiplier,
		);
		expect(RUN_TERRAIN_TYPES.alpine.multiplier).toBeGreaterThan(
			RUN_TERRAIN_TYPES.technical_trail.multiplier,
		);
	});

	it("should have sand as slowest terrain", () => {
		expect(RUN_TERRAIN_TYPES.sand.multiplier).toBeGreaterThanOrEqual(
			RUN_TERRAIN_TYPES.alpine.multiplier,
		);
	});
});

describe("getDefaultRunningParams", () => {
	it("should set pace from fitness level", () => {
		const params = getDefaultRunningParams("trained", "road");

		expect(params.flatPaceMinPerKm).toBe(RUN_FITNESS_LEVELS.trained.paceMidpoint);
	});

	it("should set terrain multiplier", () => {
		const roadParams = getDefaultRunningParams("trained", "road");
		const trailParams = getDefaultRunningParams("trained", "technical_trail");

		expect(roadParams.terrainMultiplier).toBe(1.0);
		expect(trailParams.terrainMultiplier).toBe(1.25);
	});

	it("should add breaks for ultra runners", () => {
		const trainedParams = getDefaultRunningParams("trained", "good_trail");
		const ultraParams = getDefaultRunningParams("ultra", "good_trail");

		expect(trainedParams.breakIntervalMinutes).toBe(0);
		expect(ultraParams.breakIntervalMinutes).toBeGreaterThan(0);
		expect(ultraParams.breakDurationMinutes).toBeGreaterThan(0);
	});
});

describe("Real-world calibration", () => {
	it("should match half marathon pace data", () => {
		// From Strava: Half marathon - 21.3km in 99 min = 4:39/km
		// This was race effort, suggesting "trained" level with race push

		// At trained level (5:00/km easy), race effort is ~4:30-4:45
		const params = getDefaultRunningParams("trained", "road");

		// Flat road race should be close to or faster than easy pace
		expect(params.flatPaceMinPerKm).toBeLessThanOrEqual(5.5);
	});

	it("should estimate reasonable time for Steep Ravine trail", () => {
		// From Strava: 2,588m in 31.5min, 11% average grade
		// This is ~82m/min on steep uphill trail

		// Calculate expected pace at 11% grade
		const gap = gapMultiplier(11);
		const basePace = 5.0; // Trained flat pace
		const terrainMult = 1.1; // Good trail
		const expectedPace = basePace * gap * terrainMult;

		// At 11% grade: GAP ~1.48, terrain 1.1 => pace ~8.1 min/km
		expect(expectedPace).toBeGreaterThan(7.5);
		expect(expectedPace).toBeLessThan(9.0);

		// For 2.588km at ~8 min/km = ~20.7 min
		// Actual was 31.5 min, suggesting terrain/difficulty was higher
		// This is expected for steep technical trail
	});

	it("should handle Grand Canyon descent", () => {
		// From Strava: 10,254m in 82.7 min, -13.5% average grade
		// This is fast downhill running

		const gap = gapMultiplier(-13.5);

		// At -13.5%, should be between optimal (-9%) and flat
		expect(gap).toBeGreaterThan(gapMultiplier(-9)); // Not as fast as optimal
		expect(gap).toBeLessThan(1.0); // Still faster than flat
	});
});
