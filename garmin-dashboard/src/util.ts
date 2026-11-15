import type { Activity, Health } from './api';

export const RACE = new Date(2027, 6, 11);

export type Group = 'sim' | 'cykel' | 'lop' | 'styrka' | 'ovrigt';

export const GROUPS: Record<Group, { label: string; color: string }> = {
  sim: { label: 'Sim', color: 'var(--sim)' },
  cykel: { label: 'Cykel', color: 'var(--cykel)' },
  lop: { label: 'Löp', color: 'var(--lop)' },
  styrka: { label: 'Styrka', color: 'var(--styrka)' },
  ovrigt: { label: 'Övrigt', color: 'var(--dim)' },
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
