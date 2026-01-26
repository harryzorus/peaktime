# peaktime

![CI](https://github.com/harryzorus/peaktime/actions/workflows/ci.yml/badge.svg)

Calculate optimal outdoor adventure start times to catch sunrise, golden hour, or blue hour at any destination.

## Features

- **Sun calculations** - Accurate sunrise/sunset times, twilight phases, golden hour, blue hour (NOAA algorithm)
- **GPX parsing** - Parse GPX files with metadata, track points, and elevation data
- **Route statistics** - Distance, elevation gain/loss, bounds calculation with optional smoothing
- **Hiking time estimation** - Modified Naismith's rule with configurable parameters
- **Hike planning** - Calculate start times to arrive at summit for specific sun events

## Installation

```bash
npm install peaktime
```

For Node.js GPX parsing, also install jsdom:

```bash
npm install jsdom
```

## Usage

### Calculate Sun Times

```typescript
import { calculateSunTimes, getSunPosition, formatSunTime } from 'peaktime';

const coords = { latitude: 37.9235, longitude: -122.5965 };
const date = new Date('2026-01-26');

const times = calculateSunTimes(date, coords);
console.log('Sunrise:', formatSunTime(times.sunrise, 'America/Los_Angeles'));
console.log('Golden hour ends:', formatSunTime(times.goldenHourMorningEnd, 'America/Los_Angeles'));

const position = getSunPosition(times.sunrise, coords);
console.log('Sun azimuth at sunrise:', position.azimuth);
```

### Parse GPX and Calculate Stats

```typescript
import { parseGPX, calculateRouteStats, formatDistance, formatElevation } from 'peaktime';

const gpxContent = fs.readFileSync('route.gpx', 'utf-8');
const result = parseGPX(gpxContent);

if (result.success) {
	const stats = calculateRouteStats(result.route);
	console.log('Distance:', formatDistance(stats.totalDistance, 'imperial'));
	console.log('Elevation gain:', formatElevation(stats.totalElevationGain, 'imperial'));
}
```

### Estimate Hiking Time

```typescript
import { parseGPXOrThrow, estimateHikingTime, formatHikingTime } from 'peaktime';

const route = parseGPXOrThrow(gpxContent);
const estimate = estimateHikingTime(route, {
	baseSpeedKmh: 4.5, // Slower pace
	uphillPenaltyMinPer100m: 12 // More time for elevation
});

console.log('Moving time:', formatHikingTime(estimate.movingTime));
console.log('Total time (with breaks):', formatHikingTime(estimate.totalTime));
```

### Plan a Sunrise Hike

```typescript
import { parseGPXOrThrow, createPlanSummary, formatStartTime } from 'peaktime';

const route = parseGPXOrThrow(gpxContent);
const date = new Date('2026-01-26');

const summary = createPlanSummary(route, date, 'sunrise', {
	bufferMinutes: 15,
	nightHiking: true
});

console.log('Start time:', formatStartTime(summary.plan.startTime, 'America/Los_Angeles'));
console.log('Arrive for:', summary.plan.target);
console.log('Feasible:', summary.plan.feasible);
```

## API Reference

### Sun Module

- `calculateSunTimes(date, coordinates)` - Calculate all sun times for a date/location
- `getSunPosition(date, coordinates)` - Get sun elevation and azimuth
- `getTwilightPhase(elevation)` - Determine twilight phase from sun elevation
- `formatSunTime(date, timezone)` - Format time for display

### GPX Module

- `parseGPX(content)` - Parse GPX content, returns `{ success, route }` or `{ success, error }`
- `parseGPXOrThrow(content)` - Parse GPX content, throws on error
- `calculateRouteStats(route, options?)` - Calculate distance, elevation, bounds
- `haversineDistance(p1, p2)` - Distance between two points in meters
- `formatDistance(meters, unit)` - Format distance for display
- `formatElevation(meters, unit)` - Format elevation for display

### Hiking Module

- `estimateHikingTime(route, params?)` - Estimate hiking time with segment breakdown
- `planHike(route, date, coordinates, target, options?)` - Plan hike for sun event
- `planAllOptions(route, date, coordinates, options?)` - Get plans for all targets
- `createPlanSummary(route, date, target?, options?)` - Complete plan with alternatives
- `getDestinationCoordinates(route)` - Get summit coordinates from route
- `formatHikingTime(minutes)` - Format duration for display

### Types

```typescript
interface Coordinates {
	latitude: number;
	longitude: number;
}

interface GPXPoint {
	lat: number;
	lon: number;
	ele: number;
	time?: Date;
}

interface HikingParams {
	baseSpeedKmh: number; // Default: 5
	uphillPenaltyMinPer100m: number; // Default: 10
	downhillBonusMinPer100m: number; // Default: 3
	breakIntervalMinutes: number; // Default: 60
	breakDurationMinutes: number; // Default: 5
}

type SunriseTarget =
	| 'sunrise'
	| 'goldenHourStart'
	| 'goldenHourEnd'
	| 'blueHourStart'
	| 'blueHourEnd';
```

## Algorithm Notes

### Sun Calculations

Uses the NOAA Solar Calculator algorithm, accurate to within a minute for dates between 1901-2099.

### Hiking Time Estimation

Based on Naismith's rule (5 km/h + 30 min per 300m ascent) with modifications:

- Configurable base speed
- Separate uphill penalty and downhill bonus
- Optional break scheduling
- Night hiking speed adjustment

### GPX Parsing

- Works in browser with native DOMParser
- Works in Node.js with optional jsdom peer dependency
- Supports both track points (`<trkpt>`) and route points (`<rtept>`)
- Elevation smoothing to reduce GPS noise

## Development

```bash
bun install              # Install dependencies
bun run check            # TypeScript type checking
bun run lint             # Biome linter
bun run lint:fix         # Auto-fix lint errors
bun run format           # Format code
```

### Testing

Three test tiers:

- **Unit tests** (`tests/unit/`) — function-level behavior, fast
- **Property tests** (`tests/property/`) — invariant checking with fast-check (500 cases each)
- **Calibration tests** (`tests/calibration/`) — real-world reference data validation

```bash
bun run test             # Watch mode (all tests)
bun run test:unit        # Unit tests only
bun run test:property    # Property-based tests
bun run test:calibration # Calibration tests
bun run test:run         # All tests, single run
```

### CI

GitHub Actions runs on every push and PR: type check, lint, then unit/property/calibration tests in parallel.

## License

Apache 2.0
