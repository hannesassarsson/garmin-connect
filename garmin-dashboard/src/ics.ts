import { groupOf, startOfDay, type Group } from './util';

export interface Ev {
  uid: string;
  start: Date;
  end: Date;
  allDay: boolean;
  summary: string;
  description: string;
}

function parseDate(v: string): { d: Date; allDay: boolean } {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return { d: new Date(NaN), allDay: false };
  const [y, mo, da, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map((x) => Number(x ?? 0));
  if (m[4] == null) return { d: new Date(y, mo - 1, da), allDay: true };
  // Tider med TZID=Europe/Stockholm tolkas som lokal tid (appen används i Sverige).
  return { d: m[7] ? new Date(Date.UTC(y, mo - 1, da, h, mi, s)) : new Date(y, mo - 1, da, h, mi, s), allDay: false };
}

const unescape = (s: string) =>
  s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

export function parseIcs(text: string): Ev[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: Ev[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.DTSTART) {
        const a = parseDate(cur.DTSTART);
        const b = cur.DTEND ? parseDate(cur.DTEND) : a;
        if (!isNaN(a.d.getTime())) {
          out.push({
            uid: cur.UID ?? `${cur.DTSTART}-${cur.SUMMARY ?? ''}`,
            start: a.d,
            end: isNaN(b.d.getTime()) ? a.d : b.d,
            allDay: a.allDay,
            summary: unescape(cur.SUMMARY ?? ''),
            description: unescape(cur.DESCRIPTION ?? ''),
          });
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i > 0) cur[line.slice(0, i).split(';')[0]] = line.slice(i + 1);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function eventGroup(summary: string): Group {
  const s = summary.toLowerCase();
  if (/styrka|crossfit|hyrox|gym/.test(s)) return 'styrka';
  if (/sim|bassäng|crawl/.test(s)) return 'sim';
  if (/zwift|cykel|cykl|bike|ftp|ramptest/.test(s)) return 'cykel';
  if (/löp|jogg|run|intervall/.test(s)) return 'lop';
  if (/vila|vilodag/.test(s)) return 'ovrigt';
  return groupOf(s);
}

export const isDone = (e: Ev) => /GENOMFÖRT/i.test(e.description);

export interface Shift {
  start: Date;
  end: Date;
  hours: number;
  names: string[];
}

export interface PlanDay {
  date: Date;
  shift: Shift | null;
  tags: string[];
  /** true om datumet ligger efter sista arbetspasset i filen: schemat saknas, inte ledig. */
  scheduleMissing: boolean;
  training: Ev[];
}

export function buildPlan(training: Ev[], work: Ev[], from: Date, days: number): PlanDay[] {
  const timed = work.filter((e) => !e.allDay);
  const lastWork = timed.length ? startOfDay(timed[timed.length - 1].start).getTime() : null;
  const out: PlanDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const t0 = date.getTime();
    const t1 = t0 + 86400000;
    const todays = timed.filter((e) => e.start.getTime() >= t0 && e.start.getTime() < t1);
    let shift: Shift | null = null;
    if (todays.length) {
      const start = new Date(Math.min(...todays.map((e) => e.start.getTime())));
      const end = new Date(Math.max(...todays.map((e) => e.end.getTime())));
      shift = { start, end, hours: (end.getTime() - start.getTime()) / 3600000, names: todays.map((e) => e.summary) };
    }
    out.push({
      date,
      shift,
      tags: work
        .filter((e) => e.allDay && e.start.getTime() <= t0 && (e.end.getTime() > t0 || e.end.getTime() === e.start.getTime()))
        .map((e) => e.summary),
      scheduleMissing: lastWork == null || t0 > lastWork,
      training: training.filter((e) => e.start.getTime() >= t0 && e.start.getTime() < t1),
    });
  }
  return out;
}
