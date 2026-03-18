import { describe, it, expect } from "vitest";
import { celsiusToFahrenheit, convertWeatherData } from "../../utils/temperature.js";

describe("temperature utils", () => {
  it("converts Celsius to Fahrenheit", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });
});
