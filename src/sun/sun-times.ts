/**
 * Sun time calculations using NOAA solar calculator algorithm
 *
 * Reference: https://gml.noaa.gov/grad/solcalc/calcdetails.html
 *
 * This implementation calculates:
 * - Sunrise/sunset times
 * - Civil, nautical, and astronomical twilight
 * - Golden hour and blue hour times for photography
 * - Solar noon and day length
 */

import type { Coordinates, SunPosition, SunTimes, SunTimesOptions, TwilightPhase } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Sun elevation angles for various events (degrees)
const SUNRISE_SUNSET_ANGLE = -0.833; // Accounts for refraction and sun radius
const CIVIL_TWILIGHT_ANGLE = -6;
const NAUTICAL_TWILIGHT_ANGLE = -12;
const ASTRONOMICAL_TWILIGHT_ANGLE = -18;
const GOLDEN_HOUR_END_ANGLE = 6;
const BLUE_HOUR_END_ANGLE = -4;

/**
 * Calculate Julian Day from a Date object
 */
function dateToJulianDay(date: Date): number {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;
	const day = date.getUTCDate();
	const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

	const jd =
		367 * year -
		Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4) +
		Math.floor((275 * month) / 9) +
		day +
		1721013.5 +
		hour / 24;

	return jd;
}

/**
 * Calculate Julian Century from Julian Day
 */
function julianDayToJulianCentury(jd: number): number {
	return (jd - 2451545) / 36525;
}

/**
 * Calculate geometric mean longitude of the sun (degrees)
 */
function sunGeometricMeanLongitude(T: number): number {
	let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
	while (L0 > 360) L0 -= 360;
	while (L0 < 0) L0 += 360;
	return L0;
}

/**
 * Calculate geometric mean anomaly of the sun (degrees)
 */
function sunGeometricMeanAnomaly(T: number): number {
	return 357.52911 + T * (35999.05029 - 0.0001537 * T);
}

/**
 * Calculate eccentricity of Earth's orbit
 */
function earthOrbitEccentricity(T: number): number {
	return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
}

/**
 * Calculate sun equation of center (degrees)
 */
function sunEquationOfCenter(T: number): number {
	const M = sunGeometricMeanAnomaly(T);
	const mrad = M * DEG_TO_RAD;
	const sinm = Math.sin(mrad);
	const sin2m = Math.sin(2 * mrad);
	const sin3m = Math.sin(3 * mrad);
	return (
		sinm * (1.9146 - T * (0.004817 + 0.000014 * T)) +
		sin2m * (0.019993 - 0.000101 * T) +
		sin3m * 0.00029
	);
}

/**
 * Calculate sun true longitude (degrees)
 */
function sunTrueLongitude(T: number): number {
	return sunGeometricMeanLongitude(T) + sunEquationOfCenter(T);
}

/**
 * Calculate sun apparent longitude (degrees)
 */
function sunApparentLongitude(T: number): number {
	const O = sunTrueLongitude(T);
	const omega = 125.04 - 1934.136 * T;
	return O - 0.00569 - 0.00478 * Math.sin(omega * DEG_TO_RAD);
}

/**
 * Calculate mean obliquity of the ecliptic (degrees)
 */
function meanObliquityOfEcliptic(T: number): number {
	const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
	return 23 + (26 + seconds / 60) / 60;
}

/**
 * Calculate corrected obliquity of the ecliptic (degrees)
 */
function obliquityCorrection(T: number): number {
	const e0 = meanObliquityOfEcliptic(T);
	const omega = 125.04 - 1934.136 * T;
	return e0 + 0.00256 * Math.cos(omega * DEG_TO_RAD);
}

/**
 * Calculate sun declination (degrees)
 */
function sunDeclination(T: number): number {
	const e = obliquityCorrection(T);
	const lambda = sunApparentLongitude(T);
	const sint = Math.sin(e * DEG_TO_RAD) * Math.sin(lambda * DEG_TO_RAD);
	return Math.asin(sint) * RAD_TO_DEG;
}

