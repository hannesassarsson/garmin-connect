import type { Activity, Feed, MetricsDay, RecordRow } from './api';
import { Spark } from './ui';
import { dayLabel, fmtDate, fmtDur, fmtHms, fmtPace, groupOf, mondayOf, num, parseLocal } from './util';
import { icon, type Wx } from './weather';

/* ───────── Garmins formmått (rådata kan se olika ut, så vi letar defensivt) ───────── */

function deepFind(obj: unknown, key: string, depth = 0): unknown {
  if (obj == null || typeof obj !== 'object' || depth > 6) return undefined;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const r = deepFind(x, key, depth + 1);
      if (r !== undefined && r !== null) return r;
    }
    return undefined;
  }
  const o = obj as Record<string, unknown>;
  if (o[key] !== undefined && o[key] !== null) return o[key];
  for (const v of Object.values(o)) {
    const r = deepFind(v, key, depth + 1);
    if (r !== undefined && r !== null) return r;
  }
  return undefined;
}

const asNum = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() && isFinite(Number(v)) ? Number(v) : null);

const STATUS: Record<string, string> = {
  PRODUCTIVE: 'Produktiv',
  MAINTAINING: 'Bibehåller',
  RECOVERY: 'Återhämtning',
  UNPRODUCTIVE: 'Improduktiv',
  DETRAINING: 'Formtapp',
  OVERREACHING: 'Överbelastning',
  PEAKING: 'Toppform',
  STRAINED: 'Ansträngd',
  NO_STATUS: 'Ingen status',
  PAUSED: 'Pausad',
};

export interface Fitness {
  day: string;
  vo2run: number | null;
  vo2bike: number | null;
  status: string | null;
  endurance: number | null;
  race: { k5: number | null; k10: number | null; hm: number | null };
}

function parseDay(d: MetricsDay): Fitness {
  // VO2max finns i max_metrics, men Garmin lämnar den ofta tom; då finns samma värde i training_status.
  const recent = deepFind(d.m.training_status, 'mostRecentVO2Max');
  const generic = deepFind(d.m.max_metrics, 'generic') ?? deepFind(recent, 'generic');
  const cycling = deepFind(d.m.max_metrics, 'cycling') ?? deepFind(recent, 'cycling');
  const phrase = deepFind(d.m.training_status, 'trainingStatusFeedbackPhrase');
  const rp = Array.isArray(d.m.race_predictions) ? d.m.race_predictions[0] : d.m.race_predictions;
  const key = typeof phrase === 'string' ? (Object.keys(STATUS).find((k) => phrase.startsWith(k)) ?? null) : null;
  return {
    day: d.day,
    vo2run: asNum(deepFind(generic, 'vo2MaxPreciseValue')) ?? asNum(deepFind(generic, 'vo2MaxValue')),
    vo2bike: asNum(deepFind(cycling, 'vo2MaxPreciseValue')) ?? asNum(deepFind(cycling, 'vo2MaxValue')),
    status: key ? STATUS[key] : null,
    endurance: asNum(deepFind(d.m.endurance_score, 'overallScore')),
    race: {
      k5: asNum(deepFind(rp, 'time5K')),
      k10: asNum(deepFind(rp, 'time10K')),
      hm: asNum(deepFind(rp, 'timeHalfMarathon')),
    },
  };
}

export function fitnessSeries(metrics: MetricsDay[] | undefined): Fitness[] {
  return (metrics ?? []).map(parseDay);
}

