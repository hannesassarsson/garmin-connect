// Väderprognos för Ystad från Open-Meteo (gratis, ingen nyckel). Data: CC BY 4.0, Open-Meteo.com.
const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=55.43&longitude=13.82&timezone=Europe%2FStockholm' +
  '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code' +
  '&wind_speed_unit=ms&forecast_days=14';

export interface Hour {
  t: number;
  temp: number;
  feels: number;
  rainProb: number | null;
  rain: number;
  wind: number;
  gust: number;
  code: number;
}

let cache: { at: number; hours: Hour[] } | null = null;

export async function fetchWeather(): Promise<Hour[]> {
  if (cache && Date.now() - cache.at < 30 * 60000) return cache.hours;
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Väder ${res.status}`);
  const j = await res.json();
  const h = j.hourly;
  const hours: Hour[] = h.time.map((ts: string, i: number) => {
    const [d, tm] = ts.split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [hh, mm] = tm.split(':').map(Number);
    return {
      t: new Date(y, mo - 1, da, hh, mm).getTime(),
      temp: h.temperature_2m[i],
      feels: h.apparent_temperature[i],
      rainProb: h.precipitation_probability?.[i] ?? null,
      rain: h.precipitation[i] ?? 0,
      wind: h.wind_speed_10m[i],
      gust: h.wind_gusts_10m[i],
      code: h.weather_code[i],
    };
  });
  cache = { at: Date.now(), hours };
  return hours;
}

/** Väder under ett pass: varmast/kallast, mest vind och regn mellan start och slut. */
export function during(hours: Hour[], start: Date, end: Date) {
  const a = start.getTime() - 30 * 60000;
  const b = Math.max(end.getTime(), start.getTime() + 60 * 60000);
  const hs = hours.filter((h) => h.t >= a && h.t <= b);
  if (!hs.length) return null;
  return {
    temp: Math.round(hs.reduce((s, h) => s + h.temp, 0) / hs.length),
    feels: Math.round(Math.min(...hs.map((h) => h.feels))),
    wind: Math.round(Math.max(...hs.map((h) => h.wind))),
    gust: Math.round(Math.max(...hs.map((h) => h.gust))),
    rainProb: hs.some((h) => h.rainProb != null) ? Math.max(...hs.map((h) => h.rainProb ?? 0)) : null,
    rain: Math.round(hs.reduce((s, h) => s + h.rain, 0) * 10) / 10,
    code: hs[Math.floor(hs.length / 2)].code,
  };
}

export type Wx = NonNullable<ReturnType<typeof during>>;

export function icon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

/** Kort varning för utepass, eller null om vädret är okej. */
export function warning(w: Wx, sport: 'lop' | 'cykel'): string | null {
  const out: string[] = [];
  if (w.feels <= -5) out.push('mycket kallt');
  else if (w.temp <= 1 && (w.rain > 0 || (w.rainProb ?? 0) >= 50)) out.push('risk för halka');
  if (sport === 'cykel' && (w.wind >= 9 || w.gust >= 15)) out.push('hård vind, Zwift är tryggare');
  else if (w.wind >= 12 || w.gust >= 18) out.push('hård vind');
  if (w.rain >= 3) out.push('mycket regn');
  return out.length ? out.join(', ') : null;
}