/**
 * Calculate equation of time (minutes)
 */
function equationOfTime(T: number): number {
	const e = obliquityCorrection(T);
	const L0 = sunGeometricMeanLongitude(T);
	const ecc = earthOrbitEccentricity(T);
	const M = sunGeometricMeanAnomaly(T);

	let y = Math.tan((e * DEG_TO_RAD) / 2);
	y *= y;

	const sin2l0 = Math.sin(2 * L0 * DEG_TO_RAD);
	const sinm = Math.sin(M * DEG_TO_RAD);
	const cos2l0 = Math.cos(2 * L0 * DEG_TO_RAD);
	const sin4l0 = Math.sin(4 * L0 * DEG_TO_RAD);
	const sin2m = Math.sin(2 * M * DEG_TO_RAD);

	const Etime =
		y * sin2l0 -
		2 * ecc * sinm +
		4 * ecc * y * sinm * cos2l0 -
		0.5 * y * y * sin4l0 -
		1.25 * ecc * ecc * sin2m;

	return Etime * RAD_TO_DEG * 4; // Convert to minutes
}

/**
 * Calculate hour angle for a given sun elevation (degrees)
 * Returns NaN if sun never reaches that elevation
 */
function hourAngleForElevation(lat: number, decl: number, elevation: number): number {
	const latRad = lat * DEG_TO_RAD;
	const declRad = decl * DEG_TO_RAD;
	const elevRad = elevation * DEG_TO_RAD;

	const cosHA =
		(Math.sin(elevRad) - Math.sin(latRad) * Math.sin(declRad)) /
		(Math.cos(latRad) * Math.cos(declRad));

	if (cosHA > 1 || cosHA < -1) {
		return NaN; // Sun never reaches this elevation
	}

	return Math.acos(cosHA) * RAD_TO_DEG;
}

/**
 * Calculate solar noon in minutes from midnight UTC
 */
function solarNoonMinutes(longitude: number, eqTime: number): number {
	return 720 - 4 * longitude - eqTime;
}

/**
 * Calculate time of sun event (sunrise, sunset, twilight) in minutes from midnight UTC
 */
function sunEventMinutes(
	longitude: number,
	eqTime: number,
	hourAngle: number,
	isMorning: boolean,
): number {
	const noon = solarNoonMinutes(longitude, eqTime);
	return isMorning ? noon - hourAngle * 4 : noon + hourAngle * 4;
}

/**
 * Convert minutes from midnight UTC to Date object
 */
function minutesToDate(baseDate: Date, minutesUTC: number): Date {
	const result = new Date(baseDate);
	result.setUTCHours(0, 0, 0, 0);
	result.setUTCMinutes(minutesUTC);
	return result;
}

/**
 * Get sun position at a specific time
 */
export function getSunPosition(date: Date, coords: Coordinates): SunPosition {
	const jd = dateToJulianDay(date);
	const T = julianDayToJulianCentury(jd);
	const decl = sunDeclination(T);
	const eqTime = equationOfTime(T);

	const latRad = coords.latitude * DEG_TO_RAD;
	const declRad = decl * DEG_TO_RAD;

	// Calculate hour angle
	const solarNoon = solarNoonMinutes(coords.longitude, eqTime);
	const currentMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
	const hourAngle = (currentMinutes - solarNoon) / 4; // degrees

	// Calculate elevation
	const haRad = hourAngle * DEG_TO_RAD;
	const sinElev =
		Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad);
	const elevation = Math.asin(sinElev) * RAD_TO_DEG;

	// Calculate azimuth
	const cosAz =
		(Math.sin(declRad) - Math.sin(latRad) * sinElev) /
		(Math.cos(latRad) * Math.cos(elevation * DEG_TO_RAD));
	let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD_TO_DEG;
	if (hourAngle > 0) azimuth = 360 - azimuth;

	return { elevation, azimuth };
}

/**
 * Determine twilight phase based on sun elevation
 */
