// ===========================================
// ui.ts — Talks to the Browser (DOM)
// ===========================================
// This file handles everything you SEE on screen.
// It reads user input, updates the page, shows errors, etc.
// It knows NOTHING about APIs — it just receives data and displays it.

import {
  WeatherData,
  WeatherCondition,
  DailyForecast,
  TemperatureUnit,
  GeoLocation,
} from "./types.js";

import { Theme } from "./storage.js";

// ===========================================
// WMO Weather Code Translator
// ===========================================

const weatherCodeMap: Record<number, WeatherCondition> = {
  0: { label: "Clear Sky", icon: "☀️" },
  1: { label: "Mostly Clear", icon: "🌤️" },
  2: { label: "Partly Cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Icy Fog", icon: "🌫️" },
  51: { label: "Light Drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy Drizzle", icon: "🌧️" },
  56: { label: "Freezing Drizzle", icon: "🌧️" },
  57: { label: "Heavy Freezing Drizzle", icon: "🌧️" },
  61: { label: "Light Rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy Rain", icon: "🌧️" },
  66: { label: "Freezing Rain", icon: "🌧️" },
  67: { label: "Heavy Freezing Rain", icon: "🌧️" },
  71: { label: "Light Snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy Snow", icon: "❄️" },
  77: { label: "Snow Grains", icon: "❄️" },
  80: { label: "Light Showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy Showers", icon: "🌧️" },
  85: { label: "Light Snow Showers", icon: "🌨️" },
  86: { label: "Heavy Snow Showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm with Hail", icon: "⛈️" },
  99: { label: "Severe Thunderstorm", icon: "⛈️" },
};

export function getWeatherCondition(code: number): WeatherCondition {
  return weatherCodeMap[code] || { label: "Unknown", icon: "🌡️" };
}

// ===========================================
// DOM Element References
// ===========================================

const searchInput = document.getElementById(
  "search-input"
) as HTMLInputElement;
const searchButton = document.getElementById(
  "search-button"
) as HTMLButtonElement;
const unitToggle = document.getElementById(
  "unit-toggle"
) as HTMLButtonElement;
const geoButton = document.getElementById(
  "geo-button"
) as HTMLButtonElement;
const themeToggle = document.getElementById(
  "theme-toggle"
) as HTMLButtonElement;
const weatherContainer = document.getElementById(
  "weather-container"
) as HTMLElement;
const errorContainer = document.getElementById(
  "error-container"
) as HTMLElement;
const loadingContainer = document.getElementById(
  "loading-container"
) as HTMLElement;
const welcomeContainer = document.getElementById(
  "welcome-container"
) as HTMLElement;
const favoritesContainer = document.getElementById(
  "favorites-container"
) as HTMLElement;
const authContainer = document.getElementById("auth-container") as HTMLElement;
const authForm = document.getElementById("auth-form") as HTMLFormElement;
const authEmail = document.getElementById("auth-email") as HTMLInputElement;
const authPassword = document.getElementById("auth-password") as HTMLInputElement;
const authError = document.getElementById("auth-error") as HTMLElement;
const registerButton = document.getElementById("register-button") as HTMLButtonElement;
const logoutButton = document.getElementById("logout-button") as HTMLButtonElement;
const userEmailSpan = document.getElementById("user-email") as HTMLElement;
const historyButton = document.getElementById("history-button") as HTMLButtonElement;
const historyContainer = document.getElementById("history-container") as HTMLElement;
const historyList = document.getElementById("history-list") as HTMLElement;
const historyClose = document.getElementById("history-close") as HTMLButtonElement;

// ===========================================
// Event Listeners
// ===========================================

export function getSearchQuery(): string {
  return searchInput.value.trim();
}

export function onSearch(callback: (query: string) => void): void {
  searchButton.addEventListener("click", () => {
    const query = getSearchQuery();
    if (query) callback(query);
  });

  searchInput.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      const query = getSearchQuery();
      if (query) callback(query);
    }
  });
}

export function onUnitToggle(callback: () => void): void {
  unitToggle.addEventListener("click", callback);
}

export function onGeolocate(callback: () => void): void {
  geoButton.addEventListener("click", callback);
}

/**
 * Listen for theme toggle clicks (🌙 ↔ ☀️).
 */
export function onThemeToggle(callback: () => void): void {
  themeToggle.addEventListener("click", callback);
}

export function setGeoButtonLoading(loading: boolean): void {
  geoButton.disabled = loading;
  geoButton.textContent = loading ? "..." : "📍";
}

