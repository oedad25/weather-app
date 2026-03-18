import { prisma } from "../lib/prisma.js";
import { convertWeatherData } from "../utils/temperature.js";

const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEO_BASE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const CACHE_TTL_MS = 15 * 60 * 1000;

interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export async function searchByCity(city: string, unit: string) {
  const geoUrl = `${GEO_BASE}?name=${encodeURIComponent(city)}&count=5&language=en`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) throw new Error("Geocoding failed");
  const geoData = await geoRes.json();

  if (!geoData.results?.length) {
    return null;
  }

  const location: GeoLocation = {
    name: geoData.results[0].name,
    latitude: geoData.results[0].latitude,
    longitude: geoData.results[0].longitude,
    country: geoData.results[0].country,
    admin1: geoData.results[0].admin1,
  };

  const weather = await fetchWeatherWithCache(location.latitude, location.longitude, unit);
  return { location, ...weather };
}

export async function searchByCoords(lat: number, lon: number, unit: string) {
  const revUrl = `${REVERSE_GEO_BASE}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  let location: GeoLocation;

  try {
    const revRes = await fetch(revUrl);
    const revData = await revRes.json();
    location = {
      name: revData.city || revData.locality || "Your Location",
      latitude: lat,
      longitude: lon,
      country: revData.countryName || "",
      admin1: revData.principalSubdivision || undefined,
    };
  } catch {
    location = { name: "Your Location", latitude: lat, longitude: lon, country: "" };
  }

  const weather = await fetchWeatherWithCache(lat, lon, unit);
  return { location, ...weather };
}

async function fetchWeatherWithCache(lat: number, lon: number, unit: string) {
  const cached = await prisma.weatherCache.findUnique({
    where: { latitude_longitude: { latitude: lat, longitude: lon } },
  });

  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    const data = cached.data as any;
    return unit === "fahrenheit" ? convertWeatherData(data) : data;
  }

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    forecast_days: "5",
    timezone: "auto",
  });

  const res = await fetch(`${WEATHER_BASE}?${params}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  const raw = await res.json();

  const weatherData = {
    current: {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      windSpeed: raw.current.wind_speed_10m,
      weatherCode: raw.current.weather_code,
      isDay: raw.current.is_day === 1,
    },
    daily: raw.daily.time.map((date: string, i: number) => ({
      date,
      maxTemp: raw.daily.temperature_2m_max[i],
      minTemp: raw.daily.temperature_2m_min[i],
      weatherCode: raw.daily.weather_code[i],
    })),
  };

  await prisma.weatherCache.upsert({
    where: { latitude_longitude: { latitude: lat, longitude: lon } },
    update: { data: weatherData, fetchedAt: new Date() },
    create: { latitude: lat, longitude: lon, data: weatherData, fetchedAt: new Date() },
  });

  return unit === "fahrenheit" ? convertWeatherData(weatherData) : weatherData;
}

export async function recordSearch(
  userId: string,
  query: string,
  latitude: number,
  longitude: number,
  cityName: string,
) {
  await prisma.searchHistory.create({
    data: { userId, query, latitude, longitude, cityName },
  });
}

export async function getHistory(userId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.searchHistory.count({ where: { userId } }),
  ]);

  return { items, total, page, limit };
}

export async function cleanupStaleCache() {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  await prisma.weatherCache.deleteMany({
    where: { fetchedAt: { lt: cutoff } },
  });
}
