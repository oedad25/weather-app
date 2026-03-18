// ===========================================
// api.ts — Talks to the Outside World
// ===========================================
// This file handles ALL communication with the Open-Meteo API.
// No other file should use `fetch()` — everything goes through here.
// This makes it easy to swap APIs later (just change this one file).

import {
  GeoLocation,
  CurrentWeather,
  DailyForecast,
  WeatherData,
  TemperatureUnit,
} from "./types.js";

// ===========================================
// Reverse Geocoding (coordinates → city name)
// ===========================================
// Open-Meteo doesn't have reverse geocoding, so we use a free
// service called BigDataCloud. This turns lat/lon back into a
// city name so we can display it to the user.
const REVERSE_GEO_BASE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

// ---- API Base URLs ----
// Open-Meteo has two separate services:
// 1. Geocoding: converts city names → coordinates
// 2. Forecast: gets weather data for coordinates
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Step 1: Convert a city name into geographic coordinates.
 *
 * Why do we need this? Weather APIs work with latitude/longitude,
 * but users type city names. This bridges that gap.
 *
 * @param cityName - What the user typed (e.g. "Denver")
 * @returns An array of matching locations (there might be multiple "Denver"s!)
 */
export async function geocodeCity(cityName: string): Promise<GeoLocation[]> {
  // Build the URL with query parameters
  // encodeURIComponent handles special characters (e.g. "São Paulo" → "S%C3%A3o%20Paulo")
  const url = `${GEO_BASE}?name=${encodeURIComponent(cityName)}&count=5&language=en`;

  // fetch() sends an HTTP GET request and returns a Response object
  const response = await fetch(url);

  // If something went wrong (server error, etc.), throw an error
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.statusText}`);
  }

  // Parse the JSON body of the response
  const data = await response.json();

  // If no results, return an empty array (not an error — just no matches)
  if (!data.results) {
    return [];
  }

  // Transform the raw API response into our clean GeoLocation interface.
  // This is called "mapping" — we take each raw item and reshape it.
  return data.results.map((item: any) => ({
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    country: item.country,
    admin1: item.admin1, // State/province
  }));
}

/**
 * Step 2: Fetch weather data for a specific location.
 *
 * This is the main weather call. We ask for:
 * - Current conditions (temperature, wind, humidity, etc.)
 * - 5-day daily forecast (high/low temps, conditions)
 *
 * @param location - The place to get weather for (from geocodeCity)
 * @param unit - "celsius" or "fahrenheit"
 * @returns Complete weather data ready for display
 */
export async function fetchWeather(
  location: GeoLocation,
  unit: TemperatureUnit = "celsius"
): Promise<WeatherData> {
  // Open-Meteo lets us choose units via a parameter
  const tempUnit = unit === "fahrenheit" ? "fahrenheit" : "celsius";
  const windUnit = unit === "fahrenheit" ? "mph" : "kmh";

  // We specify exactly which data fields we want.
  // "current=" gets real-time data, "daily=" gets the forecast.
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: tempUnit,
    wind_speed_unit: windUnit,
    forecast_days: "5",
    timezone: "auto", // Use the location's local timezone
  });

  const url = `${WEATHER_BASE}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.statusText}`);
  }

  const data = await response.json();

  // --- Transform the raw response into our WeatherData shape ---

  const current: CurrentWeather = {
    temperature: data.current.temperature_2m,
    apparentTemperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1, // API returns 1 or 0, we convert to boolean
  };

  // Map each day in the forecast to our DailyForecast interface
  const daily: DailyForecast[] = data.daily.time.map(
    (date: string, index: number) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[index],
      minTemp: data.daily.temperature_2m_min[index],
      weatherCode: data.daily.weather_code[index],
    })
  );

  // Return everything bundled together
  return {
    location,
    current,
    daily,
  };
}

/**
 * Step 3 (optional): Convert coordinates back into a city name.
 *
 * This is called "reverse geocoding" — the opposite of geocodeCity().
 * We need this for the geolocation feature: the browser gives us
 * lat/lon, but we need a city name to display.
 *
 * @param lat - Latitude from the browser's geolocation API
 * @param lon - Longitude from the browser's geolocation API
 * @returns A GeoLocation object with the city name filled in
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<GeoLocation> {
  const url = `${REVERSE_GEO_BASE}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

  const response = await fetch(url);

  if (!response.ok) {
    // If reverse geocoding fails, we can still show weather
    // with a generic name — this is called a "graceful fallback"
    return {
      name: "Your Location",
      latitude: lat,
      longitude: lon,
      country: "",
    };
  }

  const data = await response.json();

  return {
    name: data.city || data.locality || "Your Location",
    latitude: lat,
    longitude: lon,
    country: data.countryName || "",
    admin1: data.principalSubdivision || undefined,
  };
}