export function updateUnitToggle(unit: TemperatureUnit): void {
  unitToggle.textContent = unit === "celsius" ? "°F" : "°C";
  unitToggle.title =
    unit === "celsius" ? "Switch to Fahrenheit" : "Switch to Celsius";
}

/**
 * Apply a theme to the page.
 *
 * We use a data attribute on <html> instead of adding/removing classes.
 * data-theme="dark" is a common pattern because:
 * 1. It's easy to target in CSS: [data-theme="dark"] { ... }
 * 2. It lives on the root element, so ALL children inherit it
 * 3. It's cleaner than toggling dozens of individual classes
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  themeToggle.title =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

// ===========================================
// State Display Functions
// ===========================================

export function showLoading(): void {
  welcomeContainer.classList.add("hidden");
  weatherContainer.classList.add("hidden");
  errorContainer.classList.add("hidden");
  loadingContainer.classList.remove("hidden");
}

export function showError(message: string): void {
  loadingContainer.classList.add("hidden");
  weatherContainer.classList.add("hidden");
  welcomeContainer.classList.add("hidden");
  errorContainer.classList.remove("hidden");
  errorContainer.querySelector("p")!.textContent = message;
}

// ===========================================
// Favorites Panel
// ===========================================

/**
 * Render the favorites chips below the search bar.
 *
 * Uses "event delegation" — instead of attaching a click listener
 * to every chip and every × button individually, we attach ONE
 * listener to the parent container and inspect event.target to
 * figure out what was clicked. This is:
 * - More efficient (fewer listeners)
 * - Simpler (works even when we rebuild the HTML)
 * - A pattern used heavily in production apps
 */
export function renderFavorites(
  favorites: GeoLocation[],
  onSelect: (location: GeoLocation) => void,
  onRemove: (index: number) => void
): void {
  if (favorites.length === 0) {
    favoritesContainer.classList.add("hidden");
    return;
  }

  favoritesContainer.classList.remove("hidden");

  favoritesContainer.innerHTML = `
    <div class="favorites-list">
      ${favorites
        .map((fav, index) => {
          const displayName = fav.admin1
            ? `${fav.name}, ${fav.admin1}`
            : `${fav.name}, ${fav.country}`;
          return `
            <div class="favorite-chip" data-index="${index}">
              <span class="favorite-name" data-action="select">${displayName}</span>
              <button class="favorite-remove" data-action="remove" title="Remove">&times;</button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  // Event delegation — one listener handles all chips
  favoritesContainer.onclick = (event) => {
    const target = event.target as HTMLElement;
    const chip = target.closest(".favorite-chip") as HTMLElement | null;
    if (!chip) return;

    const index = parseInt(chip.dataset.index || "0", 10);

    if (target.dataset.action === "remove") {
      onRemove(index);
    } else if (target.dataset.action === "select") {
      onSelect(favorites[index]);
    }
  };
}

// ===========================================
// Weather Display
// ===========================================

/**
 * Render the full weather display with a favorite ★/☆ toggle.
 *
 * @param data - The weather data to display
 * @param unit - Current temperature unit
 * @param isSaved - Whether this city is already in favorites
 * @param onToggleFavorite - Callback when the star is clicked
 */
