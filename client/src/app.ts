// ===========================================
// app.ts — The Boss / Coordinator
// ===========================================
// Phase 3: Now manages favorites, theme, and persisted preferences
// in addition to search, geolocation, and unit toggling.

import { geocodeCity, fetchWeather, reverseGeocode } from "./api.js";
import {
  onSearch,
  onUnitToggle,
  onGeolocate,
  onThemeToggle,
  setGeoButtonLoading,
  showLoading,
  showError,
  renderWeather,
  renderFavorites,
  updateUnitToggle,
  applyTheme,
} from "./ui.js";
import { TemperatureUnit, GeoLocation, WeatherData } from "./types.js";
import {
  getSavedTheme,
  saveTheme,
  getSavedUnit,
  saveUnit,
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  Theme,
} from "./storage.js";

// ===========================================
// App State
// ===========================================

let currentUnit: TemperatureUnit = getSavedUnit(); // Load saved preference
let currentTheme: Theme = getSavedTheme(); // Load saved theme
let lastLocation: GeoLocation | null = null;
let lastWeatherData: WeatherData | null = null; // Cache for re-rendering

// ===========================================
// Favorites Management
// ===========================================

/**
 * Refresh the favorites panel.
 * Called whenever favorites change (add/remove) to keep the UI in sync.
 */
function refreshFavorites(): void {
  renderFavorites(getFavorites(), handleFavoriteSelect, handleFavoriteRemove);
}

/**
 * When a user clicks a favorite chip, load its weather.
 * This reuses the same fetch logic as a regular search,
 * but skips geocoding since we already have the coordinates.
 */
async function handleFavoriteSelect(location: GeoLocation): Promise<void> {
  showLoading();
  lastLocation = location;

  try {
    const weather = await fetchWeather(location, currentUnit);
    lastWeatherData = weather;
    renderWeatherWithFavorite(weather);
  } catch {
    showError("Failed to load weather for this city. Please try again.");
  }
}

/**
 * When a user clicks × on a favorite chip, remove it and refresh.
 */
function handleFavoriteRemove(index: number): void {
  removeFavorite(index);
  refreshFavorites();

  // If we're currently viewing that city, update the star icon too
  if (lastWeatherData && lastLocation) {
    renderWeatherWithFavorite(lastWeatherData);
  }
}

/**
 * Toggle the current city in/out of favorites.
 * Called when the user clicks the ★/☆ button on the weather card.
 */
function handleToggleFavorite(): void {
  if (!lastLocation || !lastWeatherData) return;

  if (isFavorite(lastLocation)) {
    // Find and remove this location from favorites
    const favorites = getFavorites();
    const index = favorites.findIndex(
      (fav) =>
        Math.abs(fav.latitude - lastLocation!.latitude) < 0.01 &&
        Math.abs(fav.longitude - lastLocation!.longitude) < 0.01
    );
    if (index !== -1) removeFavorite(index);
  } else {
    const added = addFavorite(lastLocation);
    if (!added) {
      // addFavorite returns false if limit reached
      showError("You can save up to 5 favorite cities. Remove one to add another.");
      return;
    }
  }

  // Refresh both the favorites panel and the star icon
  refreshFavorites();
  renderWeatherWithFavorite(lastWeatherData);
}

/**
 * Helper that renders weather WITH the correct favorite star state.
 * This avoids repeating the isFavorite check everywhere.
 */
function renderWeatherWithFavorite(weather: WeatherData): void {
  const saved = lastLocation ? isFavorite(lastLocation) : false;
  renderWeather(weather, currentUnit, saved, handleToggleFavorite);
}

// ===========================================
// Core Handlers (same as before, with favorites integration)
// ===========================================

async function handleSearch(query: string): Promise<void> {
  showLoading();

  try {
    const locations = await geocodeCity(query);

    if (locations.length === 0) {
      showError(`No results found for "${query}". Try a different city name.`);
      return;
    }

    const location = locations[0];
    lastLocation = location;

    const weather = await fetchWeather(location, currentUnit);
    lastWeatherData = weather;
    renderWeatherWithFavorite(weather);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.";
    showError(message);
  }
}

async function handleUnitToggle(): Promise<void> {
  currentUnit = currentUnit === "celsius" ? "fahrenheit" : "celsius";
  updateUnitToggle(currentUnit);
  saveUnit(currentUnit); // Persist the preference

  if (lastLocation) {
    showLoading();
    try {
      const weather = await fetchWeather(lastLocation, currentUnit);
      lastWeatherData = weather;
      renderWeatherWithFavorite(weather);
    } catch {
      showError("Failed to update temperature unit. Please try again.");
    }
  }
}

/**
 * Toggle between dark and light themes.
 * The theme is applied via a data-theme attribute on <html>,
 * and CSS variables change based on that attribute.
 */
function handleThemeToggle(): void {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(currentTheme);
  saveTheme(currentTheme); // Persist so it survives page refresh
}

async function handleGeolocate(): Promise<void> {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by your browser.");
    return;
  }

  showLoading();
  setGeoButtonLoading(true);

  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: false,
        });
      }
    );

    const { latitude, longitude } = position.coords;
    const location = await reverseGeocode(latitude, longitude);
    lastLocation = location;

    const weather = await fetchWeather(location, currentUnit);
    lastWeatherData = weather;
    renderWeatherWithFavorite(weather);
  } catch (error) {
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          showError(
            "Location access denied. Please enable location permissions in your browser settings."
          );
          break;
        case error.POSITION_UNAVAILABLE:
          showError(
            "Unable to determine your location. Please try searching for a city instead."
          );
          break;
        case error.TIMEOUT:
          showError("Location request timed out. Please try again.");
          break;
      }
    } else {
      showError("Something went wrong getting your location.");
    }
  } finally {
    setGeoButtonLoading(false);
  }
}

// ===========================================
// Initialize the App
// ===========================================

function init(): void {
  // Restore saved preferences
  updateUnitToggle(currentUnit);
  applyTheme(currentTheme);

  // Render saved favorites (if any)
  refreshFavorites();

  // Wire up all event listeners
  onSearch(handleSearch);
  onUnitToggle(handleUnitToggle);
  onGeolocate(handleGeolocate);
  onThemeToggle(handleThemeToggle);
}

// Start the app!
init();
