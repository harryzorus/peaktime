/**
 * GPX Parser
 *
 * Parse GPX (GPS Exchange Format) files into typed route data.
 * Works in both browser (native DOMParser) and Node.js (with optional jsdom).
 */

import type {
	ActivityType,
	GPXMetadata,
	GPXParseResult,
	GPXPoint,
	GPXRoute,
	GPXWaypoint,
} from "./types";

/**
 * Get a DOM Document from XML string
 * Uses native DOMParser in browser only.
 * For Node.js usage, parse the GPX on the client side.
 */
function getDocument(xml: string): Document {
	// Browser: use native DOMParser
	if (typeof DOMParser !== "undefined") {
		return new DOMParser().parseFromString(xml, "application/xml");
	}

	// Node.js: DOMParser not available
	// GPX parsing should happen client-side where DOMParser is available
	throw new Error("DOMParser not available. GPX parsing requires a browser environment.");
}

/**
 * Extract text content from an element, or undefined if not found
 */
function getElementText(parent: Element, tagName: string): string | undefined {
	const el = parent.getElementsByTagName(tagName)[0];
	return el?.textContent ?? undefined;
}

/**
 * Detect activity type from GPX metadata
 */
function detectActivityType(doc: Document, _metadata: Element | null): ActivityType {
	// Check track type element inside <trk>
	const trk = doc.getElementsByTagName("trk")[0];
	if (trk) {
		const typeEl = trk.getElementsByTagName("type")[0];
		if (typeEl?.textContent) {
			const type = typeEl.textContent.toLowerCase();
			if (type === "9" || type.includes("hiking") || type.includes("walk")) return "hiking";
			if (type === "1" || type.includes("cycle") || type.includes("bike") || type.includes("ride"))
				return "cycling";
			if (type === "0" || type.includes("run")) return "running";
		}
	}

	return "unknown";
}

/**
 * Parse GPX metadata
 */
function parseMetadata(doc: Document): GPXMetadata {
	const metadata = doc.getElementsByTagName("metadata")[0];
	const trk = doc.getElementsByTagName("trk")[0];

	// Name: prefer track name, fall back to metadata name
	const name =
		getElementText(trk, "name") ??
		(metadata ? getElementText(metadata, "name") : undefined) ??
		"Unnamed Route";

	// Description
	const description =
		getElementText(trk, "desc") ?? (metadata ? getElementText(metadata, "desc") : undefined);

	// Author
	const authorEl = metadata?.getElementsByTagName("author")[0];
	const author = authorEl ? getElementText(authorEl, "name") : undefined;

	// Link
	const linkEl = metadata?.getElementsByTagName("link")[0] ?? trk?.getElementsByTagName("link")[0];
	const link = linkEl?.getAttribute("href") ?? undefined;

	// Time
	const timeStr = metadata ? getElementText(metadata, "time") : undefined;
	const time = timeStr ? new Date(timeStr) : undefined;

	// Activity type
	const type = detectActivityType(doc, metadata);

	return { name, description, author, link, type, time };
}

/**
 * Parse track points from GPX document
 */
function parseTrackPoints(doc: Document): GPXPoint[] {
	const points: GPXPoint[] = [];

	// Get all track points (trkpt elements)
	const trkpts = doc.getElementsByTagName("trkpt");

	for (let i = 0; i < trkpts.length; i++) {
		const trkpt = trkpts[i];

		const lat = parseFloat(trkpt.getAttribute("lat") ?? "");
		const lon = parseFloat(trkpt.getAttribute("lon") ?? "");

		if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

		// Elevation (required for our use case, default to 0)
		const eleStr = getElementText(trkpt, "ele");
		const ele = eleStr ? parseFloat(eleStr) : 0;

		// Time (optional)
		const timeStr = getElementText(trkpt, "time");
		const time = timeStr ? new Date(timeStr) : undefined;

		points.push({ lat, lon, ele, time });
	}

	// Also check for route points (rtept) if no track points found
	if (points.length === 0) {
		const rtepts = doc.getElementsByTagName("rtept");
		for (let i = 0; i < rtepts.length; i++) {
			const rtept = rtepts[i];

			const lat = parseFloat(rtept.getAttribute("lat") ?? "");
			const lon = parseFloat(rtept.getAttribute("lon") ?? "");

			if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

			const eleStr = getElementText(rtept, "ele");
			const ele = eleStr ? parseFloat(eleStr) : 0;

			points.push({ lat, lon, ele });
		}
	}

	return points;
}

/**
 * Parse waypoint (<wpt>) elements from GPX document
 */
function parseWaypoints(doc: Document): GPXWaypoint[] {
	const waypoints: GPXWaypoint[] = [];
	const wpts = doc.getElementsByTagName("wpt");

	for (let i = 0; i < wpts.length; i++) {
		const wpt = wpts[i];

		const lat = parseFloat(wpt.getAttribute("lat") ?? "");
		const lon = parseFloat(wpt.getAttribute("lon") ?? "");
		if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

		const name = getElementText(wpt, "name") ?? `Waypoint ${i + 1}`;

		const eleStr = getElementText(wpt, "ele");
		const ele = eleStr ? parseFloat(eleStr) : undefined;

		const sym = getElementText(wpt, "sym");
		const type = getElementText(wpt, "type");

		waypoints.push({
			lat,
			lon,
			ele: ele !== undefined && !Number.isNaN(ele) ? ele : undefined,
			name,
			sym,
			type,
		});
	}

	return waypoints;
}

/**
 * Parse a GPX file content into a typed route object
 *
 * @param gpxContent - The raw GPX XML content
 * @returns Parse result with either the route or an error
 */
export function parseGPX(gpxContent: string): GPXParseResult {
	try {
		const doc = getDocument(gpxContent);

		// Check for parse errors
		const parseError = doc.querySelector("parsererror");
		if (parseError) {
			return {
				success: false,
				error: { message: `Invalid GPX XML: ${parseError.textContent}` },
			};
		}

		// Verify it's a GPX document
		const gpxEl = doc.getElementsByTagName("gpx")[0];
		if (!gpxEl) {
			return {
				success: false,
				error: { message: "Not a valid GPX file: missing <gpx> element" },
			};
		}

		const metadata = parseMetadata(doc);
		const points = parseTrackPoints(doc);

		if (points.length === 0) {
			return {
				success: false,
				error: { message: "GPX file contains no track points" },
			};
		}

		const waypoints = parseWaypoints(doc);

		const route: GPXRoute = { metadata, points };
		if (waypoints.length > 0) {
			route.waypoints = waypoints;
		}

		return {
			success: true,
			route,
		};
	} catch (e) {
		return {
			success: false,
			error: { message: e instanceof Error ? e.message : "Unknown parse error" },
		};
	}
}

/**
 * Parse a GPX file, throwing on error
 *
 * @param gpxContent - The raw GPX XML content
 * @returns The parsed GPX route
 * @throws Error if parsing fails
 */
export function parseGPXOrThrow(gpxContent: string): GPXRoute {
	const result = parseGPX(gpxContent);
	if (!result.success) {
		throw new Error(result.error.message);
	}
	return result.route;
}
