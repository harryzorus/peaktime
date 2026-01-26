/**
 * Sun position and timing types
 *
 * Based on NOAA solar calculator definitions.
 * All times are in UTC unless otherwise specified.
 */

/** Geographic coordinates for sun calculations */
export interface Coordinates {
	/** Latitude in degrees, positive = north */
	latitude: number;
	/** Longitude in degrees, positive = east */
	longitude: number;
}

/** Sun position at a specific moment */
export interface SunPosition {
	/** Solar elevation angle in degrees (-90 to 90). 0 = horizon, 90 = directly overhead */
	elevation: number;
	/** Solar azimuth in degrees (0-360). 0 = north, 90 = east, 180 = south, 270 = west */
	azimuth: number;
}

/** Twilight phase definitions based on sun elevation angle */
export type TwilightPhase =
	| "night" // sun < -18deg
	| "astronomical" // -18deg to -12deg
	| "nautical" // -12deg to -6deg
	| "civil" // -6deg to 0deg (blue hour)
	| "golden" // 0deg to 6deg (golden hour)
	| "day"; // sun > 6deg

/** Complete sun times for a given date and location */
export interface SunTimes {
	/** Input date (normalized to noon UTC for calculation) */
	date: Date;
	/** Observer coordinates */
	coordinates: Coordinates;

	// Core solar events
	/** Time when sun crosses horizon (rising) */
	sunrise: Date;
	/** Time when sun crosses horizon (setting) */
	sunset: Date;
	/** Time when sun reaches highest point */
	solarNoon: Date;

	// Civil twilight (-6deg elevation)
	/** Start of civil twilight (morning) - sky begins to brighten */
	civilTwilightStart: Date;
	/** End of civil twilight (evening) - sky becomes dark */
	civilTwilightEnd: Date;

	// Nautical twilight (-12deg elevation)
	/** Start of nautical twilight (morning) */
	nauticalTwilightStart: Date;
	/** End of nautical twilight (evening) */
	nauticalTwilightEnd: Date;

	// Astronomical twilight (-18deg elevation)
	/** Start of astronomical twilight (morning) - first light */
	astronomicalTwilightStart: Date;
	/** End of astronomical twilight (evening) - complete darkness */
	astronomicalTwilightEnd: Date;

	// Photography times (golden hour: 0deg to 6deg, blue hour: -6deg to -4deg)
	/** Start of morning golden hour (sunrise) */
	goldenHourMorningStart: Date;
	/** End of morning golden hour (sun at 6deg) */
	goldenHourMorningEnd: Date;
	/** Start of evening golden hour (sun at 6deg) */
	goldenHourEveningStart: Date;
	/** End of evening golden hour (sunset) */
	goldenHourEveningEnd: Date;

	/** Start of morning blue hour (civil twilight start, -6deg) */
	blueHourMorningStart: Date;
	/** End of morning blue hour (sun at -4deg) */
	blueHourMorningEnd: Date;
	/** Start of evening blue hour (sun at -4deg) */
	blueHourEveningStart: Date;
	/** End of evening blue hour (civil twilight end, -6deg) */
	blueHourEveningEnd: Date;

	/** Day length in minutes */
	dayLength: number;
}

/** Options for sun time calculation */
export interface SunTimesOptions {
	/** Timezone for output times (default: 'UTC') */
	timezone?: string;
}
