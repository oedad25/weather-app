export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function convertWeatherData(data: any): any {
  return {
    ...data,
    current: {
      ...data.current,
      temperature: celsiusToFahrenheit(data.current.temperature),
      apparentTemperature: celsiusToFahrenheit(data.current.apparentTemperature),
      windSpeed: data.current.windSpeed * 0.621371,
    },
    daily: data.daily.map((day: any) => ({
      ...day,
      maxTemp: celsiusToFahrenheit(day.maxTemp),
      minTemp: celsiusToFahrenheit(day.minTemp),
    })),
  };
}
