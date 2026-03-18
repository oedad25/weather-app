// ===========================================
// storage.ts — Persistent Data (localStorage)
// ===========================================
// This file handles saving data that survives page refreshes.
//
// localStorage is a browser API that stores key-value pairs as strings.
// It's perfect for small amounts of user preference data like:
// - Favorite cities
// - Theme preference (dark/light)
// - Temperature unit preference
//
// IMPORTANT: localStorage only stores strings, so we use
// JSON.stringify() to save objects and JSON.parse() to read them back.
// This is called "serialization" and "deserialization."

import { GeoLocation, TemperatureUnit } from "./types.js";

// Keys used in localStorage — defined as constants so we don't
// accidentally typo a string somewhere. If you misspell a constant,
// TypeScript catches it. If you misspell a string, it silently fails.
const KEYS = {
  FAVORITES: "skycheck_favorites",
  THEME: "skycheck_theme",
  UNIT: "skycheck_unit",
} as const;
// "as const" makes these values readonly and their types literal strings
// instead of just "string". It's a TypeScript best practice for constants.

/**
 * Maximum number of favorite cities a user can save.
 * We set a limit to keep the UI clean and prevent localStorage bloat.
 */
const MAX_FAVORITES = 5;

// ===========================================
// Theme Persistence
// ===========================================

export type Theme = "light" | "dark";

/**
 * Get the saved theme, or default to "light".
 */
export function getSavedTheme(): Theme {
  const saved = localStorage.getItem(KEYS.THEME);
  return saved === "dark" ? "dark" : "light";
}

/**
 * Save the theme preference.
 */
export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEYS.THEME, theme);
}

// ===========================================
// Unit Persistence
// ===========================================

/**
 * Get the saved temperature unit, or default to "fahrenheit".
 */
export function getSavedUnit(): TemperatureUnit {
  const saved = localStorage.getItem(KEYS.UNIT);
  return saved === "celsius" ? "celsius" : "fahrenheit";
}

/**
 * Save the unit preference.
 */
export function saveUnit(unit: TemperatureUnit): void {
  localStorage.setItem(KEYS.UNIT, unit);
}

// ===========================================
// Favorites Management
// ===========================================

/**
 * Get all saved favorite cities.
 *
 * We wrap this in a try/catch because localStorage data could
 * be corrupted (e.g. user manually edited it in DevTools).
 * Defensive coding like this prevents the whole app from crashing
 * because of bad stored data.
 */
export function getFavorites(): GeoLocation[] {
  try {
    const raw = localStorage.getItem(KEYS.FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Verify it's actually an array (extra safety)
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If JSON.parse fails, the data is corrupt — start fresh
    return [];
  }
}

/**
 * Add a city to favorites.
 *
 * Returns true if added, false if already exists or limit reached.
 * We check for duplicates by comparing lat/lon (not name, because
 * "NYC" and "New York City" could be the same place).
 */
export function addFavorite(location: GeoLocation): boolean {
  const favorites = getFavorites();

  // Check if already saved (compare coordinates, rounded to avoid float issues)
  const isDuplicate = favorites.some(
    (fav) =>
      Math.abs(fav.latitude - location.latitude) < 0.01 &&
      Math.abs(fav.longitude - location.longitude) < 0.01
  );

  if (isDuplicate) return false;

  if (favorites.length >= MAX_FAVORITES) return false;

  favorites.push(location);
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  return true;
}

/**
 * Remove a city from favorites by its index in the array.
 */
export function removeFavorite(index: number): void {
  const favorites = getFavorites();
  if (index >= 0 && index < favorites.length) {
    favorites.splice(index, 1); // Remove 1 item at the given index
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  }
}

/**
 * Check if a location is already in favorites.
 */
export function isFavorite(location: GeoLocation): boolean {
  const favorites = getFavorites();
  return favorites.some(
    (fav) =>
      Math.abs(fav.latitude - location.latitude) < 0.01 &&
      Math.abs(fav.longitude - location.longitude) < 0.01
  );
}
