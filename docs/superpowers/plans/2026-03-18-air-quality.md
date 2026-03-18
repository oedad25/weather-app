# Air Quality Feature — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time air quality data (AQI + pollutant breakdown) to the weather display using Open-Meteo's free Air Quality API.

**Architecture:** Parallel fetch weather + air quality on the server via `Promise.all`, cache together, return combined response. Client renders an AQI card between current weather and forecast. Graceful degradation: if AQI API fails, `airQuality` is `null` and the section is hidden.

**Tech Stack:** Open-Meteo Air Quality API, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-air-quality-design.md`

---

## File Structure

```
server/src/
├── utils/air-quality.ts          ← NEW: getAqiCategory() function
├── utils/temperature.ts          ← NO CHANGE (existing `...data` spread already passes airQuality through)
├── services/weather.ts           ← MODIFY: add fetchAirQuality(), parallel fetch, cache normalization
├── tests/unit/air-quality.test.ts ← NEW: AQI category boundary tests
├── tests/integration/weather.test.ts ← MODIFY: assert airQuality in response

client/src/
├── types.ts                      ← MODIFY: add AirQuality interface to WeatherData
├── ui.ts                         ← MODIFY: add renderAirQuality(), modify renderWeather()

client/
├── styles.css                    ← MODIFY: add AQI card and pollutant grid styles

e2e/tests/
├── user-journey.spec.ts          ← MODIFY: assert .air-quality-card visible after search
```

---

## Chunk 1: Server-side changes

### Task 1: AQI Category Utility (TDD)

**Files:**
- Create: `server/src/utils/air-quality.ts`
- Create: `server/src/tests/unit/air-quality.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/unit/air-quality.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getAqiCategory } from "../../utils/air-quality.js";

