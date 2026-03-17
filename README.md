# SkyCheck

A weather app built with vanilla TypeScript and the [Open-Meteo API](https://open-meteo.com/). No frameworks, no API keys required.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **City search** with geocoding (handles international cities)
- **Browser geolocation** — get weather for your current location
- **5-day forecast** with high/low temperatures
- **Celsius / Fahrenheit** toggle
- **Dark / Light theme** with smooth transitions
- **Favorite cities** — save up to 5 cities for quick access
- All preferences persist across sessions via localStorage

## Getting Started

```bash
npm install
npx tsc
```

Then open `index.html` in a browser, or serve it with any static file server:

```bash
# example using Python
python3 -m http.server 8000
```

## Project Structure

```
src/
├── types.ts    — Shared TypeScript interfaces
├── api.ts      — Open-Meteo & BigDataCloud API calls
├── storage.ts  — localStorage persistence (favorites, theme, units)
├── ui.ts       — DOM manipulation & event listeners
└── app.ts      — Entry point, state management, event coordination
```

## APIs Used

- [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) — city name → coordinates
- [Open-Meteo Forecast](https://open-meteo.com/en/docs) — weather data by coordinates
- [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) — reverse geocoding for geolocation feature

All APIs are free and require no authentication.
