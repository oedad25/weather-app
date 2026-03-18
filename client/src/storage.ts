import { TemperatureUnit } from "./types.js";

const KEYS = {
  THEME: "skycheck_theme",
  UNIT: "skycheck_unit",
} as const;

export type Theme = "light" | "dark";

export function getSavedTheme(): Theme {
  const saved = localStorage.getItem(KEYS.THEME);
  return saved === "dark" ? "dark" : "light";
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEYS.THEME, theme);
}

export function getSavedUnit(): TemperatureUnit {
  const saved = localStorage.getItem(KEYS.UNIT);
  return saved === "celsius" ? "celsius" : "fahrenheit";
}

export function saveUnit(unit: TemperatureUnit): void {
  localStorage.setItem(KEYS.UNIT, unit);
}
