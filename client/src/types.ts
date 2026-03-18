// ===========================================
// types.ts — Data Blueprints
// ===========================================
// These interfaces tell TypeScript exactly what shape our data has.
// Think of them like a contract: "this object MUST have these fields."
// If you accidentally misspell a field name or use the wrong type,
// TypeScript will catch it before you even run the app.

/**
 * Represents a city returned by the geocoding API.
 * When a user types "Denver", we get back lat/lon coordinates
 * so we can fetch the weather for that exact spot.
 */
export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State/province (optional — not all cities have this)
}

/**
 * The current weather conditions at a location.
 * This is what we display on the main card.
 */
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number; // "Feels like" temperature
  humidity: number;
  windSpeed: number;
  weatherCode: number; // WMO code — we'll translate this to text + icon
  isDay: boolean; // true = daytime, false = nighttime
}

/**
 * One day in the 5-day forecast.
 */
export interface DailyForecast {
  date: string; // e.g. "2025-01-15"
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

/**
 * Everything we need to display the full weather view.
 * Combines current weather + forecast into one object.
 */
export interface WeatherData {
  location: GeoLocation;
  current: CurrentWeather;
  daily: DailyForecast[];
}

/**
 * Maps a WMO weather code to a human-friendly label and emoji.
 * For example: code 61 → { label: "Light Rain", icon: "🌧️" }
 */
export interface WeatherCondition {
  label: string;
  icon: string;
}

/**
 * Temperature unit preference.
 * "celsius" uses °C, "fahrenheit" uses °F.
 */
export type TemperatureUnit = "celsius" | "fahrenheit";
