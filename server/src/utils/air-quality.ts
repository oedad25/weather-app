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
