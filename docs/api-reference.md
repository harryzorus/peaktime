---
title: API Reference
description: Complete TypeScript API reference for all Peaktime modules.
order: 40
---

# API Reference

Complete API reference for Peaktime. All functions and types are organized by module.

## Sun Module

Imported from the main package:

```typescript
import { calculateSunTimes, getSunPosition, getTwilightPhase, formatSunTime } from 'peaktime';
```

### Types

```typescript
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface SunPosition {
  elevation: number;   // Degrees above/below horizon
  azimuth: number;     // Compass bearing 0-360°
}

type TwilightPhase = 'night' | 'astronomical' | 'nautical' | 'civil' | 'golden' | 'day'

interface SunTimes {
  date: Date;
  coordinates: Coordinates;
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  civilTwilightStart: Date;
  civilTwilightEnd: Date;
  nauticalTwilightStart: Date;
  nauticalTwilightEnd: Date;
  astronomicalTwilightStart: Date;
  astronomicalTwilightEnd: Date;
  goldenHourMorningStart: Date;
  goldenHourMorningEnd: Date;
  goldenHourEveningStart: Date;
  goldenHourEveningEnd: Date;
  blueHourMorningStart: Date;
  blueHourMorningEnd: Date;
  blueHourEveningStart: Date;
  blueHourEveningEnd: Date;
  dayLength: number;  // Minutes
}

interface SunTimesOptions {
  timezone?: string;  // Default: 'UTC'
}
```

### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `calculateSunTimes` | `(date, coords, options?) → SunTimes` | All sun events for a date and location |
| `getSunPosition` | `(date, coords) → SunPosition` | Sun elevation and azimuth at a moment |
| `getTwilightPhase` | `(elevation) → TwilightPhase` | Phase from solar elevation angle |
| `formatSunTime` | `(date, timezone?) → string` | Format time for display (e.g., "5:31 AM") |

---

## GPX Module

Imported from the main package:

```typescript
import {
  parseGPX, parseGPXOrThrow,
  calculateRouteStats, haversineDistance, distance3D,
  calculateGrade, smoothElevation,
  formatDistance, formatElevation
} from 'peaktime';
```

### Types

```typescript
interface GPXPoint {
  lat: number;
  lon: number;
  ele: number;
  time?: Date;
}

interface GPXWaypoint {
  lat: number;
  lon: number;
  ele?: number;
  name: string;
  sym?: string;
  type?: string;
}

type ActivityType = 'hiking' | 'cycling' | 'running' | 'walking' | 'unknown'

interface GPXMetadata {
  name: string;
  description?: string;
  author?: string;
  link?: string;
  type: ActivityType;
  time?: Date;
}

interface GPXRoute {
  metadata: GPXMetadata;
  points: GPXPoint[];
  waypoints?: GPXWaypoint[];
}

interface RouteStats {
  totalDistance: number;
  totalElevationGain: number;
  totalElevationLoss: number;
  maxElevation: number;
  minElevation: number;
  startPoint: GPXPoint;
  endPoint: GPXPoint;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  pointCount: number;
}

type GPXParseResult =
  | { success: true; route: GPXRoute }
  | { success: false; error: GPXParseError }

interface GPXParseError {
  message: string;
  line?: number;
  column?: number;
}
```

### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseGPX` | `(content) → GPXParseResult` | Parse GPX with result type |
| `parseGPXOrThrow` | `(content) → GPXRoute` | Parse GPX, throw on error |
| `calculateRouteStats` | `(route, options?) → RouteStats` | Distance, elevation, bounds |
| `haversineDistance` | `(p1, p2) → number` | 2D distance in meters |
| `distance3D` | `(p1, p2) → number` | 3D distance in meters |
| `calculateGrade` | `(p1, p2) → number` | Grade as percentage |
| `smoothElevation` | `(points, window?) → number[]` | Moving average filter |
| `formatDistance` | `(meters, unit?) → string` | "12.4 km" or "7.7 mi" |
| `formatElevation` | `(meters, unit?) → string` | "856 m" or "2,808 ft" |

---

## Hike Module

Imported from the main package:

```typescript
import {
  estimateHikingTime, naismithTime, toblerTime, langmuirTime, munterTime,
  estimateTime, compareModels, calculateRouteMetrics,
  createPlanSummary, planHike, planAllOptions,
  PARAMS_BY_FITNESS, FITNESS_LEVELS, HIKING_MODELS, TERRAIN_TYPES,
  formatHikingTime
} from 'peaktime';
```

### Types

```typescript
type HikingModel = 'naismith' | 'tobler' | 'langmuir' | 'munter'
type FitnessLevel = 'leisurely' | 'moderate' | 'active' | 'athletic' | 'fast' | 'elite'
type TerrainType = 'paved' | 'good_trail' | 'rough_trail' | 'scramble' | 'off_trail' | 'snow'

type SunTarget = 'sunrise' | 'goldenHourStart' | 'goldenHourEnd'
  | 'blueHourStart' | 'blueHourEnd' | 'sunset'
  | 'goldenHourEveningStart' | 'goldenHourEveningEnd'
  | 'blueHourEveningStart' | 'blueHourEveningEnd'

interface HikingParams {
  baseSpeedKmh: number;
  uphillPenaltyMinPer100m: number;
  downhillBonusMinPer100m: number;
  breakIntervalMinutes: number;
  breakDurationMinutes: number;
}

interface HikingTimeEstimate {
  movingTime: number;
  totalTime: number;
  breakCount: number;
  params: HikingParams;
  segments: SegmentTime[];
}

interface HikePlan {
  target: SunTarget;
  targetTime: Date;
  bufferMinutes: number;
  startTime: Date;
  hikingDuration: number;
  feasible: boolean;
  shortBy?: number;
}

interface PlanSummary {
  plan: HikePlan;
  alternatives: HikePlan[];
  estimate: HikingTimeEstimate;
  sunTimes: SunTimes;
  coordinates: Coordinates;
}

interface PlannerOptions {
  bufferMinutes?: number;
  hikingParams?: Partial<HikingParams>;
  nightHiking?: boolean;
  nightHikingMultiplier?: number;
}
```

