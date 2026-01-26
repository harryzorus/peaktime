---
title: Quick Start
description: Install Peaktime and calculate your first optimal start time in under 5 minutes.
order: 10
---

# Quick Start

## Installation

```bash
npm install peaktime
```

Or with other package managers:

```bash
yarn add peaktime
bun add peaktime
pnpm add peaktime
```

## Your First Plan

The simplest use case: given a GPX file, when should I start hiking to catch sunrise at the summit?

```typescript
import { parseGPXOrThrow, createPlanSummary, formatStartTime } from 'peaktime';
import { readFileSync } from 'fs';

// 1. Parse a GPX file
const gpx = readFileSync('mt-elbert.gpx', 'utf-8');
const route = parseGPXOrThrow(gpx);

// 2. Plan for sunrise on the summer solstice
const summary = createPlanSummary(route, new Date('2026-06-21'), 'sunrise');

// 3. Get the start time
console.log(formatStartTime(summary.plan.startTime, 'America/Denver'));
// → "3:47 AM"
```

## What Just Happened

`createPlanSummary` does several things:

1. **Parses the GPX** and finds the highest point (the summit)
2. **Calculates sun times** at the summit's coordinates for your date
3. **Estimates hiking time** from trailhead to summit using Naismith's rule
4. **Works backward** from sunrise to find your start time

The result includes the plan, alternatives (golden hour, blue hour), hiking time estimate, and full sun times.

## Choosing a Target

Peaktime supports several sun events as targets:

```typescript
// Sunrise targets (morning)
createPlanSummary(route, date, 'sunrise');
createPlanSummary(route, date, 'goldenHourStart');
createPlanSummary(route, date, 'blueHourStart');

// Sunset targets (evening)
createPlanSummary(route, date, 'sunset');
createPlanSummary(route, date, 'goldenHourEveningStart');
```

## Adjusting Fitness Level

By default, Peaktime estimates time for a moderate fitness level. You can adjust this:

```typescript
import { createPlanSummary, FAST_HIKING_PARAMS, SLOW_HIKING_PARAMS } from 'peaktime';

// Use athletic-level hiking params (faster)
const summary = createPlanSummary(route, date, 'sunrise', {
  hikingParams: FAST_HIKING_PARAMS
});

// Or use leisurely pace (slower)
const leisurelySummary = createPlanSummary(route, date, 'sunrise', {
  hikingParams: SLOW_HIKING_PARAMS
});
```

Exported presets: `FAST_HIKING_PARAMS` (athletic), `DEFAULT_HIKING_PARAMS` (moderate), `SLOW_HIKING_PARAMS` (leisurely). For other levels, pass custom `hikingParams` directly.

## Adding a Buffer

Add extra time before your target event:

```typescript
const summary = createPlanSummary(route, date, 'sunrise', {
  bufferMinutes: 15  // Arrive 15 minutes before sunrise
});
```

## Other Activities

Peaktime also supports cycling and trail running:

```typescript
import * as bike from 'peaktime/bike';
import * as run from 'peaktime/run';

// Plan a bike ride for sunset golden hour
const bikeSummary = bike.createBikePlanSummary(route, date, 'goldenHourEveningStart');

// Plan a trail run for sunrise
const runSummary = run.createRunPlanSummary(route, date, 'sunrise');
```

## Development Setup

```bash
git clone https://github.com/harryzorus/peaktime.git
cd peaktime
bun install
bun run check            # TypeScript
bun run lint             # Biome
bun run test:unit        # Unit tests
bun run test:property    # Property-based tests (fast-check)
bun run test:calibration # Real-world calibration
```

## Next Steps

- [Sun Calculations](sun-calculations.md) — understand the solar algorithm
- [Hiking Models](hiking-models.md) — how hiking time is estimated
- [API Reference](api-reference.md) — full TypeScript API
