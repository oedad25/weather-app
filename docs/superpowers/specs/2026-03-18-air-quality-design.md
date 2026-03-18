# Air Quality Feature — Design Spec

## Goal

Add real-time air quality data (AQI + pollutant breakdown) to the weather display using Open-Meteo's free Air Quality API.

## Approach

Parallel fetch: the server fetches weather and air quality simultaneously via `Promise.all`. If the air quality request fails, the response includes `airQuality: null` and weather data is unaffected.

## Data Source

**Open-Meteo Air Quality API** — `https://air-quality-api.open-meteo.com/v1/air-quality`

Parameters:
- `latitude`, `longitude` — same coordinates as weather request
- `current`: `us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide`
- `timezone`: `auto`

Free, no API key required.

## Data Types

```typescript
interface AirQuality {
  aqi: number;    // US EPA AQI (0-500+)
  pm25: number;   // μg/m³
  pm10: number;   // μg/m³
  ozone: number;  // μg/m³
  no2: number;    // μg/m³
  so2: number;    // μg/m³
  co: number;     // μg/m³ — display as mg/m³ (÷1000) in UI since raw values are very large
}
```

`WeatherData` gains a new field:
```typescript
interface WeatherData {
  location: GeoLocation;
  current: CurrentWeather;
  daily: DailyForecast[];
  airQuality: AirQuality | null;  // null if AQI API failed
}
```

## AQI Categories (US EPA)

| Range   | Label                          | CSS Class              | Color  |
|---------|--------------------------------|------------------------|--------|
| 0-50    | Good                           | `.aqi-good`            | Green  |
| 51-100  | Moderate                       | `.aqi-moderate`        | Yellow |
| 101-150 | Unhealthy for Sensitive Groups | `.aqi-sensitive`       | Orange |
| 151-200 | Unhealthy                      | `.aqi-unhealthy`       | Red    |
| 201-300 | Very Unhealthy                 | `.aqi-very-unhealthy`  | Purple |
| 301+    | Hazardous                      | `.aqi-hazardous`       | Maroon |

## Server Changes

### `server/src/services/weather.ts`

- Add `fetchAirQuality(lat, lon)` function that calls Open-Meteo Air Quality API and returns `AirQuality | null`. Uses `AbortController` with a 5-second timeout to avoid blocking `Promise.all`. Catches all errors and returns `null` on failure.
- Modify `fetchWeatherWithCache` to call weather and air quality in parallel with `Promise.all([fetchWeather(...), fetchAirQuality(...)])`.
- The combined result includes `airQuality` in the cached JSON payload.
- On cache hit, normalize stale entries that predate this feature: `airQuality: (cached.data as any).airQuality ?? null`. This ensures clients always receive an explicit `null` rather than `undefined` for old cache rows.
- `convertWeatherData` passes `airQuality` through unchanged (no unit conversion needed).

### `server/src/utils/temperature.ts`

- `convertWeatherData` spreads `airQuality` through as-is: `airQuality: data.airQuality`.

### `server/src/routes/weather.ts`

- No changes. The existing `/search` and `/coords` endpoints return whatever `WeatherData` contains.

### Prisma schema

- No migration needed. `WeatherCache.data` is a `Json` column that stores the full `WeatherData` object. Adding `airQuality` to the JSON is transparent.

## Client Changes

### `client/src/types.ts`

- Add `AirQuality` interface.
- Add `airQuality: AirQuality | null` to `WeatherData`.

### `client/src/ui.ts`

- Add `getAqiCategory(aqi: number)` function returning `{ label, cssClass }`.
- Add `renderAirQuality(airQuality: AirQuality)` function (receives non-null value only) that renders:
  - AQI badge: color-coded pill with number and label
  - Pollutant grid: 6 items (PM2.5, PM10, O₃, NO₂, SO₂, CO) each showing value and unit. CO displayed as mg/m³ (raw value ÷ 1000).
- Modify `renderWeather`: null-check `data.airQuality` before calling `renderAirQuality`. If null, the section is omitted entirely (no empty state).

### `client/styles.css`

- `.air-quality-card` — card container, same styling pattern as existing weather cards
- `.aqi-badge` — pill with dynamic background color
- `.pollutant-grid` — grid layout for 6 pollutant items
- `.aqi-good`, `.aqi-moderate`, `.aqi-sensitive`, `.aqi-unhealthy`, `.aqi-very-unhealthy`, `.aqi-hazardous` — background colors for AQI ranges

## Testing

### Unit test: `server/src/tests/unit/air-quality.test.ts`

- Add `getAqiCategory` function to `server/src/utils/air-quality.ts` (server-side, testable with Vitest). The client imports are not covered by Vitest, so the logic lives server-side and the client duplicates or inlines it.
- Test `getAqiCategory` mapping at each range boundary (0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301)

### Integration test: extend `server/src/tests/integration/weather.test.ts`

- Verify weather search response includes `airQuality` field (object or null)

### E2E test: extend `e2e/tests/user-journey.spec.ts`

- After searching for a city, assert `.air-quality-card` is visible on the page

## Files Changed

| File | Action |
|------|--------|
| `server/src/services/weather.ts` | Modify — add `fetchAirQuality`, parallel fetch, cache normalization |
| `server/src/utils/temperature.ts` | Modify — pass through `airQuality` |
| `server/src/utils/air-quality.ts` | Create — `getAqiCategory` function |
| `client/src/types.ts` | Modify — add `AirQuality` interface |
| `client/src/ui.ts` | Modify — add AQI rendering with null guard |
| `client/styles.css` | Modify — add AQI styles |
| `server/src/tests/unit/air-quality.test.ts` | Create — AQI category tests |
| `server/src/tests/integration/weather.test.ts` | Modify — assert `airQuality` in response |
| `e2e/tests/user-journey.spec.ts` | Modify — assert `.air-quality-card` renders |

## Out of Scope

- Multi-day air quality forecast
- Air quality alerts/notifications
- Historical air quality data
- Separate air quality endpoint
