import { GeoLocation, TemperatureUnit } from "./types.js";
import { fetchWithAuth } from "./auth.js";

export async function searchWeather(city: string, unit: TemperatureUnit) {
  const params = new URLSearchParams({ city, unit });
  const res = await fetchWithAuth(`/api/weather/search?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Search failed");
  }
  return res.json();
}

export async function searchByCoords(lat: number, lon: number, unit: TemperatureUnit) {
  const params = new URLSearchParams({ lat: lat.toString(), lon: lon.toString(), unit });
  const res = await fetchWithAuth(`/api/weather/coords?${params}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Location search failed");
  }
  return res.json();
}

export async function getHistory(page = 1, limit = 20) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  const res = await fetchWithAuth(`/api/weather/history?${params}`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function getFavorites(): Promise<any[]> {
  const res = await fetchWithAuth("/api/favorites");
  if (!res.ok) throw new Error("Failed to load favorites");
  const data = await res.json();
  return data.favorites;
}

export async function addFavorite(location: GeoLocation) {
  const res = await fetchWithAuth("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: location.name,
      admin1: location.admin1,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to add favorite");
  }
  return res.json();
}

export async function removeFavorite(id: string) {
  const res = await fetchWithAuth(`/api/favorites/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
}
