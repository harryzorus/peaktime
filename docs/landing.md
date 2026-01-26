---
version: '0.2.0'

hero:
  tagline: 'Catch the perfect light.'
  subtitle: 'Calculate optimal start times for hiking, cycling, and trail running to catch sunrise, golden hour, or blue hour at any summit.'

features:
  sunCalculations:
    title: 'Accurate Sun Times'
    description: 'NOAA algorithm for sunrise, sunset, civil/nautical/astronomical twilight, golden hour, and blue hour. Accurate to within a minute.'
    points:
      - 'Sunrise & sunset'
      - 'Golden hour (morning & evening)'
      - 'Blue hour (civil twilight)'
      - 'Sun position & azimuth'

  hikingModels:
    title: 'Four Estimation Models'
    description: 'Choose the model that matches your hiking style.'
    models:
      - name: 'Naismith'
        year: 1892
        description: 'Classic rule: 5 km/h + 30 min per 300m ascent'
        formula: 'T = D/5 + h/600'
      - name: 'Tobler'
        year: 1993
        description: 'Exponential speed function based on slope'
        formula: 'v = 6 * e^(-3.5|s + 0.05|)'
      - name: 'Langmuir'
        year: 1984
        description: 'Naismith with descent adjustments'
        formula: 'Adds time for steep descents'
      - name: 'Munter'
        year: 1980
        description: 'Swiss Alpine Club method (default)'
        formula: 'max(Th, Tv) + min(Th, Tv)/2'

  fitnessLevels:
    title: 'Personalized Pace'
    description: 'Calibrate estimates to your fitness level using 10K run time as a baseline.'
    levels:
      - name: 'Leisurely'
        tenK: '70+ min'
        multiplier: 0.75
      - name: 'Moderate'
        tenK: '55-70 min'
        multiplier: 1.0
      - name: 'Active'
        tenK: '45-55 min'
        multiplier: 1.25
      - name: 'Athletic'
        tenK: '38-45 min'
        multiplier: 1.56
      - name: 'Fast'
        tenK: '32-38 min'
        multiplier: 2.0
      - name: 'Elite'
        tenK: 'Under 32 min'
        multiplier: 2.5

  terrainTypes:
    title: 'Terrain Multipliers'
    description: 'Adjust for trail conditions.'
    types:
      - name: 'Paved'
        multiplier: 0.9
      - name: 'Good trail'
        multiplier: 1.0
      - name: 'Rough trail'
        multiplier: 1.25
      - name: 'Scramble'
        multiplier: 1.5
      - name: 'Off-trail'
        multiplier: 1.75
      - name: 'Snow'
        multiplier: 1.5

  gpxParsing:
    title: 'GPX Support'
    description: 'Parse GPX files from any source with elevation data.'
    points:
      - 'Track points & route points'
      - 'Elevation smoothing'
      - 'Distance & gain calculation'
      - 'Browser & Node.js support'

quickstart:
  install: 'npm install peaktime'
  usage: |
    import { parseGPXOrThrow, createPlanSummary, formatStartTime } from 'peaktime';

    const route = parseGPXOrThrow(gpxContent);
    const plan = createPlanSummary(route, new Date('2026-06-21'), 'sunrise');

    console.log(formatStartTime(plan.startTime, 'America/Los_Angeles'));
    // → "4:47 AM"

useWhen:
  - 'Planning sunrise/sunset summit hikes, bike rides, or trail runs'
  - 'Calculating hiking, cycling, or running times with multiple models'
  - 'Building outdoor adventure apps'
  - 'Parsing GPX files in browser or Node.js'

dontUseWhen:
  - 'Real-time GPS tracking (use native APIs)'
  - 'Complex route planning with waypoints'
  - 'Trail difficulty ratings'

links:
  github: 'https://github.com/harryzorus/peaktime'
  npm: 'https://www.npmjs.com/package/peaktime'

specs:
  license: 'Apache 2.0'
  size: '~15KB minified'
  platforms: 'Browser, Node.js, Deno'
---

# Peaktime

Calculate optimal start times for outdoor activities.
