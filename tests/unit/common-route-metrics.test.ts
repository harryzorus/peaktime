/**
 * Common route metrics tests
 */

import { describe, expect, test } from "vitest";
import { calculateBaseRouteMetrics } from "../../src/common/route-metrics";
import type { GPXPoint } from "../../src/gpx/types";

describe("calculateBaseRouteMetrics", () => {
	test("calculates total distance via haversine", () => {
		const points: GPXPoint[] = [
			{ lat: 37.9, lon: -122.5, ele: 100 },
			{ lat: 37.91, lon: -122.5, ele: 100 },
			{ lat: 37.92, lon: -122.5, ele: 100 },
		];
		const metrics = calculateBaseRouteMetrics(points);
		// ~1.1km per 0.01 degree of latitude, total ~2.2km
		expect(metrics.distance).toBeGreaterThan(2000);
		expect(metrics.distance).toBeLessThan(2500);
	});

	test("separates elevation gain from loss", () => {
		const points: GPXPoint[] = [
			{ lat: 37.9, lon: -122.5, ele: 100 },
			{ lat: 37.91, lon: -122.5, ele: 200 },
			{ lat: 37.92, lon: -122.5, ele: 150 },
		];
		const metrics = calculateBaseRouteMetrics(points);
		expect(metrics.elevationGain).toBeCloseTo(100, 0);
		expect(metrics.elevationLoss).toBeCloseTo(50, 0);
	});

	test("handles flat route (zero gain/loss)", () => {
		const points: GPXPoint[] = [
			{ lat: 37.9, lon: -122.5, ele: 100 },
			{ lat: 37.91, lon: -122.5, ele: 100 },
			{ lat: 37.92, lon: -122.5, ele: 100 },
		];
		const metrics = calculateBaseRouteMetrics(points);
		expect(metrics.elevationGain).toBe(0);
		expect(metrics.elevationLoss).toBe(0);
	});

	test("handles pure ascent", () => {
		const points: GPXPoint[] = [
			{ lat: 37.9, lon: -122.5, ele: 100 },
			{ lat: 37.91, lon: -122.5, ele: 300 },
			{ lat: 37.92, lon: -122.5, ele: 500 },
		];
		const metrics = calculateBaseRouteMetrics(points);
		expect(metrics.elevationGain).toBeCloseTo(400, 0);
		expect(metrics.elevationLoss).toBe(0);
	});

	test("handles pure descent", () => {
		const points: GPXPoint[] = [
			{ lat: 37.9, lon: -122.5, ele: 500 },
			{ lat: 37.91, lon: -122.5, ele: 300 },
			{ lat: 37.92, lon: -122.5, ele: 100 },
		];
		const metrics = calculateBaseRouteMetrics(points);
		expect(metrics.elevationGain).toBe(0);
		expect(metrics.elevationLoss).toBeCloseTo(400, 0);
	});

	test("returns 0 distance for single-point array", () => {
		const points: GPXPoint[] = [{ lat: 37.9, lon: -122.5, ele: 100 }];
		const metrics = calculateBaseRouteMetrics(points);
		expect(metrics.distance).toBe(0);
		expect(metrics.elevationGain).toBe(0);
		expect(metrics.elevationLoss).toBe(0);
	});
});