### Model Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `naismithTime` | `(distance, gain) → number` | Naismith's Rule (1892) |
| `toblerTime` | `(points) → number` | Tobler's function (1993) |
| `langmuirTime` | `(distance, gain, loss, grade?) → number` | Langmuir correction (1984) |
| `munterTime` | `(distance, gain, loss) → number` | Swiss Alpine Club method |
| `estimateTime` | `(metrics, model?, fitness?, terrain?) → number` | Unified estimator |
| `compareModels` | `(metrics, fitness?, terrain?) → Record` | All models at once |

### Planning Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `createPlanSummary` | `(route, date, target?, options?) → PlanSummary` | Full plan with alternatives |
| `planHike` | `(route, date, coords, target?, options?) → HikePlan` | Single plan |
| `planAllOptions` | `(route, date, coords, mode?, options?) → HikePlan[]` | All sun targets |

### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `PARAMS_BY_FITNESS` | `Record<FitnessLevel, HikingParams>` | Default params per fitness |
| `FITNESS_LEVELS` | `Record<FitnessLevel, FitnessInfo>` | Fitness level metadata |
| `HIKING_MODELS` | `Record<HikingModel, ModelInfo>` | Model metadata |
| `TERRAIN_TYPES` | `Record<TerrainType, TerrainInfo>` | Terrain metadata |

---

## Bike Module

Imported as a namespace:

```typescript
import * as bike from 'peaktime/bike';
```

### Types

```typescript
type BikeType = 'road' | 'gravel' | 'mtb' | 'tt' | 'ebike'
type BikeTerrain = 'smooth_pavement' | 'rough_pavement' | 'gravel' | 'hardpack' | 'singletrack' | 'mud'
type BikeFitnessLevel = 'casual' | 'recreational' | 'trained' | 'competitive' | 'elite' | 'pro'

interface CyclingParams {
  ftpWatts: number;
  riderWeightKg: number;
  bikeWeightKg: number;
  crr: number;
  cdA: number;
  airDensity: number;
  drivetrainEfficiency: number;
}

interface CyclingTimeEstimate {
  movingTime: number;
  averagePower: number;
  normalizedPower: number;
  averageSpeed: number;
  params: CyclingParams;
  segments: BikeSegmentTime[];
}

interface BikePlanSummary {
  plan: BikePlan;
  alternatives: BikePlan[];
  estimate: CyclingTimeEstimate;
  sunTimes: SunTimes;
  coordinates: Coordinates;
}
```

### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `quickEstimate` | `(dist, gain, loss, fitness?, bike?, terrain?, weight?) → number` | Fast estimate |
| `estimateCyclingTime` | `(points, params) → CyclingTimeEstimate` | Full segment analysis |
| `getDefaultCyclingParams` | `(fitness, bikeType, weight) → CyclingParams` | Build params from presets |
| `createBikePlanSummary` | `(route, date, target?, options?) → BikePlanSummary` | Full plan |
| `speedFromPowerFull` | `(power, params, grade) → number` | Physics solver |

---

## Run Module

Imported as a namespace:

```typescript
import * as run from 'peaktime/run';
```

### Types

```typescript
type RunTerrain = 'road' | 'track' | 'good_trail' | 'technical_trail' | 'alpine' | 'sand'
type RunFitnessLevel = 'beginner' | 'recreational' | 'trained' | 'competitive' | 'elite' | 'ultra'

interface RunningParams {
  flatPaceMinPerKm: number;
  terrainMultiplier: number;
  breakIntervalMinutes: number;
  breakDurationMinutes: number;
}

interface RunningTimeEstimate {
  movingTime: number;
  totalTime: number;
  breakCount: number;
  averagePace: number;
  gapPace: number;
  params: RunningParams;
  segments: RunSegmentTime[];
}

interface RunPlanSummary {
  plan: RunPlan;
  alternatives: RunPlan[];
  estimate: RunningTimeEstimate;
  sunTimes: SunTimes;
  coordinates: Coordinates;
}
```

### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `gapMultiplier` | `(gradePercent) → number` | GAP pace multiplier |
| `paceForGrade` | `(flatPace, grade, terrain?) → number` | Adjusted pace |
| `quickEstimate` | `(dist, gain, loss, fitness?, terrain?) → number` | Fast estimate |
| `estimateRunningTime` | `(points, params) → RunningTimeEstimate` | Full segment analysis |
| `getDefaultRunningParams` | `(fitness, terrain) → RunningParams` | Build params from presets |
| `createRunPlanSummary` | `(route, date, target?, options?) → RunPlanSummary` | Full plan |
| `formatPace` | `(paceMinPerKm) → string` | Format as "5:30 min/km" |