export function renderWeather(
  data: WeatherData,
  unit: TemperatureUnit,
  isSaved: boolean = false,
  onToggleFavorite?: () => void
): void {
  loadingContainer.classList.add("hidden");
  errorContainer.classList.add("hidden");
  welcomeContainer.classList.add("hidden");
  weatherContainer.classList.remove("hidden");

  const condition = getWeatherCondition(data.current.weatherCode);
  const unitSymbol = unit === "celsius" ? "°C" : "°F";
  const windUnit = unit === "celsius" ? "km/h" : "mph";

  const locationParts = [data.location.name];
  if (data.location.admin1) locationParts.push(data.location.admin1);
  locationParts.push(data.location.country);
  const locationStr = locationParts.join(", ");

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Star button: filled ★ if saved, outline ☆ if not
  const starIcon = isSaved ? "★" : "☆";
  const starTitle = isSaved ? "Remove from favorites" : "Save to favorites";
  const starClass = isSaved ? "fav-star saved" : "fav-star";

  weatherContainer.innerHTML = `
    <div class="current-weather">
      <div class="weather-header">
        <div class="weather-main">
          <span class="weather-icon">${condition.icon}</span>
          <div class="temp-group">
            <span class="temperature">${Math.round(data.current.temperature)}${unitSymbol}</span>
            <span class="condition-label">${condition.label}</span>
          </div>
        </div>
        <button class="${starClass}" id="fav-toggle" title="${starTitle}">${starIcon}</button>
      </div>
      <div class="location-name">${locationStr}</div>
      <div class="last-updated">Updated at ${timeStr}</div>
      <div class="weather-details">
        <div class="detail-item">
          <span class="detail-label">Feels Like</span>
          <span class="detail-value">${Math.round(data.current.apparentTemperature)}${unitSymbol}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Humidity</span>
          <span class="detail-value">${data.current.humidity}%</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Wind</span>
          <span class="detail-value">${Math.round(data.current.windSpeed)} ${windUnit}</span>
        </div>
      </div>
    </div>
    <div class="forecast">
      <h3 class="forecast-title">10-Day Forecast</h3>
      <div class="forecast-grid">
        ${data.daily.map((day) => renderForecastDay(day, unitSymbol)).join("")}
      </div>
    </div>
  `;

  // Wire up the star button
  if (onToggleFavorite) {
    document.getElementById("fav-toggle")?.addEventListener("click", onToggleFavorite);
  }

  // Trigger entrance animation
  weatherContainer.classList.add("fade-in");
  setTimeout(() => weatherContainer.classList.remove("fade-in"), 500);
}

function renderForecastDay(day: DailyForecast, unitSymbol: string): string {
  const condition = getWeatherCondition(day.weatherCode);
  const date = new Date(day.date + "T00:00:00");
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

  return `
    <div class="forecast-day">
      <span class="forecast-day-name">${dayName}</span>
      <span class="forecast-icon">${condition.icon}</span>
      <span class="forecast-temps">
        <span class="temp-high">${Math.round(day.maxTemp)}${unitSymbol}</span>
        <span class="temp-low">${Math.round(day.minTemp)}${unitSymbol}</span>
      </span>
    </div>
  `;
}

// ===========================================
// Auth & History UI
// ===========================================

export function showAuthView(): void {
  authContainer.classList.remove("hidden");
  logoutButton.classList.add("hidden");
  userEmailSpan.classList.add("hidden");
  historyButton.classList.add("hidden");
  weatherContainer.classList.add("hidden");
  welcomeContainer.classList.add("hidden");
  favoritesContainer.classList.add("hidden");
  loadingContainer.classList.add("hidden");
  errorContainer.classList.add("hidden");
  historyContainer.classList.add("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
}

export function showAppView(email: string): void {
  authContainer.classList.add("hidden");
  logoutButton.classList.remove("hidden");
  userEmailSpan.classList.remove("hidden");
  historyButton.classList.remove("hidden");
  userEmailSpan.textContent = email;
  document.querySelector(".search-bar")?.classList.remove("hidden");
  welcomeContainer.classList.remove("hidden");
}

export function showAuthError(message: string): void {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

export function clearAuthError(): void {
  authError.classList.add("hidden");
}

export function getAuthInputs(): { email: string; password: string } {
  return { email: authEmail.value.trim(), password: authPassword.value };
}

export function onLogin(callback: (email: string, password: string) => void): void {
  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { email, password } = getAuthInputs();
    if (email && password) callback(email, password);
  });
}

export function onRegister(callback: (email: string, password: string) => void): void {
  registerButton.addEventListener("click", () => {
    const { email, password } = getAuthInputs();
    if (email && password) callback(email, password);
  });
}

export function onLogout(callback: () => void): void {
  logoutButton.addEventListener("click", callback);
}

export function onHistoryToggle(callback: () => void): void {
  historyButton.addEventListener("click", callback);
  historyClose.addEventListener("click", () => {
    historyContainer.classList.add("hidden");
  });
}

export function renderHistory(items: Array<{ query: string; cityName: string; createdAt: string }>): void {
  historyContainer.classList.remove("hidden");
  if (items.length === 0) {
    historyList.innerHTML = '<p style="color: var(--color-text-muted); text-align: center;">No searches yet</p>';
    return;
  }
  historyList.innerHTML = items.map((item) => {
    const time = new Date(item.createdAt).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const label = item.query === "[geolocation]" ? item.cityName : item.query;
    return `<div class="history-item">
      <span>${item.cityName}${item.query !== "[geolocation]" && item.query !== item.cityName ? ` (${item.query})` : ""}</span>
      <span class="history-time">${time}</span>
    </div>`;
  }).join("");
}