export function FitnessPanel({ series }: { series: Fitness[] }) {
  const latest = series.find((f) => f.vo2run || f.status || f.endurance || f.race.hm);
  if (!latest) {
    return (
      <section className="panel">
        <h2>Form enligt Garmin</h2>
        <p className="note">Ingen data än. VO2max, träningsstatus och loppprognos hämtas från och med nästa Garmin-synk.</p>
      </section>
    );
  }
  const vo2 = [...series].reverse().map((f) => f.vo2run);
  return (
    <section className="panel">
      <h2>
        Form enligt Garmin <span>{dayLabel(latest.day)}</span>
      </h2>
      <div className="stats3">
        <div>
          <dt>VO2max löp</dt>
          <dd>{latest.vo2run != null ? num(latest.vo2run, 1) : '–'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className="small">{latest.status ?? '–'}</dd>
        </div>
        <div>
          <dt>Halvmara</dt>
          <dd className="small">{latest.race.hm ? fmtHms(latest.race.hm) : '–'}</dd>
        </div>
      </div>
      {vo2.filter((v) => v != null).length >= 2 && <Spark values={vo2} />}
      <p className="note">
        {latest.vo2bike != null && `VO2max cykel ${num(latest.vo2bike, 1)}. `}
        {latest.endurance != null && `Uthållighetspoäng ${num(latest.endurance)}. `}
        {latest.race.k5 != null && `Prognos 5 km ${fmtHms(latest.race.k5)}, 10 km ${latest.race.k10 ? fmtHms(latest.race.k10) : '–'}. `}
        Garmins egna beräkningar.
      </p>
    </section>
  );
}

/* ───────── Personbästa och simstreak ───────── */

const isNew = (r: RecordRow | null | undefined) => !!r && Date.now() - parseLocal(r.start_local).getTime() < 7 * 86400000;

export function swimStreak(acts: Activity[]) {
  const perWeek = new Map<number, number>();
  for (const a of acts) {
    if (groupOf(a.sport) !== 'sim') continue;
    const k = mondayOf(parseLocal(a.start_local)).getTime();
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const thisMon = mondayOf(new Date());
  const thisWeek = perWeek.get(thisMon.getTime()) ?? 0;
  let streak = thisWeek >= 2 ? 1 : 0;
  const d = new Date(thisMon);
  for (;;) {
    d.setDate(d.getDate() - 7);
    if ((perWeek.get(d.getTime()) ?? 0) >= 2) streak++;
    else break;
  }
  return { streak, thisWeek };
}

export function RecordsPanel({ feed }: { feed: Feed }) {
  const r = feed.records;
  const { streak, thisWeek } = swimStreak(feed.activities);
  const rows: { label: string; value: string; rec: RecordRow | null | undefined }[] = [];
  for (const b of r?.run ?? []) {
    rows.push({
      label: b.bucket === 21.1 ? 'Snabbast löp ≥ 21,1 km' : `Snabbast löp ≥ ${b.bucket} km`,
      value: `${fmtPace(b.pace_min_per_km ?? null)}/km · ${num(b.distance_km, 1)} km`,
      rec: b,
    });
  }
  if (r?.run_longest) rows.push({ label: 'Längsta löppass', value: `${num(r.run_longest.distance_km, 1)} km`, rec: r.run_longest });
  if (r?.bike_20min) rows.push({ label: 'Bästa 20 min effekt', value: `${num(r.bike_20min.max_20min_power)} W`, rec: r.bike_20min });
  if (r?.bike_longest) rows.push({ label: 'Längsta cykelpass', value: fmtDur(r.bike_longest.duration_min ?? null), rec: r.bike_longest });
  if (r?.swim_longest)
    rows.push({ label: 'Längsta simpass', value: `${num((r.swim_longest.distance_km ?? 0) * 1000)} m`, rec: r.swim_longest });
  if (r?.swim_fastest)
    rows.push({
      label: 'Snabbast sim ≥ 800 m',
      value: `${fmtPace(r.swim_fastest.swim_pace_min_per_100m ?? null)}/100 m`,
      rec: r.swim_fastest,
    });
  return (
    <>
      <section className="panel streak">
        <h2>
          Simstreak <span>{streak} {streak === 1 ? 'vecka' : 'veckor'}</span>
        </h2>
        <div className="dots" aria-label={`${thisWeek} av 2 simpass den här veckan`}>
          {[0, 1].map((i) => (
            <i key={i} data-on={thisWeek > i} />
          ))}
          <span>{thisWeek >= 2 ? 'Veckans två simpass klara 🏊‍♂️' : `${thisWeek} av 2 simpass den här veckan`}</span>
        </div>
        <p className="note">Veckor i rad med minst två simpass, din svagaste gren.</p>
      </section>
      <section className="panel">
        <h2>Personbästa</h2>
        {rows.length === 0 ? (
          <p className="note">Inga rekord att visa än.</p>
        ) : (
          <ul className="records">
            {rows.map((x) => (
              <li key={x.label} data-new={isNew(x.rec)}>
                <span>
                  {x.label}
                  {isNew(x.rec) && <b className="new">NYTT</b>}
                </span>
                <strong>{x.value}</strong>
                <small>{x.rec ? fmtDate(parseLocal(x.rec.start_local)) : ''}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="note">Ur all Garmin-data i databasen (från slutet av juli). Löptempot gäller hela passet, inte en uppmätt sträcka.</p>
      </section>
    </>
  );
}

/* ───────── Väderrad ───────── */

export function WeatherLine({ w, warn }: { w: Wx; warn: string | null }) {
  return (
    <span className="wx" data-warn={!!warn}>
      {icon(w.code)} {w.temp}°{w.feels < w.temp - 2 ? ` (känns ${w.feels}°)` : ''} · vind {w.wind}
      {w.gust >= w.wind + 4 ? `–${w.gust}` : ''} m/s
      {w.rainProb != null ? ` · regn ${w.rainProb} %` : ''}
      {warn && <em> · {warn}</em>}
    </span>
  );
}
