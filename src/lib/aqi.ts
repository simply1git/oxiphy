// ============================================================
// AQI Analytics Engine
// Calculates US EPA AQI with sub-indices, prominent pollutant,
// and independent severity thresholds for all sensor metrics.
// ============================================================

export interface AQIResult {
  aqi: number;
  level: string;
  color: string;           // Tailwind bg color class
  textColor: string;       // Tailwind text color class
  borderColor: string;     // Tailwind border color class
  pm25SubIndex: number;
  pm10SubIndex: number;
  prominentPollutant: 'PM2.5' | 'PM10';
}

export interface SeverityResult {
  level: string;
  color: string;       // Tailwind bg color
  textColor: string;   // Tailwind text color
  borderColor: string; // Tailwind border color
}

// ── Main AQI Calculation ──────────────────────────────────────

export function calculateAQI(pm25: number, pm10: number): AQIResult {
  const pm25Sub = calcPM25AQI(pm25);
  const pm10Sub = calcPM10AQI(pm10);
  const finalAQI = Math.max(pm25Sub, pm10Sub);
  const prominent: 'PM2.5' | 'PM10' = pm25Sub >= pm10Sub ? 'PM2.5' : 'PM10';

  const band = getAQIBand(finalAQI);

  return {
    aqi: finalAQI,
    level: band.level,
    color: band.color,
    textColor: band.textColor,
    borderColor: band.borderColor,
    pm25SubIndex: pm25Sub,
    pm10SubIndex: pm10Sub,
    prominentPollutant: prominent,
  };
}

// ── AQI Band Classification ──────────────────────────────────

function getAQIBand(aqi: number): { level: string; color: string; textColor: string; borderColor: string } {
  if (aqi <= 50)  return { level: 'Good',                        color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500' };
  if (aqi <= 100) return { level: 'Moderate',                    color: 'bg-yellow-500',  textColor: 'text-yellow-400',  borderColor: 'border-yellow-500' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive',     color: 'bg-orange-500',  textColor: 'text-orange-400',  borderColor: 'border-orange-500' };
  if (aqi <= 200) return { level: 'Unhealthy',                   color: 'bg-red-500',     textColor: 'text-red-400',     borderColor: 'border-red-500' };
  if (aqi <= 300) return { level: 'Very Unhealthy',              color: 'bg-purple-600',  textColor: 'text-purple-400',  borderColor: 'border-purple-600' };
  return              { level: 'Hazardous',                      color: 'bg-rose-900',    textColor: 'text-rose-400',    borderColor: 'border-rose-900' };
}

// ── Individual Pollutant Severity Thresholds ──────────────────

export function getCO2Severity(ppm: number): SeverityResult {
  if (ppm <= 400)  return { level: 'Excellent', color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' };
  if (ppm <= 600)  return { level: 'Good',      color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' };
  if (ppm <= 1000) return { level: 'Moderate',  color: 'bg-yellow-500',  textColor: 'text-yellow-400',  borderColor: 'border-yellow-500/30' };
  if (ppm <= 1500) return { level: 'Poor',      color: 'bg-orange-500',  textColor: 'text-orange-400',  borderColor: 'border-orange-500/30' };
  if (ppm <= 2000) return { level: 'Unhealthy', color: 'bg-red-500',     textColor: 'text-red-400',     borderColor: 'border-red-500/30' };
  return                   { level: 'Hazardous', color: 'bg-rose-900',    textColor: 'text-rose-400',    borderColor: 'border-rose-500/30' };
}

export function getTVOCSeverity(ppb: number): SeverityResult {
  if (ppb <= 65)   return { level: 'Good',      color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' };
  if (ppb <= 220)  return { level: 'Moderate',  color: 'bg-yellow-500',  textColor: 'text-yellow-400',  borderColor: 'border-yellow-500/30' };
  if (ppb <= 660)  return { level: 'Poor',      color: 'bg-orange-500',  textColor: 'text-orange-400',  borderColor: 'border-orange-500/30' };
  if (ppb <= 2200) return { level: 'Unhealthy', color: 'bg-red-500',     textColor: 'text-red-400',     borderColor: 'border-red-500/30' };
  return                   { level: 'Hazardous', color: 'bg-rose-900',    textColor: 'text-rose-400',    borderColor: 'border-rose-500/30' };
}

export function getTempSeverity(celsius: number): SeverityResult {
  if (celsius >= 18 && celsius <= 24) return { level: 'Optimal',  color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' };
  if (celsius >= 15 && celsius <= 28) return { level: 'Good',     color: 'bg-yellow-500',  textColor: 'text-yellow-400',  borderColor: 'border-yellow-500/30' };
  if (celsius >= 10 && celsius <= 35) return { level: 'Moderate', color: 'bg-orange-500',  textColor: 'text-orange-400',  borderColor: 'border-orange-500/30' };
  return                                      { level: 'Extreme', color: 'bg-red-500',     textColor: 'text-red-400',     borderColor: 'border-red-500/30' };
}

export function getHumiditySeverity(percent: number): SeverityResult {
  if (percent >= 30 && percent <= 60) return { level: 'Optimal',  color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' };
  if (percent >= 20 && percent <= 70) return { level: 'Good',     color: 'bg-yellow-500',  textColor: 'text-yellow-400',  borderColor: 'border-yellow-500/30' };
  return                                      { level: 'Poor',    color: 'bg-orange-500',  textColor: 'text-orange-400',  borderColor: 'border-orange-500/30' };
}

export function getPM25Severity(ugm3: number): SeverityResult {
  const sub = calcPM25AQI(ugm3);
  return getAQIBand(sub);
}

export function getPM10Severity(ugm3: number): SeverityResult {
  const sub = calcPM10AQI(ugm3);
  return getAQIBand(sub);
}

// ── EPA Linear Interpolation ──────────────────────────────────

function calcPM25AQI(c: number): number {
  if (c <= 12.0)  return calcLinear(50, 0, 12.0, 0.0, c);
  if (c <= 35.4)  return calcLinear(100, 51, 35.4, 12.1, c);
  if (c <= 55.4)  return calcLinear(150, 101, 55.4, 35.5, c);
  if (c <= 150.4) return calcLinear(200, 151, 150.4, 55.5, c);
  if (c <= 250.4) return calcLinear(300, 201, 250.4, 150.5, c);
  if (c <= 350.4) return calcLinear(400, 301, 350.4, 250.5, c);
  if (c <= 500.4) return calcLinear(500, 401, 500.4, 350.5, c);
  return 500;
}

function calcPM10AQI(c: number): number {
  if (c <= 54)  return calcLinear(50, 0, 54, 0, c);
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
