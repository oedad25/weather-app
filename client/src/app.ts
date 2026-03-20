import * as auth from "./auth.js";
import * as api from "./api.js";
import {
  onSearch,
  onUnitToggle,
  onGeolocate,
  onThemeToggle,
  onLogin,
  onRegister,
  onLogout,
  onHistoryToggle,
  onLoginClick,
  onGuestLink,
  setGeoButtonLoading,
  showLoading,
  showError,
  renderWeather,
  renderFavorites,
  renderHistory,
  updateUnitToggle,
  applyTheme,
  showAuthView,
  showAppView,
  showGuestAppView,
  showLoginLink,
  showGuestLink,
  showAuthError,
  clearAuthError,
} from "./ui.js";
import { TemperatureUnit, GeoLocation, WeatherData } from "./types.js";
import { getSavedTheme, saveTheme, getSavedUnit, saveUnit, Theme } from "./storage.js";

let currentUnit: TemperatureUnit = getSavedUnit();
let currentTheme: Theme = getSavedTheme();
let lastLocation: GeoLocation | null = null;
let lastWeatherData: WeatherData | null = null;
let favorites: any[] = [];
let isGuest = true;

// --- Auth Handlers ---

async function handleLogin(email: string, password: string): Promise<void> {
  clearAuthError();
  try {
    const user = await auth.login(email, password);
    await showLoggedInApp(user.email);
  } catch (err: any) {
    showAuthError(err.message);
  }
}

async function handleRegister(email: string, password: string): Promise<void> {
  clearAuthError();
  try {
    const user = await auth.register(email, password);
    await showLoggedInApp(user.email);
  } catch (err: any) {
    showAuthError(err.message);
  }
}

async function handleLogout(): Promise<void> {
  await auth.logout();
  lastLocation = null;
  lastWeatherData = null;
  favorites = [];
  isGuest = true;
  showGuestAppView();
}

async function showLoggedInApp(email: string): Promise<void> {
  isGuest = false;
  showAppView(email);
  try {
    favorites = await api.getFavorites();
    refreshFavoritesUI();
  } catch {
    // Favorites failed to load, not critical
  }
}

// --- Favorites ---

function refreshFavoritesUI(): void {
  const mapped = favorites.map((f) => ({
    name: f.name,
    latitude: f.latitude,
    longitude: f.longitude,
    country: f.country,
    admin1: f.admin1,
  }));
  renderFavorites(mapped, handleFavoriteSelect, handleFavoriteRemove);
}

async function handleFavoriteSelect(location: GeoLocation): Promise<void> {
  showLoading();
  lastLocation = location;
  try {
    const result = await api.searchByCoords(location.latitude, location.longitude, currentUnit);
    lastWeatherData = result as any;
    renderWeatherWithFavorite(result as any);
  } catch {
    showError("Failed to load weather for this city.");
  }
}

async function handleFavoriteRemove(index: number): Promise<void> {
  const fav = favorites[index];
  if (!fav) return;
  try {
    await api.removeFavorite(fav.id);
    favorites.splice(index, 1);
    refreshFavoritesUI();
    if (lastWeatherData && lastLocation) {
      renderWeatherWithFavorite(lastWeatherData);
    }
  } catch {
    showError("Failed to remove favorite.");
  }
}

async function handleToggleFavorite(): Promise<void> {
  if (isGuest) return;
  if (!lastLocation || !lastWeatherData) return;

  const existing = favorites.find(
    (f) =>
      Math.abs(f.latitude - lastLocation!.latitude) < 0.01 &&
      Math.abs(f.longitude - lastLocation!.longitude) < 0.01
  );

  try {
    if (existing) {
      await api.removeFavorite(existing.id);
      favorites = favorites.filter((f) => f.id !== existing.id);
    } else {
      const added = await api.addFavorite(lastLocation);
      favorites.push(added);
    }
    refreshFavoritesUI();
    renderWeatherWithFavorite(lastWeatherData);
  } catch (err: any) {
    showError(err.message || "Failed to update favorites.");
  }
}

