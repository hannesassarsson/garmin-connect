import { useEffect, useMemo, useState } from 'react';
import {
  CLAUDE_PROJECT_URL,
  fetchActivity,
  type Activity,
  type Detail,
  type Feed,
  type Health,
  type Kind,
  type Message,
  type Season,
} from './api';
import { eventGroup, isDone, outdoorSport, type Ev, type PlanDay } from './ics';
import { FitnessPanel, RecordsPanel, WeatherLine, fitnessSeries } from './fitness';
import { during, warning, type Hour } from './weather';
import { disablePush, enablePush, pushState, type PushState } from './push';
import { Card, Core, HRV, KIND, LEVEL, LineChart, Sheet, Spark, SpeakButton, Tile, Typed } from './ui';
import {
  GROUPS,
  activityHeadline,
  avg,
  dayLabel,
  fmtDate,
  fmtDay,
  fmtDur,
  fmtHm,
  fmtHms,
  fmtPace,
  fmtTime,
  fmtWhen,
  greeting,
  groupOf,
  isoWeek,
  latest,
  median,
  mondayOf,
  mondayOfIsoWeek,
  num,
  parseLocal,
  startOfDay,
  type Group,
} from './util';

const DAY = 86400000;
const SPORTS: Group[] = ['sim', 'cykel', 'lop', 'styrka'];

export interface PlanData {
  days: PlanDay[];
  next: Ev | null;
  trainingError: string | null;
  workFetched: string | null;
  weather: Hour[] | null;
}

function EvWeather({ e, hours }: { e: Ev; hours: Hour[] | null }) {
  const sport = outdoorSport(e);
  if (!sport || !hours) return null;
  const w = during(hours, e.start, e.end);
  if (!w) return null;
  return <WeatherLine w={w} warn={warning(w, sport)} />;
}

/* ───────────────────────── Läge ───────────────────────── */

function shiftText(d: PlanDay | undefined): string {
  if (!d) return '';
  if (d.shift) return `Jobb ${fmtTime(d.shift.start)}–${fmtTime(d.shift.end)} (${num(d.shift.hours, 1)} h)`;
  if (d.tags.length) return d.tags.join(', ');
  return d.scheduleMissing ? 'Arbetsschema saknas' : 'Ledig';
}

