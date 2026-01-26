---
title: Hiking Models
description: Four hiking time estimation models, fitness levels, terrain types, and the planner API.
order: 21
---

# Hiking Models

Peaktime includes four classical hiking time estimation models. Each takes distance and elevation data and returns an estimated time in minutes.

## Models

### Naismith's Rule (1892)

The oldest and simplest model. Assumes 5 km/h on flat ground plus 1 hour per 600m of ascent. Does not account for descent.

```typescript
import { naismithTime } from 'peaktime';

// 10 km distance, 800m elevation gain
const minutes = naismithTime(10000, 800);
```

### Tobler's Hiking Function (1993)

An exponential model that accounts for both uphill and downhill travel. Based on empirical data, it predicts that the fastest walking speed occurs at a slight downhill grade (about -5%).

```typescript
import { toblerTime } from 'peaktime';
import { parseGPXOrThrow } from 'peaktime';

const route = parseGPXOrThrow(gpxContent);
const minutes = toblerTime(route.points);
```

Tobler's function processes the full point array because speed varies with the grade of each segment.

### Langmuir's Correction (1984)

Extends Naismith's rule with corrections for descent. Gentle descents (under 12°) subtract time, while steep descents (over 12°) add time because of the difficulty of steep downhill travel.

```typescript
import { langmuirTime } from 'peaktime';

const minutes = langmuirTime(
  10000,  // distance in meters
  800,    // elevation gain
  200,    // elevation loss
  15      // average descent grade in degrees (optional)
);
```

### Munter Method (Swiss Alpine Club)

Used by the Swiss Alpine Club for route planning. Based on simple reference rates: 4 km/h horizontal, 400 m/h ascending, 800 m/h descending. Takes the slower of horizontal and vertical estimates.

```typescript
import { munterTime } from 'peaktime';

const minutes = munterTime(10000, 800, 200);
```

## Comparing Models

Use `compareModels` to see estimates from all four models at once:

```typescript
import { calculateRouteMetrics, compareModels } from 'peaktime';

const metrics = calculateRouteMetrics(route.points);
const results = compareModels(metrics, 'moderate', 'good_trail');

// results.naismith  → 245
// results.tobler    → 228
// results.langmuir  → 252
// results.munter    → 240
```

## Fitness Levels

Each fitness level maps to a speed multiplier based on Vertical Ascent Rate (VAR):

| Level | Description | Multiplier |
|-------|-------------|------------|
| `leisurely` | Casual pace, frequent stops | Slower |
| `moderate` | Average hiker | Baseline |
| `active` | Regular hiker, good fitness | Faster |
| `athletic` | Strong hiker, mountain experience | Faster |
| `fast` | Very fit, minimal breaks | Faster |
| `elite` | Competition level | Fastest |

```typescript
import { estimateTime, calculateRouteMetrics } from 'peaktime';

const metrics = calculateRouteMetrics(route.points);

const leisurely = estimateTime(metrics, 'naismith', 'leisurely', 'good_trail');
const athletic = estimateTime(metrics, 'naismith', 'athletic', 'good_trail');
```

## Terrain Types

Terrain conditions affect overall speed through a multiplier:

| Terrain | Description |
|---------|-------------|
| `paved` | Roads and paved paths |
| `good_trail` | Well-maintained hiking trail |
| `rough_trail` | Rocky or uneven terrain |
| `scramble` | Hands-on-rock sections |
| `off_trail` | Bushwhacking, no path |
| `snow` | Snow-covered terrain |

## The Planner

The hiking planner combines time estimation with sun calculations to produce a start time:

```typescript
import { createPlanSummary } from 'peaktime';

const summary = createPlanSummary(route, new Date('2026-06-21'), 'sunrise', {
  bufferMinutes: 15,
  hikingParams: { baseSpeedKmh: 4.5 }
});

console.log(summary.plan.startTime);     // When to leave
console.log(summary.plan.feasible);      // Is there enough time?
console.log(summary.alternatives);       // Other sun event options
```

The planner automatically:

1. Finds the summit (highest point on the route)
2. Extracts the route from trailhead to summit
3. Calculates sun times at the summit coordinates
4. Estimates hiking time to the summit
5. Works backward from the target event

If `feasible` is `false`, the `shortBy` field tells you how many additional minutes you'd need.

## Night Hiking

For pre-dawn starts (common for sunrise hikes), the planner automatically applies a night hiking adjustment. The default multiplier is 0.8, which makes the estimate ~25% slower to account for darkness.

You can adjust or disable this:

```typescript
// Override the night multiplier (lower = slower)
const summary = createPlanSummary(route, date, 'sunrise', {
  nightHikingMultiplier: 0.7  // ~43% slower in the dark
});

// Disable night adjustment entirely
const fast = createPlanSummary(route, date, 'sunrise', {
  nightHiking: false
});
```
