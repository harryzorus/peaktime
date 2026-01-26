/**
 * Bike Module Tests
 *
 * Tests for physics-based cycling time estimation.
 */

import { describe, expect, it } from "vitest";
import {
	BIKE_FITNESS_LEVELS,
	BIKE_TERRAIN_TYPES,
	BIKE_TYPES,
	getDefaultCyclingParams,
	intensityFromGrade,
	quickEstimate,
	speedFromPowerClimb,
	speedFromPowerFull,
} from "../../src/bike";

describe("Bike Physics", () => {
	describe("intensityFromGrade", () => {
		it("should return low intensity on steep descents", () => {
			expect(intensityFromGrade(-10)).toBe(0.2);
			expect(intensityFromGrade(-15)).toBe(0.2);
		});

		it("should return moderate intensity on gentle descents", () => {
			const intensity = intensityFromGrade(-5);
			expect(intensity).toBeCloseTo(0.3, 2);
		});

		it("should return endurance intensity on flat terrain", () => {
			const intensity = intensityFromGrade(0);
			expect(intensity).toBeGreaterThanOrEqual(0.65);
			expect(intensity).toBeLessThanOrEqual(0.75);
		});

		it("should return tempo intensity on gentle climbs", () => {
			const intensity = intensityFromGrade(4);
			expect(intensity).toBeGreaterThanOrEqual(0.75);
			expect(intensity).toBeLessThanOrEqual(0.85);
		});

		it("should return threshold intensity on moderate climbs", () => {
			const intensity = intensityFromGrade(8);
			expect(intensity).toBeGreaterThanOrEqual(0.85);
			expect(intensity).toBeLessThanOrEqual(0.95);
		});

		it("should cap intensity at 0.95 on steep climbs", () => {
			expect(intensityFromGrade(10)).toBe(0.95);
			expect(intensityFromGrade(15)).toBe(0.95);
			expect(intensityFromGrade(20)).toBe(0.95);
		});

		it("should be monotonically increasing from -5% to 8%", () => {
			let prev = intensityFromGrade(-5);
			for (let grade = -4; grade <= 8; grade++) {
				const current = intensityFromGrade(grade);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});
	});

	describe("speedFromPowerClimb", () => {
		const totalMass = 84; // 75kg rider + 9kg bike
		const crr = 0.004;

		it("should return reasonable speed on moderate climb", () => {
			// 200W on 8% grade
			const speed = speedFromPowerClimb(200, totalMass, 0.08, crr);
			const speedKmh = speed * 3.6;

			// Should be around 10-15 km/h
			expect(speedKmh).toBeGreaterThan(8);
			expect(speedKmh).toBeLessThan(18);
		});

		it("should return slower speed on steeper grade", () => {
			const speed8 = speedFromPowerClimb(200, totalMass, 0.08, crr);
			const speed12 = speedFromPowerClimb(200, totalMass, 0.12, crr);

			expect(speed12).toBeLessThan(speed8);
		});

		it("should return faster speed with more power", () => {
			const speed200 = speedFromPowerClimb(200, totalMass, 0.1, crr);
			const speed300 = speedFromPowerClimb(300, totalMass, 0.1, crr);

			expect(speed300).toBeGreaterThan(speed200);
		});

		it("should return slower speed with more weight", () => {
			const speedLight = speedFromPowerClimb(200, 75, 0.1, crr);
			const speedHeavy = speedFromPowerClimb(200, 95, 0.1, crr);

			expect(speedHeavy).toBeLessThan(speedLight);
		});
	});

	describe("speedFromPowerFull", () => {
		const params = getDefaultCyclingParams("recreational", "road", 75);

		it("should return reasonable flat speed", () => {
			// 200W on flat
			const speed = speedFromPowerFull(200, params, 0);
			const speedKmh = speed * 3.6;

			// Pro peloton averages ~45 km/h at ~250W each (drafting)
			// Solo at 200W should be around 32-36 km/h
			expect(speedKmh).toBeGreaterThan(30);
			expect(speedKmh).toBeLessThan(40);
		});

		it("should use simplified model for steep climbs", () => {
			// At 8%+ grade, should use climb model (aero negligible)
			const speed = speedFromPowerFull(200, params, 0.1);
			const speedKmh = speed * 3.6;

			// Should be around 7-12 km/h
			expect(speedKmh).toBeGreaterThan(5);
			expect(speedKmh).toBeLessThan(15);
		});

		it("should handle gentle descents", () => {
			const speed = speedFromPowerFull(100, params, -0.03);
			const speedKmh = speed * 3.6;

			// Light pedaling on -3% should be fast
			expect(speedKmh).toBeGreaterThan(35);
		});

		it("should limit terminal velocity on steep descents", () => {
			const speed = speedFromPowerFull(0, params, -0.1);
			const speedKmh = speed * 3.6;

			// Coasting at -10% should hit terminal velocity ~50-70 km/h
			expect(speedKmh).toBeGreaterThan(40);
			expect(speedKmh).toBeLessThan(110); // Max speed limit
		});
	});

	describe("quickEstimate", () => {
		it("should estimate reasonable time for flat route", () => {
			// 30km flat at recreational level
			const time = quickEstimate(30000, 0, 0, "recreational", "road", "smooth_pavement", 75);

			// Should be around 60-90 minutes
			expect(time).toBeGreaterThan(50);
			expect(time).toBeLessThan(100);
		});

		it("should estimate longer time for hilly route", () => {
			// 30km with 500m climbing
			const timeFlat = quickEstimate(30000, 0, 0, "recreational", "road", "smooth_pavement", 75);
			const timeHilly = quickEstimate(
				30000,
				500,
				500,
				"recreational",
				"road",
				"smooth_pavement",
				75,
			);

			expect(timeHilly).toBeGreaterThan(timeFlat);
		});

		it("should estimate faster time for fitter riders", () => {
			const timeRecreational = quickEstimate(
				30000,
				300,
				300,
				"recreational",
				"road",
				"smooth_pavement",
				75,
			);
			const timeCompetitive = quickEstimate(
				30000,
				300,
				300,
				"competitive",
				"road",
				"smooth_pavement",
				75,
			);

			expect(timeCompetitive).toBeLessThan(timeRecreational);
		});

		it("should estimate slower time on rough terrain", () => {
			const timeSmooth = quickEstimate(
				30000,
				300,
				300,
				"recreational",
				"road",
				"smooth_pavement",
				75,
			);
			const timeGravel = quickEstimate(30000, 300, 300, "recreational", "gravel", "gravel", 75);

			expect(timeGravel).toBeGreaterThan(timeSmooth);
		});
	});
});

describe("Bike Fitness Levels", () => {
	it("should have all expected levels", () => {
		expect(BIKE_FITNESS_LEVELS).toHaveProperty("casual");
		expect(BIKE_FITNESS_LEVELS).toHaveProperty("recreational");
		expect(BIKE_FITNESS_LEVELS).toHaveProperty("trained");
		expect(BIKE_FITNESS_LEVELS).toHaveProperty("competitive");
		expect(BIKE_FITNESS_LEVELS).toHaveProperty("elite");
		expect(BIKE_FITNESS_LEVELS).toHaveProperty("pro");
	});

	it("should have increasing FTP values", () => {
		const levels = ["casual", "recreational", "trained", "competitive", "elite", "pro"] as const;
		let prevFtp = 0;
		for (const level of levels) {
			const ftp = BIKE_FITNESS_LEVELS[level].ftpWkgMidpoint;
			expect(ftp).toBeGreaterThan(prevFtp);
			prevFtp = ftp;
		}
	});

	it("should have realistic FTP ranges", () => {
		// Casual: 1.5-2.0 W/kg
		expect(BIKE_FITNESS_LEVELS.casual.ftpWkgMidpoint).toBeGreaterThanOrEqual(1.5);
		expect(BIKE_FITNESS_LEVELS.casual.ftpWkgMidpoint).toBeLessThanOrEqual(2.5);

		// Pro: 5.0+ W/kg
		expect(BIKE_FITNESS_LEVELS.pro.ftpWkgMidpoint).toBeGreaterThanOrEqual(5.0);
	});
});

describe("Bike Types", () => {
	it("should have all expected types", () => {
		expect(BIKE_TYPES).toHaveProperty("road");
		expect(BIKE_TYPES).toHaveProperty("gravel");
		expect(BIKE_TYPES).toHaveProperty("mtb");
		expect(BIKE_TYPES).toHaveProperty("tt");
		expect(BIKE_TYPES).toHaveProperty("ebike");
	});

	it("should have TT bike with lowest CdA", () => {
		const ttCdA = BIKE_TYPES.tt.cdA;
		expect(ttCdA).toBeLessThan(BIKE_TYPES.road.cdA);
		expect(ttCdA).toBeLessThan(BIKE_TYPES.gravel.cdA);
		expect(ttCdA).toBeLessThan(BIKE_TYPES.mtb.cdA);
	});

	it("should have MTB with highest Crr", () => {
		const mtbCrr = BIKE_TYPES.mtb.crr;
		expect(mtbCrr).toBeGreaterThan(BIKE_TYPES.road.crr);
		expect(mtbCrr).toBeGreaterThan(BIKE_TYPES.gravel.crr);
	});
});

describe("Bike Terrain Types", () => {
	it("should have smooth pavement as baseline", () => {
		expect(BIKE_TERRAIN_TYPES.smooth_pavement.crrMultiplier).toBe(1.0);
	});

	it("should have increasing multipliers for rougher terrain", () => {
		expect(BIKE_TERRAIN_TYPES.rough_pavement.crrMultiplier).toBeGreaterThan(1.0);
		expect(BIKE_TERRAIN_TYPES.gravel.crrMultiplier).toBeGreaterThan(
			BIKE_TERRAIN_TYPES.rough_pavement.crrMultiplier,
		);
		expect(BIKE_TERRAIN_TYPES.mud.crrMultiplier).toBeGreaterThan(
			BIKE_TERRAIN_TYPES.singletrack.crrMultiplier,
		);
	});
});

describe("getDefaultCyclingParams", () => {
	it("should calculate FTP from fitness level and weight", () => {
		const params = getDefaultCyclingParams("recreational", "road", 75);

		// Recreational is 2.5 W/kg midpoint
		const expectedFtp = 2.5 * 75;
		expect(params.ftpWatts).toBeCloseTo(expectedFtp, 0);
	});

	it("should use bike type defaults", () => {
		const roadParams = getDefaultCyclingParams("recreational", "road", 75);
		const mtbParams = getDefaultCyclingParams("recreational", "mtb", 75);

		expect(mtbParams.bikeWeightKg).toBeGreaterThan(roadParams.bikeWeightKg);
		expect(mtbParams.cdA).toBeGreaterThan(roadParams.cdA);
		expect(mtbParams.crr).toBeGreaterThan(roadParams.crr);
	});
});

describe("Real-world calibration", () => {
	it("should match Twin Peaks climb data", () => {
		// From Strava: Twin Peaks climb - 202W average, 4.1% grade
		// Actual time: part of 102 min total ride
		const params = getDefaultCyclingParams("recreational", "road", 77.6);
		params.ftpWatts = 200; // ~2.6 W/kg based on actual data

		// 202W on 4.1% grade
		const speed = speedFromPowerFull(202 * 0.97, params, 0.041);
		const speedKmh = speed * 3.6;

		// Should be around 12-18 km/h on this grade
		expect(speedKmh).toBeGreaterThan(10);
		expect(speedKmh).toBeLessThan(20);
	});
});
