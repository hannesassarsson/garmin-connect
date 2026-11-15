// Publik (publishable) nyckel: får ligga i klienten. All data är låst bakom
// den personliga åtkomstnyckeln som kontrolleras i databasen (coach_feed).
const SUPABASE_URL = 'https://vqimjctsfgncertfzqtp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_96sOYIhhPFIIBxeGLgJRdg_TqvNUwiy';
const STORE = 'coach_os_key';

export type Kind = 'pass' | 'morgon' | 'kvall' | 'plan' | 'vecka' | 'info';

export interface Message {
  id: number;
  created_at: string;
  kind: Kind;
  title: string;
  body_md: string;
  activity_id: number | null;
  metrics: Record<string, string | number> | null;
  read_at: string | null;
}

export interface Health {
  day: string;
  sleep_score: number | null;
  sleep_hours: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  hrv_last_night: number | null;
  hrv_weekly_avg: number | null;
  hrv_status: string | null;
  hrv_baseline_low: number | null;
  hrv_baseline_high: number | null;
  resting_hr: number | null;
  resting_hr_7d_avg: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  avg_stress: number | null;
  training_readiness: number | null;
  training_readiness_level: string | null;
}

export interface Activity {
  activity_id: number;
  start_local: string;
  sport: string;
  name: string | null;
  distance_km: number | null;
  duration_min: number | null;
  pace_min_per_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  norm_power: number | null;
  training_load: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
  swim_pace_min_per_100m: number | null;
  hr_zone1_s: number | null;
  hr_zone2_s: number | null;
  hr_zone3_s: number | null;
  hr_zone4_s: number | null;
  hr_zone5_s: number | null;
}

export interface Feed {
  generated_at: string;
  messages: Message[];
  health: Health[];
  activities: Activity[];
}

export class Unauthorized extends Error {}

export function loadKey(): string | null {
  // Nyckeln kommer första gången via länken (#k=...) och sparas sedan lokalt.
  const m = window.location.hash.match(/k=([A-Za-z0-9_-]{20,})/);
  if (m) {
    try {
      localStorage.setItem(STORE, m[1]);
    } catch {
      /* privat läge: nyckeln lever bara i minnet */
    }
    history.replaceState(null, '', window.location.pathname);
    return m[1];
  }
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

export function saveKey(key: string) {
  try {
    localStorage.setItem(STORE, key);
  } catch {
    /* ignore */
  }
}

export function clearKey() {
  try {
    localStorage.removeItem(STORE);
  } catch {
    /* ignore */
  }
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (txt.includes('unauthorized') || res.status === 401 || res.status === 403) {
      throw new Unauthorized('Åtkomstnyckeln godkändes inte');
    }
    throw new Error(`Databasen svarade ${res.status}`);
  }
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : null) as T;
}

export const fetchFeed = (key: string) => rpc<Feed>('coach_feed', { p_token: key });
export const markRead = (key: string, id: number | null) =>
  rpc<null>('coach_mark_read', { p_token: key, p_id: id });