export function Hud(props: {
  feed: Feed;
  plan: PlanData;
  accessKey: string;
  onOpen: (m: Message) => void;
  onReports: () => void;
  onPlan: () => void;
}) {
  const { feed, plan } = props;
  const h = feed.health;
  const ready = latest(h, 'training_readiness');
  const sleep = latest(h, 'sleep_score');
  const hrv = latest(h, 'hrv_last_night');
  const rhr = latest(h, 'resting_hr');
  const bb = latest(h, 'body_battery_high');
  const race = feed.settings.season ? parseLocal(feed.settings.season.race.date) : new Date(2027, 6, 11);
  const days = Math.ceil((race.getTime() - startOfDay(new Date()).getTime()) / DAY);
  const series = (k: keyof Health) => [...h].reverse().slice(-14).map((r) => r[k] as number | null);
  const newest = feed.messages[0];
  const week = useWeek(feed.activities);
  const today = plan.days[0];
  const next = plan.next;
  const nextDay = next ? plan.days.find((d) => d.date.getTime() === startOfDay(next.start).getTime()) : undefined;

  const line = `${greeting()}, Hannes. Alla system online. ${days} dagar till Jönköping.`;

  const brief = [
    `${greeting()} Hannes.`,
    ready ? `Beredskap ${ready.value}, ${(LEVEL[ready.row.training_readiness_level ?? ''] ?? '').toLowerCase()}.` : '',
    sleep ? `Sömn ${num(sleep.row.sleep_hours, 1)} timmar, sömnpoäng ${sleep.value}.` : '',
    hrv ? `HRV ${hrv.value}, ${(HRV[hrv.row.hrv_status ?? ''] ?? '').toLowerCase()}.` : '',
    rhr ? `Vilopuls ${rhr.value}.` : '',
    today ? `I dag: ${shiftText(today)}.` : '',
    next ? `Nästa pass: ${next.summary}, ${dayLabel(isoDay(next.start))} klockan ${fmtTime(next.start)}.` : '',
    `${days} dagar till Jönköping.`,
  ]
    .filter(Boolean)
    .join(' ');

  let hrvPos: number | null = null;
  let band: [number, number] | null = null;
  if (hrv && hrv.row.hrv_baseline_low != null && hrv.row.hrv_baseline_high != null) {
    const lo = hrv.row.hrv_baseline_low - 25;
    const hi = hrv.row.hrv_baseline_high + 25;
    const p = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
    hrvPos = p(hrv.value);
    band = [p(hrv.row.hrv_baseline_low), p(hrv.row.hrv_baseline_high)];
  }

  return (
    <>
      <Typed text={line} />
      <Core value={ready?.value ?? null} level={ready?.row.training_readiness_level ?? null} />
      <div className="core-actions">
        <span className="asof">{ready ? `Beredskap mätt ${dayLabel(ready.row.day)}` : 'Ingen beredskap än'}</span>
        <SpeakButton text={brief} label="Läs upp läget" />
      </div>

      <section className="panel next">
        <h2>
          Nästa pass
          <button className="link" onClick={props.onPlan}>
            Hela planen
          </button>
        </h2>
        {plan.trainingError && <p className="note">Träningskalendern gick inte att läsa: {plan.trainingError}</p>}
        {next ? (
          <div className="nextbody" style={{ ['--g' as string]: GROUPS[eventGroup(next.summary)].color }}>
            <div className="when">
              <b>{dayLabel(isoDay(next.start))}</b>
              <span>
                {fmtTime(next.start)}–{fmtTime(next.end)}
              </span>
            </div>
            <h4>{next.summary}</h4>
            <EvWeather e={next} hours={plan.weather} />
            <p>{clip(next.description, 150)}</p>
            <p className="note">Samma dag: {shiftText(nextDay)}</p>
          </div>
        ) : (
          !plan.trainingError && <p className="note">Inget kommande pass i träningskalendern.</p>
        )}
        {today && <p className="note">I dag: {shiftText(today)}</p>}
      </section>

      <div className="grid">
        <Tile
          label="Sömn"
          value={num(sleep?.value)}
          unit="/100"
          note={sleep ? `${num(sleep.row.sleep_hours, 1)} h · natten mot ${dayLabel(sleep.row.day)}` : 'Ingen sömndata'}
        >
          <Spark values={series('sleep_score')} />
        </Tile>
        <Tile
          label="HRV"
          value={num(hrv?.value)}
          unit="ms"
          note={
            hrv
              ? `${HRV[hrv.row.hrv_status ?? ''] ?? hrv.row.hrv_status ?? ''} · bas ${num(hrv.row.hrv_baseline_low)}–${num(hrv.row.hrv_baseline_high)}`
              : 'Ingen HRV-data'
          }
        >
          {band && hrvPos != null ? (
            <div className="range" aria-hidden="true">
              <span className="band" style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%` }} />
              <span className="mark" style={{ left: `${hrvPos}%` }} />
            </div>
          ) : (
            <Spark values={series('hrv_last_night')} />
          )}
        </Tile>
        <Tile
          label="Vilopuls"
          value={num(rhr?.value)}
          unit="bpm"
          note={rhr?.row.resting_hr_7d_avg != null ? `7 dagar: ${num(rhr.row.resting_hr_7d_avg)} bpm` : undefined}
        >
          <Spark values={series('resting_hr')} color="var(--lop)" />
        </Tile>
        <Tile
          label="Body Battery"
          value={num(bb?.value)}
          unit="topp"
          note={bb ? `Lägst ${num(bb.row.body_battery_low)} · ${dayLabel(bb.row.day)}` : undefined}
        >
          <Spark values={series('body_battery_high')} color="var(--cykel)" />
        </Tile>
      </div>

      <FitnessPanel series={fitnessSeries(feed.metrics)} />

      <section className="panel">
        <h2>
          Veckans träning <span>{fmtDur(week.total)}</span>
        </h2>
        {SPORTS.map((g) => (
          <div className="bar" key={g}>
            <label>{GROUPS[g].label}</label>
            <div>
              <i style={{ width: `${(week.by[g] / week.max) * 100}%`, background: GROUPS[g].color }} />
            </div>
            <span>{week.by[g] ? fmtDur(week.by[g]) : '–'}</span>
          </div>
        ))}
        <p className="note">Förra veckan totalt: {fmtDur(week.prev)}</p>
      </section>

      <section className="panel">
        <h2>
          Senaste rapport
          <button className="link" onClick={props.onReports}>
            Alla
          </button>
        </h2>
        {newest ? <Card m={newest} onOpen={props.onOpen} /> : <p className="note">Inga rapporter än. Nästa analys landar här.</p>}
      </section>

      <SystemPanel accessKey={props.accessKey} />
    </>
  );
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function useWeek(acts: Activity[]) {
  return useMemo(() => {
    const mon = mondayOf(new Date()).getTime();
    const prevMon = mon - 7 * DAY;
    const by: Record<Group, number> = { sim: 0, cykel: 0, lop: 0, styrka: 0, ovrigt: 0 };
    let prev = 0;
    for (const a of acts) {
      const t = parseLocal(a.start_local).getTime();
      const g = groupOf(a.sport);
      if (g === 'ovrigt') continue;
      if (t >= mon) by[g] += a.duration_min ?? 0;
      else if (t >= prevMon) prev += a.duration_min ?? 0;
    }
    const total = by.sim + by.cykel + by.lop + by.styrka;
    return { by, total, prev, max: Math.max(by.sim, by.cykel, by.lop, by.styrka, 1) };
  }, [acts]);
}

function SystemPanel({ accessKey }: { accessKey: string }) {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);
  const toggle = async () => {
    setErr(null);
    try {
      setState(state === 'on' ? await disablePush(accessKey) : await enablePush(accessKey));
    } catch {
      setErr('Det gick inte att ändra notiserna. Försök igen.');
    }
  };
  const text: Record<string, string> = {
    loading: 'Kontrollerar…',
    on: 'På. Du får en notis när en ny rapport landar.',
    off: 'Av.',
    denied: 'Blockerade i telefonens inställningar. Tillåt notiser för Coach OS där.',
    'needs-install': 'Lägg appen på hemskärmen (dela-knappen i Safari) och öppna den därifrån.',
    unsupported: 'Den här webbläsaren stöder inte pushnotiser.',
  };
  return (
    <section className="panel">
      <h2>System</h2>
      <div className="sysrow">
        <div>
          <b>Notiser</b>
          <p className="note">{err ?? text[state]}</p>
        </div>
        {(state === 'on' || state === 'off') && (
          <button className="ghost" onClick={toggle}>
            {state === 'on' ? 'Stäng av' : 'Slå på'}
          </button>
        )}
      </div>
      <div className="sysrow">
        <div>
          <b>Fråga coachen</b>
          <p className="note">Frågor och ändringar av pass görs i Claude, där coachen kan ändra kalendern.</p>
        </div>
        <a className="ghost" href={CLAUDE_PROJECT_URL} target="_blank" rel="noreferrer">
          Öppna
        </a>
      </div>
    </section>
  );
}

/* ───────────────────────── Plan ───────────────────────── */

export function PlanView({ plan }: { plan: PlanData }) {
  const [open, setOpen] = useState<string | null>(null);
  const todayT = startOfDay(new Date()).getTime();
  return (
    <>
      <h1 className="page">Plan · 14 dagar</h1>
      {plan.trainingError && <div className="alert">Träningskalendern gick inte att läsa: {plan.trainingError}</div>}
      <div className="stack">
        {plan.days.map((d) => {
          const long = d.shift && d.shift.hours >= 10;
          return (
            <article className="day" key={d.date.getTime()} data-today={d.date.getTime() === todayT}>
              <header>
                <b>{d.date.getTime() === todayT ? 'I dag' : cap(fmtDay(d.date))}</b>
                <span className="work" data-tone={d.shift ? (long ? 'warn' : 'work') : d.scheduleMissing && !d.tags.length ? 'dim' : 'free'}>
                  {shiftText(d)}
                </span>
              </header>
              {d.shift && d.tags.length > 0 && <p className="note">Heldag: {d.tags.join(', ')}</p>}
              {d.training.length === 0 && <p className="note">Inget pass planerat.</p>}
              {d.training.map((e) => {
                const g = eventGroup(e.summary);
                const done = isDone(e);
                return (
                  <button
                    key={e.uid}
                    className="ev"
                    data-done={done}
                    style={{ ['--g' as string]: GROUPS[g].color }}
                    aria-expanded={open === e.uid}
                    onClick={() => setOpen(open === e.uid ? null : e.uid)}
                  >
                    <span className="t">
                      {fmtTime(e.start)}–{fmtTime(e.end)}
                    </span>
                    <span className="s">
                      {e.summary}
                      {done && <em> · Genomfört</em>}
                    </span>
                    {outdoorSport(e) && plan.weather && (
                      <span className="w">
                        <EvWeather e={e} hours={plan.weather} />
                      </span>
                    )}
                    {open === e.uid && <span className="d">{e.description || 'Ingen beskrivning.'}</span>}
                  </button>
                );
              })}
            </article>
          );
        })}
      </div>
      {plan.workFetched && <p className="note">Arbetsschemat hämtat {fmtWhen(new Date(plan.workFetched))}. Tryck på ett pass för hela upplägget.</p>}
      <p className="note">Väder för Ystad vid utepass: Open-Meteo.com (CC BY 4.0). Prognosen sträcker sig 14 dagar och blir säkrare ju närmare passet är.</p>
    </>
  );
}

/* ───────────────────────── Rapporter ───────────────────────── */

export function Reports({ messages, onOpen }: { messages: Message[]; onOpen: (m: Message) => void }) {
  const [filter, setFilter] = useState<Kind | 'alla'>('alla');
  const kinds = useMemo(() => [...new Set(messages.map((m) => m.kind))], [messages]);
  const list = filter === 'alla' ? messages : messages.filter((m) => m.kind === filter);
  return (
    <>
      <h1 className="page">Rapporter</h1>
      {kinds.length > 1 && (
        <div className="filters">
          {(['alla', ...kinds] as (Kind | 'alla')[]).map((k) => (
            <button key={k} data-on={filter === k} onClick={() => setFilter(k)}>
              {k === 'alla' ? 'Alla' : KIND[k]}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 && <p className="note">Inga rapporter än. Passanalyser, morgonkoll och planer landar här.</p>}
      <div className="stack">
        {list.map((m) => (
          <Card key={m.id} m={m} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

/* ───────────────────────── Pass ───────────────────────── */

export function Sessions({ feed, onDetail }: { feed: Feed; onDetail: (a: Activity) => void }) {
  const [filter, setFilter] = useState<Group | 'alla'>('alla');
  const withMsg = useMemo(() => new Set(feed.messages.map((m) => m.activity_id).filter(Boolean)), [feed.messages]);
  const list = feed.activities.filter((a) => filter === 'alla' || groupOf(a.sport) === filter).slice(0, 60);
  return (
    <>
      <h1 className="page">Pass</h1>
      <div className="filters">
        {(['alla', ...SPORTS] as (Group | 'alla')[]).map((k) => (
          <button key={k} data-on={filter === k} onClick={() => setFilter(k)}>
            {k === 'alla' ? 'Alla' : GROUPS[k].label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="note">Inga pass i perioden.</p>}
      <div className="stack">
        {list.map((a) => {
          const g = groupOf(a.sport);
          const z = zones(a);
          const zt = z.reduce((s, x) => s + x, 0);
          return (
            <button className="act" key={a.activity_id} style={{ ['--g' as string]: GROUPS[g].color }} onClick={() => onDetail(a)}>
              <div className="meta">
                <span className="chip sport">{GROUPS[g].label}</span>
                <time>{fmtWhen(parseLocal(a.start_local))}</time>
              </div>
              <h4>{a.name || GROUPS[g].label}</h4>
              <p className="mono">{activityHeadline(a)}</p>
              {zt > 0 && (
                <div className="zones" aria-hidden="true">
                  {z.map((x, i) => (
                    <i key={i} className={`z${i + 1}`} style={{ width: `${(x / zt) * 100}%` }} />
                  ))}
                </div>
              )}
              <div className="foot">
                <span>Belastning {num(a.training_load)}</span>
                <span className="go">{withMsg.has(a.activity_id) ? 'Detaljer + analys ›' : 'Detaljer ›'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

const zones = (a: Activity) => [a.hr_zone1_s, a.hr_zone2_s, a.hr_zone3_s, a.hr_zone4_s, a.hr_zone5_s].map((x) => x ?? 0);

function mainMetric(g: Group, a: { pace_min_per_km: number | null; avg_power: number | null; swim_pace_min_per_100m: number | null }) {
  if (g === 'sim') return a.swim_pace_min_per_100m ? `${fmtPace(a.swim_pace_min_per_100m)}/100 m` : '–';
  if (g === 'lop') return a.pace_min_per_km ? `${fmtPace(a.pace_min_per_km)}/km` : '–';
  if (g === 'cykel') return a.avg_power ? `${num(a.avg_power)} W` : '–';
  return '–';
}

export function DetailSheet(props: {
  activity: Activity;
  accessKey: string;
  message: Message | undefined;
  onOpen: (m: Message) => void;
  onClose: () => void;
}) {
  const a = props.activity;
  const g = groupOf(a.sport);
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setD(null);
    setErr(false);
    fetchActivity(props.accessKey, a.activity_id).then(
      (r) => live && (r ? setD(r) : setErr(true)),
      () => live && setErr(true),
    );
    return () => {
      live = false;
    };
  }, [a.activity_id, props.accessKey]);

  const z = zones(a);
  const zt = z.reduce((s, x) => s + x, 0);
  const full = d?.activity;
  const laps = (d?.laps ?? []).filter((l) => (l.distance ?? 0) > 0 || g === 'styrka');
  const rest = (d?.laps ?? []).length - laps.length;
  const sims = d?.similar ?? [];
  const metricLabel = g === 'cykel' ? 'Effekt' : 'Tempo';
  const stats: [string, string][] = [
    ['Tid', fmtDur(a.duration_min)],
    ['Distans', a.distance_km ? (g === 'sim' ? `${num(a.distance_km * 1000)} m` : `${num(a.distance_km, 2)} km`) : '–'],
    [metricLabel, mainMetric(g, a)],
    ['Snittpuls', a.avg_hr ? `${num(a.avg_hr)}` : '–'],
    ['Maxpuls', a.max_hr ? `${num(a.max_hr)}` : '–'],
    ['Belastning', num(a.training_load)],
  ];
  if (g === 'cykel' && a.norm_power) stats.push(['NP', `${num(a.norm_power)} W`]);
  if (a.aerobic_te != null) stats.push(['Aerob effekt', num(a.aerobic_te, 1)]);
  if (full?.avg_cadence) stats.push(['Kadens', num(Number(full.avg_cadence))]);
  if (full?.elevation_gain_m) stats.push(['Stigning', `${num(Number(full.elevation_gain_m))} m`]);
  if (full?.avg_swolf) stats.push(['SWOLF', num(Number(full.avg_swolf))]);
  if (full?.calories) stats.push(['Energi', `${num(Number(full.calories))} kcal`]);

  const simAvg = (pick: (s: (typeof sims)[number]) => number | null) => avg(sims.map(pick).filter((x): x is number => x != null));
  const pz = d?.power?.zones.map((x) => x ?? 0) ?? [];
  const pzt = pz.reduce((s, x) => s + x, 0);
  const best = d?.power?.best ?? {};

  return (
    <Sheet label={a.name ?? 'Pass'} onClose={props.onClose}>
      <div className="meta">
        <span className="chip sport" style={{ ['--g' as string]: GROUPS[g].color }}>
          {GROUPS[g].label}
        </span>
        <time>{fmtWhen(parseLocal(a.start_local))}</time>
      </div>
      <h1>{a.name || GROUPS[g].label}</h1>
      {props.message && (
        <button className="card" data-unread="true" onClick={() => props.onOpen(props.message!)}>
          <div className="meta">
            <span className="chip k-pass">Passanalys</span>
          </div>
          <h4>{props.message.title}</h4>
          <p>Läs coachens analys av passet ›</p>
        </button>
      )}
      <dl className="metrics">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {zt > 0 && (
        <section className="block">
          <h2>Pulszoner</h2>
          {z.map((x, i) => (
            <div className="bar zone" key={i}>
              <label>Zon {i + 1}</label>
              <div>
                <i className={`z${i + 1}`} style={{ width: `${(x / Math.max(...z)) * 100}%` }} />
              </div>
              <span>
                {fmtHms(x)} · {num((x / zt) * 100)} %
              </span>
            </div>
          ))}
          <p className="note">Garmins pulszoner. Zon 1–2 räknas som lugnt: {num(((z[0] + z[1]) / zt) * 100)} % av passet.</p>
        </section>
      )}

      {pzt > 0 && (
        <section className="block">
          <h2>Effektzoner</h2>
          {pz.map((x, i) => (
            <div className="bar zone" key={i}>
              <label>Zon {i + 1}</label>
              <div>
                <i className="pz" style={{ width: `${(x / Math.max(...pz)) * 100}%` }} />
              </div>
              <span>
                {fmtHms(x)} · {num((x / pzt) * 100)} %
              </span>
            </div>
          ))}
          <dl className="metrics">
            {(
              [
                ['5', '5 s'],
                ['60', '1 min'],
                ['300', '5 min'],
                ['1200', '20 min'],
              ] as const
            )
              .filter(([k]) => best[k])
              .map(([k, l]) => (
                <div key={k}>
                  <dt>Bäst {l}</dt>
                  <dd>{num(best[k])} W</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {!d && !err && <p className="loading small">Hämtar varv och jämförelse…</p>}
      {err && <p className="note">Varv och jämförelse gick inte att hämta just nu.</p>}

      {laps.length > 1 && (
        <section className="block">
          <h2>{g === 'sim' ? 'Längder och intervaller' : 'Varv'}</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Distans</th>
                  <th>Tid</th>
                  <th>{metricLabel}</th>
                  <th>Puls</th>
                  {g === 'sim' && <th>SWOLF</th>}
                </tr>
              </thead>
              <tbody>
                {laps.map((l, i) => {
                  const dist = l.distance ?? 0;
                  const dur = l.duration ?? 0;
                  const metric =
                    g === 'cykel'
                      ? l.power
                        ? `${num(l.power)} W`
                        : '–'
                      : dist > 0 && dur > 0
                        ? g === 'sim'
                          ? fmtPace(dur / 60 / (dist / 100))
                          : fmtPace(dur / 60 / (dist / 1000))
                        : '–';
                  return (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{dist ? (g === 'sim' ? `${num(dist)} m` : `${num(dist / 1000, 2)} km`) : '–'}</td>
                      <td>{fmtHms(dur)}</td>
                      <td>{metric}</td>
                      <td>{l.hr ? num(l.hr) : '–'}</td>
                      {g === 'sim' && <td>{l.swolf ? num(l.swolf) : '–'}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rest > 0 && <p className="note">{rest} vilor mellan intervallerna visas inte.</p>}
        </section>
      )}

      {d && (
        <section className="block">
          <h2>Jämfört med liknande pass</h2>
          {sims.length === 0 ? (
            <p className="note">Inga liknande pass (samma gren, ±30 % i tid) de senaste 120 dagarna.</p>
          ) : (
            <>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Tid</th>
                      <th>{metricLabel}</th>
                      <th>Puls</th>
                      <th>Belastn.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="me">
                      <td>Det här</td>
                      <td>{fmtDur(a.duration_min)}</td>
                      <td>{mainMetric(g, a)}</td>
                      <td>{num(a.avg_hr)}</td>
                      <td>{num(a.training_load)}</td>
                    </tr>
                    {sims.map((s) => (
                      <tr key={s.activity_id}>
                        <td>{fmtDate(parseLocal(s.start_local))}</td>
                        <td>{fmtDur(s.duration_min)}</td>
                        <td>{mainMetric(g, s)}</td>
                        <td>{num(s.avg_hr)}</td>
                        <td>{num(s.training_load)}</td>
                      </tr>
                    ))}
                    <tr className="avg">
                      <td>Snitt ({sims.length})</td>
                      <td>{fmtDur(simAvg((s) => s.duration_min))}</td>
                      <td>
                        {mainMetric(g, {
                          pace_min_per_km: simAvg((s) => s.pace_min_per_km),
                          avg_power: simAvg((s) => s.avg_power),
                          swim_pace_min_per_100m: simAvg((s) => s.swim_pace_min_per_100m),
                        })}
                      </td>
                      <td>{num(simAvg((s) => s.avg_hr))}</td>
                      <td>{num(simAvg((s) => s.training_load))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="note">Samma gren, ±30 % i tid, senaste 120 dagarna före passet.</p>
            </>
          )}
        </section>
      )}
    </Sheet>
  );
}

/* ───────────────────────── Trender ───────────────────────── */

function loadCurve(acts: Activity[]) {
  const byDay = new Map<number, number>();
  let first = Infinity;
  for (const a of acts) {
    const t = startOfDay(parseLocal(a.start_local)).getTime();
    byDay.set(t, (byDay.get(t) ?? 0) + (a.training_load ?? 0));
    first = Math.min(first, t);
  }
  const out: { x: number; ctl: number; atl: number }[] = [];
  if (!isFinite(first)) return out;
  let ctl = 0;
  let atl = 0;
  const end = startOfDay(new Date());
  for (const d = new Date(first); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const load = byDay.get(d.getTime()) ?? 0;
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
    out.push({ x: d.getTime(), ctl, atl });
  }
  return out;
}

function weekly(acts: Activity[], weeks: number) {
  const mon = mondayOf(new Date());
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - (weeks - 1 - i) * 7);
    return { start, by: { sim: 0, cykel: 0, lop: 0, styrka: 0, ovrigt: 0 } as Record<Group, number>, total: 0 };
  });
  for (const a of acts) {
    const g = groupOf(a.sport);
    if (g === 'ovrigt') continue;
    const m = mondayOf(parseLocal(a.start_local)).getTime();
    const w = out.find((x) => x.start.getTime() === m);
    if (w) {
      w.by[g] += (a.duration_min ?? 0) / 60;
      w.total += (a.duration_min ?? 0) / 60;
    }
  }
  return out;
}

export function Trends({ feed }: { feed: Feed }) {
  const acts = feed.activities;
  const curve = useMemo(() => loadCurve(acts), [acts]);
  const shown = curve.slice(-84);
  const now = curve[curve.length - 1];
  const ratio = now && now.ctl > 0 ? now.atl / now.ctl : null;
  const weeks = useMemo(() => weekly(acts, 12), [acts]);
  const [wk, setWk] = useState(11);
  const maxW = Math.max(...weeks.map((w) => w.total), 1);
  const sel = weeks[wk];

  const cut = Date.now() - 28 * DAY;
  const z = [0, 0, 0];
  for (const a of acts) {
    if (parseLocal(a.start_local).getTime() < cut) continue;
    z[0] += (a.hr_zone1_s ?? 0) + (a.hr_zone2_s ?? 0);
    z[1] += a.hr_zone3_s ?? 0;
    z[2] += (a.hr_zone4_s ?? 0) + (a.hr_zone5_s ?? 0);
  }
  const zt = z[0] + z[1] + z[2];
  const phase = currentPhase(feed.settings.season);
  const target = phase?.name === 'Förberedande' ? 60 : 80;

  const firstDay = curve[0]?.x;
  const ratioText =
    ratio == null ? '' : ratio > 1.5 ? 'Hög belastning mot vad du är van vid' : ratio < 0.8 ? 'Lättare än vad du är van vid' : 'I balans med vad du är van vid';

  return (
    <>
      <h1 className="page">Trender</h1>

      <section className="panel">
        <h2>Formkurva</h2>
        <div className="stats3">
          <div>
            <dt>Kondition</dt>
            <dd>{now ? num(now.ctl) : '–'}</dd>
          </div>
          <div>
            <dt>Trötthet</dt>
            <dd>{now ? num(now.atl) : '–'}</dd>
          </div>
          <div>
            <dt>Kvot</dt>
            <dd>{ratio ? num(ratio, 2) : '–'}</dd>
          </div>
        </div>
        <LineChart
          label="Kondition och trötthet över tid"
          series={[
            { name: 'Kondition (42 dagar)', color: 'var(--c-sim)', points: shown.map((p) => ({ x: p.x, y: p.ctl })) },
            { name: 'Trötthet (7 dagar)', color: 'var(--c-cykel)', points: shown.map((p) => ({ x: p.x, y: p.atl })) },
          ]}
          fmtY={(v) => num(v)}
          fmtX={(x) => fmtDate(new Date(x))}
        />
        <p className="note">
          {ratioText}
          {ratioText && '. '}Kondition är snittet av Garmins träningsbelastning över 42 dagar, trötthet över 7 dagar. Kvoten 0,8–1,5 brukar
          räknas som lagom.
          {firstDay && ` Datan börjar ${fmtDate(new Date(firstDay))}, så kurvans första veckor är för låga.`}
        </p>
      </section>

      <section className="panel">
        <h2>
          Timmar per vecka <span>{num(sel.total, 1)} h</span>
        </h2>
        <div className="legend">
          {SPORTS.map((g) => (
            <span key={g}>
              <i style={{ background: GROUPS[g].chart }} />
              {GROUPS[g].label}
            </span>
          ))}
        </div>
        <div className="weeks" role="group" aria-label="Träningstimmar per vecka, 12 veckor">
          {weeks.map((w, i) => (
            <button key={i} data-on={i === wk} onClick={() => setWk(i)} aria-label={`Vecka ${isoWeek(w.start).week}: ${num(w.total, 1)} timmar`}>
              <span className="col" style={{ height: `${(w.total / maxW) * 100}%` }}>
                {SPORTS.filter((g) => w.by[g] > 0).map((g) => (
                  <i key={g} style={{ flexGrow: w.by[g], background: GROUPS[g].chart }} />
                ))}
              </span>
              <small>{isoWeek(w.start).week}</small>
            </button>
          ))}
        </div>
        <p className="note">
          Vecka {isoWeek(sel.start).week} ({fmtDate(sel.start)}):{' '}
          {SPORTS.filter((g) => sel.by[g] > 0)
            .map((g) => `${GROUPS[g].label} ${num(sel.by[g], 1)} h`)
            .join(' · ') || 'ingen träning'}
          . Tryck på en stapel för en annan vecka.
        </p>
      </section>

      <section className="panel">
        <h2>
          Intensitet, 28 dagar <span>{zt ? `${num((z[0] / zt) * 100)} % lugnt` : '–'}</span>
        </h2>
        {zt > 0 ? (
          <>
            <div className="split" role="img" aria-label={`Zon 1–2 ${num((z[0] / zt) * 100)} procent, zon 3 ${num((z[1] / zt) * 100)} procent, zon 4–5 ${num((z[2] / zt) * 100)} procent`}>
              {z.map((x, i) => (
                <i key={i} className={`s${i}`} style={{ flexGrow: x }} />
              ))}
              <b style={{ left: `${target}%` }} title={`Mål ${target} %`} />
            </div>
            <div className="legend">
              {['Zon 1–2', 'Zon 3', 'Zon 4–5'].map((l, i) => (
                <span key={l}>
                  <i className={`s${i}`} />
                  {l} {num((z[i] / zt) * 100)} %
                </span>
              ))}
            </div>
            <p className="note">
              Strecket är fasens mål: minst {target} % i zon 1–2. Räknat på Garmins pulszoner för alla pass med pulsdata.
            </p>
          </>
        ) : (
          <p className="note">Ingen pulsdata de senaste 28 dagarna.</p>
        )}
      </section>

      <SportTrend
        title="Löpning: tempo"
        acts={acts.filter((a) => groupOf(a.sport) === 'lop' && (a.duration_min ?? 0) >= 20 && a.pace_min_per_km)}
        pick={(a) => a.pace_min_per_km!}
        fmt={(v) => `${fmtPace(v)}/km`}
        axis={fmtPace}
        color="var(--c-lop)"
        invert
      />
      <SportTrend
        title="Cykel: snitteffekt"
        acts={acts.filter((a) => groupOf(a.sport) === 'cykel' && (a.duration_min ?? 0) >= 20 && a.avg_power)}
        pick={(a) => a.avg_power!}
        fmt={(v) => `${num(v)} W`}
        axis={(v) => num(v)}
        color="var(--c-cykel)"
      />
      <SportTrend
        title="Sim: tempo"
        acts={acts.filter((a) => groupOf(a.sport) === 'sim' && a.swim_pace_min_per_100m)}
        pick={(a) => a.swim_pace_min_per_100m!}
        fmt={(v) => `${fmtPace(v)}/100 m`}
        axis={fmtPace}
        color="var(--c-sim)"
        invert
      />
    </>
  );
}

function SportTrend(props: {
  title: string;
  acts: Activity[];
  pick: (a: Activity) => number;
  fmt: (v: number) => string;
  axis: (v: number) => string;
  color: string;
  invert?: boolean;
}) {
  const pts = [...props.acts].reverse().map((a) => ({ x: parseLocal(a.start_local).getTime(), y: props.pick(a) }));
  const now = Date.now();
  const recent = avg(pts.filter((p) => p.x >= now - 28 * DAY).map((p) => p.y));
  const before = avg(pts.filter((p) => p.x < now - 28 * DAY && p.x >= now - 56 * DAY).map((p) => p.y));
  return (
    <section className="panel">
      <h2>
        {props.title} <span>{recent != null ? props.fmt(recent) : '–'}</span>
      </h2>
      <LineChart
        label={props.title}
        series={[{ name: props.title, color: props.color, points: pts }]}
        fmtY={props.fmt}
        fmtAxis={props.axis}
        fmtX={(x) => fmtDate(new Date(x))}
        height={130}
        dots
        invert={props.invert}
      />
      <p className="note">
        Snitt senaste 28 dagarna: {recent != null ? props.fmt(recent) : 'inga pass'}. De 28 dagarna innan:{' '}
        {before != null ? props.fmt(before) : 'inga pass'}. {props.invert ? 'Snabbare är högre upp. ' : ''}Alla pass räknas, lugna som hårda,
        så jämför med vad passen var tänkta som.
      </p>
    </section>
  );
}

/* ───────────────────────── Vägen till Jönköping ───────────────────────── */

function currentPhase(season: Season | undefined) {
  if (!season) return null;
  const t = startOfDay(new Date()).getTime();
  return season.phases.find((p) => t >= parseLocal(p.start).getTime() && t <= parseLocal(p.end).getTime()) ?? null;
}

/** Fart i m/s på plan väg för en given effekt (enkel modell: luftmotstånd + rullmotstånd). */
function bikeSpeed(watts: number, massKg: number) {
  let lo = 1;
  let hi = 20;
  for (let i = 0; i < 40; i++) {
    const v = (lo + hi) / 2;
    const need = 0.5 * 1.225 * 0.32 * v ** 3 + 0.005 * massKg * 9.81 * v;
    if (need > watts * 0.975) hi = v;
    else lo = v;
  }
  return lo;
}

export function Goal({ feed }: { feed: Feed }) {
  const season = feed.settings.season;
  if (!season) return <p className="note">Säsongsplanen är inte inlagd i appen än.</p>;
  const today = startOfDay(new Date());
  const race = parseLocal(season.race.date);
  const days = Math.ceil((race.getTime() - today.getTime()) / DAY);
  const t0 = parseLocal(season.phases[0].start).getTime();
  const span = race.getTime() - t0;
  const pos = Math.max(0, Math.min(100, ((today.getTime() - t0) / span) * 100));
  const phase = currentPhase(season);
  const wk = isoWeek(today);
  const easy = season.easy_weeks.includes(wk.key);
  const thisWeek = weekly(feed.activities, 1)[0];
  const tests = season.tests
    .map((t) => ({ ...t, date: mondayOfIsoWeek(t.week) }))
    .filter((t) => t.date.getTime() + 7 * DAY > today.getTime())
    .slice(0, 4);

  // Prognos: bara räknad på sådant som finns i datan eller i planen.
  const cut = Date.now() - 42 * DAY;
  const swimPace = median(
    feed.activities
      .filter((a) => groupOf(a.sport) === 'sim' && a.swim_pace_min_per_100m && parseLocal(a.start_local).getTime() >= cut)
      .map((a) => a.swim_pace_min_per_100m!),
  );
  const swim = swimPace ? [swimPace * 19 * 60, swimPace * 19 * 60 * 1.1] : null;
  const mass = season.weight_kg + 10;
  const bike = [0.78, 0.68].map((f) => (season.race.bike_km * 1000) / (bikeSpeed(season.ftp_w * f, mass) * 0.92));
  const hm = season.half_marathon?.seconds;
  const run = hm ? [hm * 1.05, hm * 1.12] : null;
  const trans = [8 * 60, 10 * 60];
  const garminHm = fitnessSeries(feed.metrics).find((f) => f.race.hm)?.race.hm ?? null;
  const total = swim && run ? [swim[0] + bike[0] + run[0] + trans[0], swim[1] + bike[1] + run[1] + trans[1]] : null;
  const rng = (r: number[] | null) => (r ? `${fmtHm(r[0])} – ${fmtHm(r[1])}` : 'saknar data');

  return (
    <>
      <h1 className="page">Vägen till Jönköping</h1>
      <section className="panel hero">
        <strong>{days}</strong>
        <span>dagar kvar · {race.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <p className="note">
          {num(season.race.swim_km, 1)} km sim · {num(season.race.bike_km)} km cykel · {num(season.race.run_km, 1)} km löp
        </p>
      </section>

      <RecordsPanel feed={feed} />

      <section className="panel">
        <h2>
          Faser <span>vecka {wk.week}</span>
        </h2>
        <div className="timeline" role="img" aria-label={`Säsongens faser. Just nu: ${phase?.name ?? 'utanför planen'}`}>
          {season.phases.map((p) => (
            <i
              key={p.name}
              data-on={p === phase}
              style={{ flexGrow: parseLocal(p.end).getTime() - parseLocal(p.start).getTime() + DAY }}
            />
          ))}
          <b style={{ left: `${pos}%` }} />
        </div>
        <ol className="phases">
          {season.phases.map((p) => (
            <li key={p.name} data-on={p === phase} data-past={parseLocal(p.end).getTime() < today.getTime()}>
              <b>{p.name}</b>
              <span>
                {fmtDate(parseLocal(p.start))} – {fmtDate(parseLocal(p.end))} · {p.hours} h/v
              </span>
            </li>
          ))}
        </ol>
      </section>

      {phase && (
        <section className="panel">
          <h2>
            Nu: {phase.name} {easy && <span className="chip k-plan">Lätt vecka</span>}
          </h2>
          <p className="lead">{phase.focus}</p>
          <div className="bar">
            <label>Veckan</label>
            <div>
              <i style={{ width: `${Math.min(100, (thisWeek.total / upper(phase.hours)) * 100)}%`, background: 'var(--cyan)' }} />
            </div>
            <span>{num(thisWeek.total, 1)} h</span>
          </div>
          <p className="note">
            Riktmärke {phase.hours} h per vecka{easy ? ', cirka 30 % mindre den här lätta veckan' : ''}. Arbetsschemat går före.
          </p>
          <ul className="goals">
            {phase.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {tests.length > 0 && (
        <section className="panel">
          <h2>Kommande tester</h2>
          <ul className="tests">
            {tests.map((t) => (
              <li key={t.week + t.what}>
                <b>
                  v{Number(t.week.split('-W')[1])} · {fmtDate(t.date)}
                </b>
                <span>{t.what}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>
          Grov prognos <span>{total ? rng(total) : '–'}</span>
        </h2>
        <div className="tablewrap">
          <table>
            <tbody>
              <tr>
                <td>Sim {num(season.race.swim_km, 1)} km</td>
                <td>{rng(swim)}</td>
              </tr>
              <tr>
                <td>Cykel {num(season.race.bike_km)} km</td>
                <td>{rng(bike)}</td>
              </tr>
              <tr>
                <td>Löp {num(season.race.run_km, 1)} km</td>
                <td>{rng(run)}</td>
              </tr>
              <tr>
                <td>Växlingar</td>
                <td>8–10 min</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">
          Det här är en räknemodell med dagens form, inget mål. Sim: ditt mediantempo i bassäng senaste 6 veckorna
          {swimPace ? ` (${fmtPace(swimPace)}/100 m)` : ''}, upp till 10 % långsammare i öppet vatten. Cykel: 68–78 % av FTP {season.ftp_w} W,
          räknat på plan väg med 8 % avdrag för backar och kurvor. Banans riktiga profil är inte inräknad. Löp: din halvmara
          {hm ? ` (${fmtHms(hm)})` : ''} plus 5–12 % för att du springer efter cyklingen.
          {garminHm ? ` Garmins egen prognos för en fristående halvmara är ${fmtHms(garminHm)}.` : ''} Tävlingsmålet sätts efter testerna i mars.
        </p>
      </section>
    </>
  );
}

const upper = (hours: string) => {
  const n = hours.replace(/,/g, '.').match(/[\d.]+/g)?.map(Number) ?? [6];
  return Math.max(...n);
};
