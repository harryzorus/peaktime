/**
 * Peaktime
 *
 * Sun calculations, GPX parsing, and time estimation for
 * hiking, cycling, and trail running adventures.
 *
 * @packageDocumentation
 */

// Cycling module - namespaced to avoid conflicts
export * as bike from "./bike";

// Common shared module - namespaced to avoid conflicts
export * as common from "./common";

// GPX parsing (shared by all activity types)
export * from "./gpx";

// Hiking module - exports everything directly for backward compatibility
export * from "./hike";
// Running module - namespaced to avoid conflicts
export * as run from "./run";
// Sun calculations (shared by all activity types)
export * from "./sun";
