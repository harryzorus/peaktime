---
title: Trail Running
description: Grade Adjusted Pace model, terrain multipliers, and trail run planning.
order: 23
---

# Trail Running

The run module estimates trail running time using the Grade Adjusted Pace (GAP) model. GAP accounts for the metabolic cost of running on hills — steep uphills are slower, and moderate downhills are actually faster than flat ground.

## Basic Usage

```typescript
import * as run from 'peaktime/run';
import { parseGPXOrThrow } from 'peaktime';

const route = parseGPXOrThrow(gpxContent);

// Quick estimate without a full GPX point array
const minutes = run.quickEstimate(
  15000,   // distance in meters
  600,     // elevation gain
  600,     // elevation loss
  'trained',
  'good_trail'
);
```

## The GAP Model

Grade Adjusted Pace converts hilly running into equivalent flat-ground effort. The model is based on research by Minetti et al. (2002) and used by platforms like Strava.

Key insight: the most efficient running grade is about -9% (slight downhill). Steep downhills are actually harder than flat ground because of the braking forces involved.

The `gapMultiplier` function returns a pace multiplier for any grade:

```typescript
import * as run from 'peaktime/run';

run.gapMultiplier(0);    // 1.0   — flat ground (baseline)
run.gapMultiplier(10);   // >1.0  — uphill is slower
run.gapMultiplier(-9);   // <1.0  — slight downhill is fastest
run.gapMultiplier(-20);  // >1.0  — steep downhill is slower than flat
```

## Pace Calculation

For a given flat pace and grade, calculate the adjusted pace:

```typescript
const adjustedPace = run.paceForGrade(
  5.0,    // flat pace: 5:00 min/km
  8,      // 8% uphill grade
  1.2     // terrain multiplier (optional)
);
```

## Fitness Levels

| Level | Flat Pace Range | Description |
|-------|----------------|-------------|
| `beginner` | Slower | New to running |
| `recreational` | Moderate | Regular runner |
| `trained` | Moderate-fast | Structured training |
| `competitive` | Fast | Racing regularly |
| `elite` | Very fast | Top amateur |
| `ultra` | Variable | Ultra-distance specialist |

## Terrain Types

| Terrain | Description |
|---------|-------------|
| `road` | Paved surface |
| `track` | Running track |
| `good_trail` | Well-maintained trail |
| `technical_trail` | Rocky, rooty terrain |
| `alpine` | Above treeline, exposed |
| `sand` | Beach or desert sand |

## Segment-Level Detail

For GPX routes, the model calculates per-segment pace and GAP:

```typescript
const params = run.getDefaultRunningParams('trained', 'good_trail');
const estimate = run.estimateRunningTime(route.points, params);

console.log(estimate.movingTime);     // Moving time in minutes
console.log(estimate.totalTime);      // Including breaks
console.log(estimate.averagePace);    // Overall min/km
console.log(estimate.gapPace);        // Grade-adjusted pace
```

Each segment shows the grade effect:

```typescript
for (const seg of estimate.segments) {
  console.log(`Grade: ${seg.gradePercent}% → GAP: ${seg.gapMultiplier}x → ${seg.paceMinPerKm} min/km`);
}
```

## Equivalent Flat Distance

Calculate how far the same effort would take you on flat ground:

```typescript
const flatDist = run.equivalentFlatDistance(
  15000,                      // actual distance in meters (unused, for API consistency)
  estimate.movingTime,        // moving time in minutes
  params.flatPaceMinPerKm     // flat pace in min/km
);
// A 15 km mountain run might equal 22 km on flat ground
```

## Planning a Run

Use the run planner to find the optimal start time:

```typescript
const summary = run.createRunPlanSummary(route, new Date('2026-06-21'), 'sunrise');

console.log(summary.plan.startTime);
console.log(summary.plan.runningDuration);
console.log(summary.plan.feasible);
```

Format the result:

```typescript
console.log(run.formatStartTime(summary.plan.startTime, 'America/Denver'));
console.log(run.formatPace(summary.estimate.averagePace));
```