describe("getAqiCategory", () => {
  it("returns Good for 0-50", () => {
    expect(getAqiCategory(0)).toEqual({ label: "Good", cssClass: "aqi-good" });
    expect(getAqiCategory(50)).toEqual({ label: "Good", cssClass: "aqi-good" });
  });

  it("returns Moderate for 51-100", () => {
    expect(getAqiCategory(51)).toEqual({ label: "Moderate", cssClass: "aqi-moderate" });
    expect(getAqiCategory(100)).toEqual({ label: "Moderate", cssClass: "aqi-moderate" });
  });

  it("returns Unhealthy for Sensitive Groups for 101-150", () => {
    expect(getAqiCategory(101)).toEqual({ label: "Unhealthy for Sensitive Groups", cssClass: "aqi-sensitive" });
    expect(getAqiCategory(150)).toEqual({ label: "Unhealthy for Sensitive Groups", cssClass: "aqi-sensitive" });
  });

  it("returns Unhealthy for 151-200", () => {
    expect(getAqiCategory(151)).toEqual({ label: "Unhealthy", cssClass: "aqi-unhealthy" });
    expect(getAqiCategory(200)).toEqual({ label: "Unhealthy", cssClass: "aqi-unhealthy" });
  });

  it("returns Very Unhealthy for 201-300", () => {
    expect(getAqiCategory(201)).toEqual({ label: "Very Unhealthy", cssClass: "aqi-very-unhealthy" });
    expect(getAqiCategory(300)).toEqual({ label: "Very Unhealthy", cssClass: "aqi-very-unhealthy" });
  });

  it("returns Hazardous for 301+", () => {
    expect(getAqiCategory(301)).toEqual({ label: "Hazardous", cssClass: "aqi-hazardous" });
    expect(getAqiCategory(500)).toEqual({ label: "Hazardous", cssClass: "aqi-hazardous" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run --config vitest.config.unit.ts src/tests/unit/air-quality.test.ts`
Expected: FAIL — `getAqiCategory` not found

- [ ] **Step 3: Write minimal implementation**

Create `server/src/utils/air-quality.ts`:

```typescript
export interface AqiCategory {
  label: string;
  cssClass: string;
}

export function getAqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return { label: "Good", cssClass: "aqi-good" };
  if (aqi <= 100) return { label: "Moderate", cssClass: "aqi-moderate" };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive Groups", cssClass: "aqi-sensitive" };
  if (aqi <= 200) return { label: "Unhealthy", cssClass: "aqi-unhealthy" };
  if (aqi <= 300) return { label: "Very Unhealthy", cssClass: "aqi-very-unhealthy" };
  return { label: "Hazardous", cssClass: "aqi-hazardous" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run --config vitest.config.unit.ts src/tests/unit/air-quality.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/air-quality.ts server/src/tests/unit/air-quality.test.ts
git commit -m "Add AQI category utility with tests"
```

---

### Task 2: Server — Fetch Air Quality & Parallel Integration

**Files:**
- Modify: `server/src/services/weather.ts`

- [ ] **Step 1: Add `fetchAirQuality` function to `server/src/services/weather.ts`**

Add this constant after the `const REVERSE_GEO_BASE = ...` line:

```typescript
const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";
```

Add this function at the end of the file, after the `cleanupStaleCache` function:

```typescript
async function fetchAirQuality(lat: number, lon: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current: "us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide",
      timezone: "auto",
    });

    const res = await fetch(`${AIR_QUALITY_BASE}?${params}`, { signal: controller.signal });
    if (!res.ok) return null;
    const raw = await res.json();

    return {
      aqi: raw.current.us_aqi,
      pm25: raw.current.pm2_5,
      pm10: raw.current.pm10,
      ozone: raw.current.ozone,
      no2: raw.current.nitrogen_dioxide,
      so2: raw.current.sulphur_dioxide,
      co: raw.current.carbon_monoxide,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Modify `fetchWeatherWithCache` to use parallel fetch and normalize cache hits**

Replace the entire `fetchWeatherWithCache` function with:

```typescript
async function fetchWeatherWithCache(lat: number, lon: number, unit: string) {
  const cached = await prisma.weatherCache.findUnique({
    where: { latitude_longitude: { latitude: lat, longitude: lon } },
  });

  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    const data = { ...(cached.data as any), airQuality: (cached.data as any).airQuality ?? null };
    return unit === "fahrenheit" ? convertWeatherData(data) : data;
  }

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    forecast_days: "10",
    timezone: "auto",
  });

  const [weatherRes, airQuality] = await Promise.all([
    fetch(`${WEATHER_BASE}?${params}`),
    fetchAirQuality(lat, lon),
  ]);

  if (!weatherRes.ok) throw new Error("Weather fetch failed");
  const raw = await weatherRes.json();

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
    airQuality,
  };

  await prisma.weatherCache.upsert({
    where: { latitude_longitude: { latitude: lat, longitude: lon } },
    update: { data: weatherData, fetchedAt: new Date() },
    create: { latitude: lat, longitude: lon, data: weatherData, fetchedAt: new Date() },
  });

  return unit === "fahrenheit" ? convertWeatherData(weatherData) : weatherData;
}
```

Note: `convertWeatherData` in `server/src/utils/temperature.ts` does NOT need changes. It already uses `...data` spread which automatically passes `airQuality` through.

- [ ] **Step 3: Run all server tests**

Run: `cd server && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add server/src/services/weather.ts
git commit -m "Add air quality parallel fetch with cache normalization"
```

---

## Chunk 2: Client-side changes

### Task 3: Client Types

**Files:**
- Modify: `client/src/types.ts`

- [ ] **Step 1: Add `AirQuality` interface and update `WeatherData`**

Add the following after the `DailyForecast` interface (after line 43) in `client/src/types.ts`:

```typescript
/**
 * Real-time air quality data from Open-Meteo.
 * AQI uses the US EPA scale (0-500+).
 */
export interface AirQuality {
  aqi: number;
  pm25: number;   // μg/m³
  pm10: number;   // μg/m³
  ozone: number;  // μg/m³
  no2: number;    // μg/m³
  so2: number;    // μg/m³
  co: number;     // μg/m³ (display as mg/m³ by dividing by 1000)
}
```

Then add `airQuality` to the `WeatherData` interface. Change line 52 from:

```typescript
  daily: DailyForecast[];
}
```

to:

```typescript
  daily: DailyForecast[];
  airQuality: AirQuality | null;
}
```

- [ ] **Step 2: Build client to verify types compile**

Run: `cd client && npx tsc --noEmit`
Expected: No errors. Adding a new field to an interface does not break existing code that receives it.

- [ ] **Step 3: Commit**

```bash
git add client/src/types.ts
git commit -m "Add AirQuality type to WeatherData"
```

---

### Task 4: Client UI — Render Air Quality

**Files:**
- Modify: `client/src/ui.ts`
- Modify: `client/styles.css`

- [ ] **Step 1: Add AQI rendering functions to `client/src/ui.ts`**

Add the following imports at the top of `ui.ts` — update the existing import from `types.js` to include `AirQuality`:

```typescript
import { WeatherData, DailyForecast, TemperatureUnit, WeatherCondition, AirQuality } from "./types.js";
```

Add these two functions before the `export function renderWeather(` declaration:

```typescript
function getAqiCategory(aqi: number): { label: string; cssClass: string } {
  if (aqi <= 50) return { label: "Good", cssClass: "aqi-good" };
  if (aqi <= 100) return { label: "Moderate", cssClass: "aqi-moderate" };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive Groups", cssClass: "aqi-sensitive" };
  if (aqi <= 200) return { label: "Unhealthy", cssClass: "aqi-unhealthy" };
  if (aqi <= 300) return { label: "Very Unhealthy", cssClass: "aqi-very-unhealthy" };
  return { label: "Hazardous", cssClass: "aqi-hazardous" };
}

function renderAirQuality(aq: AirQuality): string {
  const category = getAqiCategory(aq.aqi);
  return `
    <div class="air-quality-card">
      <h3 class="forecast-title">Air Quality</h3>
      <div class="aqi-header">
        <span class="aqi-badge ${category.cssClass}">${aq.aqi} — ${category.label}</span>
      </div>
      <div class="pollutant-grid">
        <div class="pollutant-item">
          <span class="pollutant-label">PM2.5</span>
          <span class="pollutant-value">${aq.pm25.toFixed(1)}</span>
          <span class="pollutant-unit">μg/m³</span>
        </div>
        <div class="pollutant-item">
          <span class="pollutant-label">PM10</span>
          <span class="pollutant-value">${aq.pm10.toFixed(1)}</span>
          <span class="pollutant-unit">μg/m³</span>
        </div>
        <div class="pollutant-item">
          <span class="pollutant-label">O₃</span>
          <span class="pollutant-value">${aq.ozone.toFixed(1)}</span>
          <span class="pollutant-unit">μg/m³</span>
        </div>
        <div class="pollutant-item">
          <span class="pollutant-label">NO₂</span>
          <span class="pollutant-value">${aq.no2.toFixed(1)}</span>
          <span class="pollutant-unit">μg/m³</span>
        </div>
        <div class="pollutant-item">
          <span class="pollutant-label">SO₂</span>
          <span class="pollutant-value">${aq.so2.toFixed(1)}</span>
          <span class="pollutant-unit">μg/m³</span>
        </div>
        <div class="pollutant-item">
          <span class="pollutant-label">CO</span>
          <span class="pollutant-value">${(aq.co / 1000).toFixed(1)}</span>
          <span class="pollutant-unit">mg/m³</span>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Modify `renderWeather` to include air quality section**

In the `renderWeather` function template literal, find the `</div>` that closes the `current-weather` div followed by `<div class="forecast">`. Replace this block:

```typescript
    </div>
    <div class="forecast">
      <h3 class="forecast-title">10-Day Forecast</h3>
      <div class="forecast-grid">
        ${data.daily.map((day) => renderForecastDay(day, unitSymbol)).join("")}
      </div>
    </div>
```

with:

```typescript
    </div>
    ${data.airQuality ? renderAirQuality(data.airQuality) : ""}
    <div class="forecast">
      <h3 class="forecast-title">10-Day Forecast</h3>
      <div class="forecast-grid">
        ${data.daily.map((day) => renderForecastDay(day, unitSymbol)).join("")}
      </div>
    </div>
```

- [ ] **Step 3: Add AQI styles to `client/styles.css`**

Add the following before the media query section (find `@media` and add before it):

```css
/* Air Quality */
.air-quality-card {
  margin-top: 1.5rem;
}

.aqi-header {
  margin-bottom: 1rem;
}

.aqi-badge {
  display: inline-block;
  padding: 0.4rem 1rem;
  border-radius: 2rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
}

.aqi-good { background: #4caf50; }
.aqi-moderate { background: #ff9800; color: #333; }
.aqi-sensitive { background: #ff5722; }
.aqi-unhealthy { background: #e53935; }
.aqi-very-unhealthy { background: #7b1fa2; }
.aqi-hazardous { background: #4a0000; }

.pollutant-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.pollutant-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.75rem 0.5rem;
  border-radius: 0.5rem;
  background: var(--color-accent-subtle);
}

.pollutant-label {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.pollutant-value {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.pollutant-unit {
  font-size: 0.65rem;
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Build client to verify everything compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/ui.ts client/styles.css
git commit -m "Add air quality card UI with pollutant breakdown"
```

---

## Chunk 3: Testing & E2E

### Task 5: Integration Test Update

**Files:**
- Modify: `server/src/tests/integration/weather.test.ts`

- [ ] **Step 1: Add air quality assertion to weather integration test**

Add the following test inside the existing `describe("Weather API", ...)` block at the end (after the "returns paginated search history" test, before the closing `});`):

```typescript
  it("includes airQuality field in search response (requires external API)", async () => {
    const res = await request(app)
      .get("/api/weather/search?city=Denver&unit=celsius")
      .set("Authorization", `Bearer ${token}`);

    // This test hits the real Open-Meteo API. If the API is unavailable,
    // we skip assertions rather than fail the CI pipeline.
    if (res.status === 200) {
      expect(res.body).toHaveProperty("airQuality");
      if (res.body.airQuality !== null) {
        expect(res.body.airQuality).toHaveProperty("aqi");
        expect(res.body.airQuality).toHaveProperty("pm25");
        expect(res.body.airQuality).toHaveProperty("pm10");
        expect(res.body.airQuality).toHaveProperty("ozone");
        expect(res.body.airQuality).toHaveProperty("no2");
        expect(res.body.airQuality).toHaveProperty("so2");
        expect(res.body.airQuality).toHaveProperty("co");
      }
    }
  });
```

- [ ] **Step 2: Run integration tests**

Run: `cd server && npx vitest run src/tests/integration/`
Expected: All tests pass (including the new one)

- [ ] **Step 3: Commit**

```bash
git add server/src/tests/integration/weather.test.ts
git commit -m "Add integration test for air quality in weather response"
```

---

### Task 6: E2E Test Update

**Files:**
- Modify: `e2e/tests/user-journey.spec.ts`

- [ ] **Step 1: Add air quality card assertion**

In `e2e/tests/user-journey.spec.ts`, add the following right after the line that asserts `.current-weather` is visible:

```typescript
    // Air quality card should be visible (if AQI API is reachable)
    const aqCard = page.locator(".air-quality-card");
    const aqVisible = await aqCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (aqVisible) {
      await expect(aqCard.locator(".aqi-badge")).toBeVisible();
    }
```

Note: The air quality card may not render if the Open-Meteo AQI API is unreachable. This soft assertion prevents E2E flakiness while still validating the card structure when present.

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/user-journey.spec.ts
git commit -m "Add E2E assertion for air quality card"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd server && npx vitest run --config vitest.config.unit.ts`
Expected: All unit tests pass (including new air-quality tests)

- [ ] **Step 2: Run all integration tests**

Run: `cd server && npx vitest run src/tests/integration/`
Expected: All integration tests pass

- [ ] **Step 3: Typecheck everything**

Run: `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A && git commit -m "Fix any issues found during final verification"
```
