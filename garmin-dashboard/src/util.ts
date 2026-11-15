import type { Activity, Health } from './api';

export const RACE = new Date(2027, 6, 11);

export type Group = 'sim' | 'cykel' | 'lop' | 'styrka' | 'ovrigt';

// color = ljus HUD-färg för text och kanter, chart = validerad diagramfärg (färgblindsäker mot mörk yta).
export const GROUPS: Record<Group, { label: string; color: string; chart: string }> = {
  sim: { label: 'Sim', color: 'var(--sim)', chart: 'var(--c-sim)' },
  cykel: { label: 'Cykel', color: 'var(--cykel)', chart: 'var(--c-cykel)' },
  lop: { label: 'Löp', color: 'var(--lop)', chart: 'var(--c-lop)' },
  styrka: { label: 'Styrka', color: 'var(--styrka)', chart: 'var(--c-styrka)' },
  ovrigt: { label: 'Övrigt', color: 'var(--dim)', chart: 'var(--dim)' },
};

export function groupOf(sport: string): Group {
  if (/swim/.test(sport)) return 'sim';
  if (/cycl|biking|ride/.test(sport)) return 'cykel';
  if (/running/.test(sport)) return 'lop';
  if (/strength|hiit|crossfit|cardio/.test(sport)) return 'styrka';
  return 'ovrigt';
}

// start_local är svensk lokal tid utan zon: tolka den som den står.
export function parseLocal(s: string): Date {
  const [d, t = '00:00:00'] = s.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi, se] = t.split(':').map((x) => Math.floor(Number(x)));
  return new Date(y, mo - 1, da, h || 0, mi || 0, se || 0);
}

export const fmtDay = (d: Date) =>
  d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (d: Date) =>
  d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

export function fmtWhen(d: Date): string {
  const today = new Date();
  const days = Math.round((startOfDay(today).getTime() - startOfDay(d).getTime()) / 86400000);
  if (days === 0) return `i dag ${fmtTime(d)}`;
  if (days === 1) return `i går ${fmtTime(d)}`;
  return `${fmtDay(d)} ${fmtTime(d)}`;
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function mondayOf(d: Date) {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export function fmtDur(min: number | null): string {
  if (min == null) return '–';
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export function fmtPace(minPer: number | null): string {
  if (minPer == null || !isFinite(minPer) || minPer <= 0) return '–';
  let m = Math.floor(minPer);
  let s = Math.round((minPer - m) * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const num = (v: number | null | undefined, dec = 0) =>
  v == null ? '–' : Number(v).toLocaleString('sv-SE', { maximumFractionDigits: dec });

/** Senaste dagen som faktiskt har ett värde (dagens rad är ofta halvfylld). */
export function latest<K extends keyof Health>(
  health: Health[],
  key: K,
): { value: NonNullable<Health[K]>; row: Health } | null {
  for (const row of health) {
    const v = row[key];
    if (v != null) return { value: v as NonNullable<Health[K]>, row };
  }
  return null;
}

export function dayLabel(day: string): string {
  const d = parseLocal(day);
  const diff = Math.round((startOfDay(new Date()).getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'i dag';
  if (diff === 1) return 'i går';
  if (diff === -1) return 'i morgon';
  return fmtDay(d);
}

export function activityHeadline(a: Activity): string {
  const g = groupOf(a.sport);
  const parts: string[] = [];
  if (g === 'sim') {
    if (a.distance_km) parts.push(`${num(a.distance_km * 1000)} m`);
    if (a.swim_pace_min_per_100m) parts.push(`${fmtPace(a.swim_pace_min_per_100m)}/100 m`);
  } else if (g === 'lop') {
    if (a.distance_km) parts.push(`${num(a.distance_km, 1)} km`);
    if (a.pace_min_per_km) parts.push(`${fmtPace(a.pace_min_per_km)}/km`);
  } else if (g === 'cykel') {
    if (a.distance_km) parts.push(`${num(a.distance_km, 1)} km`);
    if (a.avg_power) parts.push(`${num(a.avg_power)} W`);
  }
  parts.unshift(fmtDur(a.duration_min));
  if (a.avg_hr) parts.push(`${num(a.avg_hr)} bpm`);
  return parts.join(' · ');
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'God natt';
  if (h < 10) return 'God morgon';
  if (h < 18) return 'God dag';
  return 'God kväll';
}

export function isoWeek(d: Date): { year: number; week: number; key: string } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year, week, key: `${year}-W${String(week).padStart(2, '0')}` };
}

export function mondayOfIsoWeek(key: string): Date {
  const [y, w] = key.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const mon = mondayOf(jan4);
  mon.setDate(mon.getDate() + (w - 1) * 7);
  return mon;
}

export function fmtHms(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const fmtHm = (sec: number) => {
  const m = Math.round(sec / 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

export const fmtDate = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
