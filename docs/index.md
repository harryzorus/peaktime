---
title: Overview
description: Documentation for Peaktime, an npm package for calculating optimal start times for outdoor activities.
order: 0
---

# Overview

Peaktime calculates when to start a hike, bike ride, or trail run so you arrive at a summit or viewpoint during sunrise, golden hour, or blue hour. Give it a GPX file and a date, and it tells you what time to leave.

## Reading Order

**New to Peaktime?** Start with [Quick Start](quickstart.md) to install and run your first plan.

**Want to understand the science?** Read [Sun Calculations](sun-calculations.md) for the solar algorithm, then the activity module that matches your sport.

## Documentation

| Page | Description |
|------|-------------|
| [Quick Start](quickstart.md) | Install, basic usage, first plan |
| [Sun Calculations](sun-calculations.md) | NOAA algorithm, sun events, twilight phases |
| [Hiking Models](hiking-models.md) | Naismith, Tobler, Langmuir, Munter; fitness levels; terrain |
| [Cycling](cycling.md) | Physics-based bike model, FTP, bike types |
| [Trail Running](running.md) | GAP model, pace calculations |
| [GPX Parsing](gpx-parsing.md) | Parser API, route stats, waypoints |
| [API Reference](api-reference.md) | Full TypeScript API: types, functions, constants |

## Quick Start

### 1. Install

```bash
npm install peaktime
```

### 2. Plan a sunrise hike

```typescript
import { parseGPXOrThrow, createPlanSummary, formatStartTime } from 'peaktime';
import { readFileSync } from 'fs';

const gpx = readFileSync('trail.gpx', 'utf-8');
const route = parseGPXOrThrow(gpx);

const summary = createPlanSummary(route, new Date('2026-06-21'), 'sunrise');

console.log(`Leave at ${formatStartTime(summary.plan.startTime, 'America/Denver')}`);
// → "Leave at 3:47 AM"
```