function renderWeatherWithFavorite(weather: WeatherData): void {
  if (isGuest) {
    renderWeather(weather, currentUnit, false);
    return;
  }
  const isSaved = lastLocation
    ? favorites.some(
        (f) =>
          Math.abs(f.latitude - lastLocation!.latitude) < 0.01 &&
          Math.abs(f.longitude - lastLocation!.longitude) < 0.01
      )
    : false;
  renderWeather(weather, currentUnit, isSaved, handleToggleFavorite);
}

// --- Core Handlers ---

async function handleSearch(query: string): Promise<void> {
  if (isGuest) showLoginLink();
  showLoading();
  try {
    const result = await api.searchWeather(query, currentUnit);
    if (!result) {
      showError(`No results found for "${query}".`);
      return;
    }
    lastLocation = result.location;
    lastWeatherData = result as any;
    renderWeatherWithFavorite(result as any);
    if (!isGuest) {
      favorites = await api.getFavorites();
      refreshFavoritesUI();
    }
  } catch (err: any) {
    showError(err.message || "Something went wrong.");
  }
}

async function handleUnitToggle(): Promise<void> {
  currentUnit = currentUnit === "celsius" ? "fahrenheit" : "celsius";
  updateUnitToggle(currentUnit);
  saveUnit(currentUnit);

  if (lastLocation) {
    showLoading();
    try {
      const result = await api.searchByCoords(
        lastLocation.latitude,
        lastLocation.longitude,
        currentUnit
      );
      lastWeatherData = result as any;
      renderWeatherWithFavorite(result as any);
    } catch {
      showError("Failed to update temperature unit.");
    }
  }
}

function handleThemeToggle(): void {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(currentTheme);
  saveTheme(currentTheme);
}

async function handleGeolocate(): Promise<void> {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by your browser.");
    return;
  }

  if (isGuest) showLoginLink();
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
    const result = await api.searchByCoords(latitude, longitude, currentUnit);
    lastLocation = result.location;
    lastWeatherData = result as any;
    renderWeatherWithFavorite(result as any);
  } catch (error) {
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          showError("Location access denied.");
          break;
        case error.POSITION_UNAVAILABLE:
          showError("Unable to determine your location.");
          break;
        case error.TIMEOUT:
          showError("Location request timed out.");
          break;
      }
    } else {
      showError("Something went wrong getting your location.");
    }
  } finally {
    setGeoButtonLoading(false);
  }
}

async function handleHistoryToggle(): Promise<void> {
  if (isGuest) return;
  try {
    const data = await api.getHistory();
    renderHistory(data.items);
  } catch {
    showError("Failed to load history.");
  }
}

function handleLoginClick(): void {
  showAuthView();
  showGuestLink();
}

function handleGuestLink(): void {
  showGuestAppView();
}

// --- Init ---

async function init(): Promise<void> {
  applyTheme(currentTheme);
  updateUnitToggle(currentUnit);

  // Wire auth events
  onLogin(handleLogin);
  onRegister(handleRegister);
  onLogout(handleLogout);

  // Wire app events
  onSearch(handleSearch);
  onUnitToggle(handleUnitToggle);
  onGeolocate(handleGeolocate);
  onThemeToggle(handleThemeToggle);
  onHistoryToggle(handleHistoryToggle);
  onLoginClick(handleLoginClick);
  onGuestLink(handleGuestLink);

  // Check if already logged in
  const isLoggedIn = await auth.checkAuth();
  if (isLoggedIn) {
    try {
      const res = await auth.fetchWithAuth("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        await showLoggedInApp(data.user.email);
        return;
      }
    } catch {
      // Fall through to guest mode
    }
  }
  isGuest = true;
  showGuestAppView();
}

init();
