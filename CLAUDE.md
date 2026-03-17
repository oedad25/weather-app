# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

- **Install:** `npm install`
- **Build:** `npx tsc` (compiles `src/*.ts` → `dist/*.js` with source maps)
- **Serve:** Open `index.html` in a browser (or use any static file server). The HTML loads `dist/app.js` as an ES module.

There is no bundler, linter, test framework, or dev server configured. TypeScript (`tsc`) is the only build tool.

## Architecture

Vanilla TypeScript app (no framework) that fetches weather data from the free Open-Meteo API and displays it via direct DOM manipulation.

**Module dependency graph:** `app.ts` → `api.ts`, `ui.ts`, `storage.ts` → `types.ts`

- **`types.ts`** — Shared interfaces (`GeoLocation`, `CurrentWeather`, `DailyForecast`, `WeatherData`, `TemperatureUnit`)
- **`api.ts`** — All `fetch()` calls live here. Uses Open-Meteo for geocoding + weather, BigDataCloud for reverse geocoding. No API keys required.
- **`storage.ts`** — localStorage wrapper for persisting favorites (max 5), theme (light/dark), and temperature unit (C/F). Keys are prefixed `skycheck_`.
- **`ui.ts`** — DOM reads/writes, event listener setup, WMO weather code → emoji mapping. Knows nothing about APIs.
- **`app.ts`** — Coordinator/entry point. Owns app state (`currentUnit`, `currentTheme`, `lastLocation`, `lastWeatherData`), wires events to handlers, manages favorites toggle logic.

## Key Conventions

- **ES module imports use `.js` extensions** (e.g., `import { ... } from "./types.js"`). This is required for browser-native ES module resolution even though source files are `.ts`.
- **Theme** is applied via `data-theme="dark"` attribute on `<html>`, with CSS variables swapping all colors.
- **Duplicate detection** for favorites uses coordinate proximity (`< 0.01` lat/lon difference), not name matching.
