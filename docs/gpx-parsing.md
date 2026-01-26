---
title: GPX Parsing
description: Parse GPX files, calculate route statistics, and work with waypoints.
order: 24
---

# GPX Parsing

The GPX module parses GPX XML files into structured route data. It handles track points, waypoints, metadata, and provides route statistics.

## Parsing a File

Two functions are available depending on how you want to handle errors:

```typescript
import { parseGPX, parseGPXOrThrow } from 'peaktime';

// Result type — check success before using
const result = parseGPX(gpxContent);
if (result.success) {
  console.log(result.route.points.length);
} else {
  console.error(result.error.message);
}

// Throws on parse failure
const route = parseGPXOrThrow(gpxContent);
```

## Route Structure

A parsed `GPXRoute` contains:

```typescript
interface GPXRoute {
  metadata: GPXMetadata;
  points: GPXPoint[];
  waypoints?: GPXWaypoint[];
}

interface GPXPoint {
  lat: number;
  lon: number;
  ele: number;    // Elevation in meters
  time?: Date;
}

interface GPXMetadata {
  name: string;
  description?: string;
  author?: string;
  link?: string;
  type: ActivityType;  // 'hiking' | 'cycling' | 'running' | 'walking' | 'unknown'
  time?: Date;
}
```

## Route Statistics

Calculate comprehensive statistics from a route:

```typescript
import { calculateRouteStats, formatDistance, formatElevation } from 'peaktime';

const stats = calculateRouteStats(route);

console.log(formatDistance(stats.totalDistance));        // "12.4 km"
console.log(formatElevation(stats.totalElevationGain)); // "856 m"
console.log(formatElevation(stats.totalElevationLoss)); // "342 m"
console.log(stats.maxElevation);                        // 4401.2
console.log(stats.pointCount);                          // 2847
```

The `RouteStats` interface:

```typescript
interface RouteStats {
  totalDistance: number;        // meters
  totalElevationGain: number;  // meters
  totalElevationLoss: number;  // meters (positive value)
  maxElevation: number;
  minElevation: number;
  startPoint: GPXPoint;
  endPoint: GPXPoint;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  pointCount: number;
}
```

## Elevation Smoothing

GPS elevation data is noisy. `calculateRouteStats` applies a moving average by default to reduce noise in elevation gain/loss calculations:

```typescript
// Default: smoothing enabled with window of 5
const stats = calculateRouteStats(route);

// Disable smoothing
const rawStats = calculateRouteStats(route, { smoothElevation: false });

// Custom window size
const smoothStats = calculateRouteStats(route, { smoothWindow: 7 });
```

You can also smooth elevation data directly:

```typescript
import { smoothElevation } from 'peaktime';

const smoothed = smoothElevation(route.points, 5);
```

## Distance and Grade Calculations

Lower-level functions for working with individual points:

```typescript
import { haversineDistance, distance3D, calculateGrade } from 'peaktime';

const p1 = route.points[0];
const p2 = route.points[1];

// 2D distance (ignoring elevation)
const flat = haversineDistance(p1, p2);  // meters

// 3D distance (including elevation)
const real = distance3D(p1, p2);  // meters

// Grade as percentage
const grade = calculateGrade(p1, p2);  // e.g., 12.5 for 12.5% uphill
```

## Waypoints

If the GPX file contains waypoints, they are available on the route:

```typescript
interface GPXWaypoint {
  lat: number;
  lon: number;
  ele?: number;
  name: string;
  sym?: string;    // Symbol/icon type
  type?: string;   // Waypoint category
}

if (route.waypoints) {
  for (const wp of route.waypoints) {
    console.log(`${wp.name} at ${wp.lat}, ${wp.lon}`);
  }
}
```

## Unit Formatting

Format distances and elevations for display in metric or imperial units:

```typescript
import { formatDistance, formatElevation } from 'peaktime';

formatDistance(12400);                    // "12.4 km"
formatDistance(12400, 'imperial');        // "7.7 mi"
formatDistance(500);                      // "500 m"
formatDistance(500, 'imperial');          // "1640 ft"

formatElevation(856);                    // "856 m"
formatElevation(856, 'imperial');        // "2,808 ft"
```
