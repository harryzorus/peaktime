---
title: Cycling
description: Physics-based cycling model with power, drag, rolling resistance, and grade calculations.
order: 22
---

# Cycling

The bike module uses a physics-based model to estimate cycling time. Instead of simple speed tables, it solves the power-speed equation accounting for gravity, rolling resistance, and aerodynamic drag.

## Basic Usage

```typescript
import * as bike from 'peaktime/bike';
import { parseGPXOrThrow } from 'peaktime';

const route = parseGPXOrThrow(gpxContent);

// Quick estimate without a GPX point array
const minutes = bike.quickEstimate(
  50000,   // distance in meters
  1200,    // elevation gain
  800,     // elevation loss
  'trained',
  'road',
  'smooth_pavement',
  75       // rider weight in kg
);
```

## Physics Model

The model solves for speed given power output and three resistance forces:

**Gravity:** `F_gravity = m * g * sin(grade)`

**Rolling resistance:** `F_rolling = Crr * m * g * cos(grade)`

**Aerodynamic drag:** `F_aero = 0.5 * rho * CdA * v^2`

On uphills where aerodynamic drag is negligible, speed is calculated directly. On flats and downhills, the full cubic equation is solved using Cardano's formula.

## Cycling Parameters

The `CyclingParams` interface controls the physics model:

```typescript
interface CyclingParams {
  ftpWatts: number;             // Functional Threshold Power
  riderWeightKg: number;        // Rider weight
  bikeWeightKg: number;         // Bike weight
  crr: number;                  // Rolling resistance coefficient
  cdA: number;                  // Drag coefficient * frontal area (m^2)
  airDensity: number;           // kg/m^3 (default: 1.225)
  drivetrainEfficiency: number; // Power transfer (default: 0.97)
}
```

You can build params from presets:

```typescript
const params = bike.getDefaultCyclingParams('trained', 'road', 75);
```

## Fitness Levels

Fitness is based on FTP (Functional Threshold Power) per kilogram:

| Level | FTP/kg Range | Description |
|-------|-------------|-------------|
| `casual` | Low | Weekend rider |
| `recreational` | Low-mid | Regular rider |
| `trained` | Mid | Structured training |
| `competitive` | Mid-high | Racing |
| `elite` | High | Top amateur |
| `pro` | Highest | Professional |

## Bike Types

Each bike type has default weight, aerodynamic profile, and rolling resistance:

| Type | Description |
|------|-------------|
| `road` | Drop bars, narrow tires |
| `gravel` | Drop bars, wider tires |
| `mtb` | Flat bars, suspension, knobby tires |
| `tt` | Aero bars, time trial position |
| `ebike` | Pedal-assist electric |

## Terrain

Terrain adjusts the rolling resistance coefficient:

| Terrain | Description |
|---------|-------------|
| `smooth_pavement` | Fresh asphalt |
| `rough_pavement` | Older road surface |
| `gravel` | Packed gravel road |
| `hardpack` | Hard dirt |
| `singletrack` | Mountain bike trail |
| `mud` | Wet, soft surface |

## Segment-Level Detail

For GPX routes, the model calculates per-segment power, speed, and time:

```typescript
const estimate = bike.estimateCyclingTime(route.points, params);

console.log(estimate.movingTime);       // Total minutes
console.log(estimate.averagePower);     // Average watts
console.log(estimate.normalizedPower);  // Normalized power
console.log(estimate.averageSpeed);     // km/h
```

Each segment includes grade, power output, and speed:

```typescript
for (const seg of estimate.segments) {
  console.log(`Grade: ${seg.gradePercent}% → ${seg.speedKmh} km/h at ${seg.powerWatts}W`);
}
```

## Planning a Ride

Use the bike planner to find the optimal start time:

```typescript
const summary = bike.createBikePlanSummary(route, new Date('2026-06-21'), 'sunset');

console.log(summary.plan.startTime);
console.log(summary.plan.ridingDuration);
console.log(summary.plan.feasible);
```

The planner finds the highest point on the route and calculates how long the ride takes to reach it, then works backward from the target sun event.