export function getTwilightPhase(elevation: number): TwilightPhase {
	if (elevation > GOLDEN_HOUR_END_ANGLE) return "day";
	if (elevation > 0) return "golden";
	if (elevation > CIVIL_TWILIGHT_ANGLE) return "civil";
	if (elevation > NAUTICAL_TWILIGHT_ANGLE) return "nautical";
	if (elevation > ASTRONOMICAL_TWILIGHT_ANGLE) return "astronomical";
	return "night";
}

/**
 * Calculate all sun times for a given date and location
 */
export function calculateSunTimes(
	date: Date,
	coords: Coordinates,
	_options: SunTimesOptions = {},
): SunTimes {
	// Normalize to noon UTC for the calculation base
	const baseDate = new Date(date);
	baseDate.setUTCHours(12, 0, 0, 0);

	const jd = dateToJulianDay(baseDate);
	const T = julianDayToJulianCentury(jd);
	const decl = sunDeclination(T);
	const eqTime = equationOfTime(T);

	// Helper to calculate event time
	const getEventTime = (angle: number, isMorning: boolean): Date => {
		const ha = hourAngleForElevation(coords.latitude, decl, angle);
		if (Number.isNaN(ha)) {
			// Sun never reaches this angle - return noon or midnight
			const noon = solarNoonMinutes(coords.longitude, eqTime);
			return minutesToDate(baseDate, isMorning ? noon - 720 : noon + 720);
		}
		const minutes = sunEventMinutes(coords.longitude, eqTime, ha, isMorning);
		return minutesToDate(baseDate, minutes);
	};

	// Calculate all events
	const sunrise = getEventTime(SUNRISE_SUNSET_ANGLE, true);
	const sunset = getEventTime(SUNRISE_SUNSET_ANGLE, false);
	const noonMinutes = solarNoonMinutes(coords.longitude, eqTime);
	const solarNoon = minutesToDate(baseDate, noonMinutes);

	const civilTwilightStart = getEventTime(CIVIL_TWILIGHT_ANGLE, true);
	const civilTwilightEnd = getEventTime(CIVIL_TWILIGHT_ANGLE, false);

	const nauticalTwilightStart = getEventTime(NAUTICAL_TWILIGHT_ANGLE, true);
	const nauticalTwilightEnd = getEventTime(NAUTICAL_TWILIGHT_ANGLE, false);

	const astronomicalTwilightStart = getEventTime(ASTRONOMICAL_TWILIGHT_ANGLE, true);
	const astronomicalTwilightEnd = getEventTime(ASTRONOMICAL_TWILIGHT_ANGLE, false);

	const goldenHourMorningEnd = getEventTime(GOLDEN_HOUR_END_ANGLE, true);
	const goldenHourEveningStart = getEventTime(GOLDEN_HOUR_END_ANGLE, false);

	const blueHourMorningEnd = getEventTime(BLUE_HOUR_END_ANGLE, true);
	const blueHourEveningStart = getEventTime(BLUE_HOUR_END_ANGLE, false);

	// Calculate day length in minutes
	const dayLength = (sunset.getTime() - sunrise.getTime()) / (1000 * 60);

	return {
		date: baseDate,
		coordinates: coords,
		sunrise,
		sunset,
		solarNoon,
		civilTwilightStart,
		civilTwilightEnd,
		nauticalTwilightStart,
		nauticalTwilightEnd,
		astronomicalTwilightStart,
		astronomicalTwilightEnd,
		goldenHourMorningStart: sunrise,
		goldenHourMorningEnd,
		goldenHourEveningStart,
		goldenHourEveningEnd: sunset,
		blueHourMorningStart: civilTwilightStart,
		blueHourMorningEnd,
		blueHourEveningStart,
		blueHourEveningEnd: civilTwilightEnd,
		dayLength,
	};
}

/**
 * Format a Date to local time string for display
 */
export function formatSunTime(date: Date, timezone: string = "UTC"): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone,
	});
}
