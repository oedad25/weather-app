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
