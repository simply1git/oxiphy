export function calculateAQI(pm25: number, pm10: number): { aqi: number; level: string; color: string } {
  const pm25AQI = calcPM25AQI(pm25);
  const pm10AQI = calcPM10AQI(pm10);
  
  const finalAQI = Math.max(pm25AQI, pm10AQI);
  
  let level = "Good";
  let color = "bg-green-500";
  
  if (finalAQI > 300) {
    level = "Hazardous";
    color = "bg-rose-900";
  } else if (finalAQI > 200) {
    level = "Very Unhealthy";
    color = "bg-purple-600";
  } else if (finalAQI > 150) {
    level = "Unhealthy";
    color = "bg-red-500";
  } else if (finalAQI > 100) {
    level = "Unhealthy for Sensitive Groups";
    color = "bg-orange-500";
  } else if (finalAQI > 50) {
    level = "Moderate";
    color = "bg-yellow-500";
  }

  return { aqi: finalAQI, level, color };
}

function calcPM25AQI(c: number): number {
  if (c <= 12.0) return calcLinear(50, 0, 12.0, 0.0, c);
  if (c <= 35.4) return calcLinear(100, 51, 35.4, 12.1, c);
  if (c <= 55.4) return calcLinear(150, 101, 55.4, 35.5, c);
  if (c <= 150.4) return calcLinear(200, 151, 150.4, 55.5, c);
  if (c <= 250.4) return calcLinear(300, 201, 250.4, 150.5, c);
  if (c <= 350.4) return calcLinear(400, 301, 350.4, 250.5, c);
  if (c <= 500.4) return calcLinear(500, 401, 500.4, 350.5, c);
  return 500;
}

function calcPM10AQI(c: number): number {
  if (c <= 54) return calcLinear(50, 0, 54, 0, c);
  if (c <= 154) return calcLinear(100, 51, 154, 55, c);
  if (c <= 254) return calcLinear(150, 101, 254, 155, c);
  if (c <= 354) return calcLinear(200, 151, 354, 255, c);
  if (c <= 424) return calcLinear(300, 201, 424, 355, c);
  if (c <= 504) return calcLinear(400, 301, 504, 425, c);
  if (c <= 604) return calcLinear(500, 401, 604, 505, c);
  return 500;
}

function calcLinear(ih: number, il: number, ch: number, cl: number, c: number): number {
  return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il);
}
