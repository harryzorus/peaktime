---
title: Sun Calculations
description: NOAA solar algorithm, sun events, twilight phases, and golden/blue hour calculations.
order: 20
---

# Sun Calculations

Peaktime's sun module calculates sunrise, sunset, twilight phases, golden hour, and blue hour for any location and date. It uses the NOAA solar calculator algorithm, which is accurate to within a minute.

## Sun Events

`calculateSunTimes` returns a complete `SunTimes` object with all events for a given date and location:

```typescript
import { calculateSunTimes } from 'peaktime';

const times = calculateSunTimes(
  new Date('2026-06-21'),
  { latitude: 39.1178, longitude: -106.4453 },  // Mt. Elbert, CO
  { timezone: 'America/Denver' }
);

console.log(times.sunrise);          // Sunrise
console.log(times.goldenHourMorningStart);  // Golden hour begins
console.log(times.blueHourMorningStart);    // Blue hour begins
console.log(times.dayLength);        // Day length in minutes
```

## Twilight Phases

The sun module tracks six distinct phases based on the sun's elevation angle:

| Phase | Sun Angle | Description |
|-------|-----------|-------------|
| Night | below -18° | Full darkness |
| Astronomical twilight | -18° to -12° | Stars begin to fade |
| Nautical twilight | -12° to -6° | Horizon visible at sea |
| Civil twilight | -6° to 0° | Enough light to work outdoors |
| Golden hour | 0° to 6° | Warm, directional light |
| Day | above 6° | Full daylight |

Use `getTwilightPhase` to determine the current phase from a solar elevation angle:

```typescript
import { getSunPosition, getTwilightPhase } from 'peaktime';

const position = getSunPosition(new Date(), { latitude: 39.1178, longitude: -106.4453 });
const phase = getTwilightPhase(position.elevation);
// → 'golden' | 'civil' | 'nautical' | etc.
```

## Golden Hour and Blue Hour

These are the times photographers and hikers care about most.

**Golden hour** occurs when the sun is between 0° and 6° above the horizon. Light is warm, soft, and directional. Peaktime calculates both morning and evening golden hours:

- `goldenHourMorningStart` / `goldenHourMorningEnd`
- `goldenHourEveningStart` / `goldenHourEveningEnd`

**Blue hour** occurs when the sun is between -6° and -4° below the horizon. The sky takes on deep blue tones. Also calculated for morning and evening:

- `blueHourMorningStart` / `blueHourMorningEnd`
- `blueHourEveningStart` / `blueHourEveningEnd`

## Sun Position

For any moment in time, you can get the sun's exact position:

```typescript
import { getSunPosition } from 'peaktime';

const pos = getSunPosition(
  new Date('2026-06-21T12:00:00'),
  { latitude: 39.1178, longitude: -106.4453 }
);

console.log(pos.elevation);  // Degrees above horizon
console.log(pos.azimuth);    // Compass bearing (0-360°)
```

## The NOAA Algorithm

The solar calculations are based on the NOAA Solar Calculator, which implements the astronomical algorithms described by Jean Meeus. The key steps are:

1. **Julian Day** — Convert the date to Julian Day Number
2. **Solar Mean Anomaly** — The sun's position in its orbit
3. **Equation of Center** — Correction for orbital eccentricity
4. **Solar Declination** — The sun's angle relative to the equator
5. **Hour Angle** — Convert declination to rise/set times for the given latitude

The algorithm handles edge cases like polar day (midnight sun) and polar night, though these conditions may result in `NaN` for events that don't occur.

## Formatting

Use `formatSunTime` for display:

```typescript
import { formatSunTime } from 'peaktime';

const formatted = formatSunTime(times.sunrise, 'America/Denver');
// → "5:31 AM"
```
