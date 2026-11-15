import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  Unauthorized,
  clearKey,
  fetchFeed,
  loadKey,
  markRead,
  saveKey,
  type Activity,
  type Feed,
  type Health,
  type Kind,
  type Message,
} from './api';
import {
  GROUPS,
  RACE,
  activityHeadline,
  dayLabel,
  fmtDur,
  fmtWhen,
  greeting,
  groupOf,
  latest,
  mondayOf,
  num,
  parseLocal,
  startOfDay,
  type Group,
} from './util';

type Tab = 'hud' | 'rapporter' | 'pass';

const KIND: Record<Kind, string> = {
  pass: 'Passanalys',
  morgon: 'Morgonkoll',
  kvall: 'Kvällskoll',
  plan: 'Plan',
  vecka: 'Veckorapport',
  info: 'System',
};

const LEVEL: Record<string, string> = {
  PRIME: 'Topp',
  HIGH: 'Hög',
  MODERATE: 'Måttlig',
  LOW: 'Låg',
  POOR: 'Dålig',
};

const HRV: Record<string, string> = {
  BALANCED: 'Balanserad',
  UNBALANCED: 'Obalanserad',
  LOW: 'Låg',
  POOR: 'Dålig',
  NONE: 'Ingen status',
};

export default function App() {
  const [key, setKey] = useState<string | null>(() => loadKey());
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('hud');
  const [open, setOpen] = useState<number | null>(null);
  const [booted, setBooted] = useState(false);
  const [stale, setStale] = useState(false);

  const hasFeed = useRef(false);
  const refresh = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      // iOS avbryter ofta första anropet när appen vaknar ur bakgrunden: försök igen tyst.
      for (let attempt = 0; ; attempt++) {
        try {
          setFeed(await fetchFeed(key));
          hasFeed.current = true;
          setError(null);
          setStale(false);
          return;
        } catch (e) {
          if (e instanceof Unauthorized) {
            clearKey();
            setKey(null);
            setFeed(null);
            hasFeed.current = false;
            setError('Åtkomstnyckeln godkändes inte.');
            return;
          }
          if (attempt >= 2) {
            // Finns data redan på skärmen: visa bara en diskret markering.
            if (hasFeed.current) setStale(true);
            else setError('Ingen kontakt med databasen just nu. Försöker igen.');
            return;
          }
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), hasFeed.current ? 60000 : 8000);
    const vis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const openMessage = useCallback(
    (m: Message) => {
      setOpen(m.id);
      if (!m.read_at && key) {
        setFeed((f) =>
          f && {
            ...f,
            messages: f.messages.map((x) =>
              x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x,
            ),
          },
        );
        markRead(key, m.id).catch(() => undefined);
      }
    },
    [key],
  );

  if (!key) return <Lock error={error} onKey={(k) => (saveKey(k), setError(null), setKey(k))} />;

  const unread = feed?.messages.filter((m) => !m.read_at).length ?? 0;
  const current = feed?.messages.find((m) => m.id === open) ?? null;

  return (
    <div className="shell">
      {!booted && <Boot />}
      <header className="top">
        <div className="brand">
          <span className="dot" data-busy={loading} />
          COACH<span className="thin">·OS</span>
        </div>
        <Clock />
        <button className="ghost" onClick={refresh} disabled={loading} aria-label="Uppdatera">
          {loading ? 'SYNK…' : stale ? 'OFFLINE' : 'SYNK'}
        </button>
      </header>

      <main>
        {error && <div className="alert">{error}</div>}
        {!feed && !error && <div className="loading">Hämtar telemetri…</div>}
        {feed && tab === 'hud' && (
          <Hud feed={feed} onOpen={openMessage} onAll={() => setTab('rapporter')} />
        )}
        {feed && tab === 'rapporter' && <Reports messages={feed.messages} onOpen={openMessage} />}
        {feed && tab === 'pass' && <Sessions feed={feed} onOpen={openMessage} />}
      </main>

      <nav className="nav">
        {(
          [
            ['hud', 'Läge'],
            ['rapporter', 'Rapporter'],
            ['pass', 'Pass'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} data-on={tab === id} onClick={() => setTab(id)}>
            {label}
            {id === 'rapporter' && unread > 0 && <b className="badge">{unread}</b>}
          </button>
        ))}
      </nav>

      {current && <Reader message={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Boot() {
  return (
    <div className="boot" aria-hidden="true">
      <div className="boot-ring" />
      <p>INITIERAR SYSTEM</p>
      <p>ANSLUTER TELEMETRI</p>
      <p>COACH ONLINE</p>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="clock">
      {now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

function Lock({ error, onKey }: { error: string | null; onKey: (k: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="lock">
      <div className="boot-ring" />
      <h1>
        COACH<span className="thin">·OS</span>
      </h1>
      <p>Åtkomst låst. Öppna din personliga länk, eller klistra in åtkomstnyckeln.</p>
      {error && <div className="alert">{error}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const k = v.trim().replace(/^.*k=/, '');
          if (k.length >= 20) onKey(k);
        }}
      >
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Åtkomstnyckel"
          autoComplete="off"
          aria-label="Åtkomstnyckel"
        />
        <button type="submit">Lås upp</button>
      </form>
    </div>
  );
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length);
      return;
    }
    const t = setInterval(() => setN((x) => (x >= text.length ? x : x + 2)), 28);
    return () => clearInterval(t);
  }, [text]);
  return (
    <p className="typed" aria-label={text}>
      {text.slice(0, n)}
      <i className="caret" />
    </p>
  );
}

function Core({ value, level }: { value: number | null; level: string | null }) {
  const r = 84;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const tone = value == null ? 'dim' : pct >= 60 ? 'ok' : pct >= 40 ? 'warn' : 'low';
  return (
    <div className="core" data-tone={tone}>
      <svg viewBox="0 0 240 240" role="img" aria-label={`Träningsberedskap ${value ?? 'saknas'}`}>
        <circle className="spin slow" cx="120" cy="120" r="112" strokeDasharray="2 12" />
        <circle className="spin rev" cx="120" cy="120" r="100" strokeDasharray="70 26" />
        <circle className="track" cx="120" cy="120" r={r} />
        <circle
          className="arc"
          cx="120"
          cy="120"
          r={r}
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
        <circle className="spin" cx="120" cy="120" r="66" strokeDasharray="18 10" />
      </svg>
      <div className="core-val">
        <strong>{value ?? '–'}</strong>
        <span>BEREDSKAP</span>
        <em>{level ? (LEVEL[level] ?? level) : 'Ingen data'}</em>
      </div>
    </div>
  );
}

function Spark({ values, color = 'var(--cyan)' }: { values: (number | null)[]; color?: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return <div className="spark-empty">För lite data</div>;
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const xy = pts.map(
    ([i, v]) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`,
  );
  const last = xy[xy.length - 1].split(',');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.join(' ')} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={color} />
    </svg>
  );
}

function Tile(props: { label: string; value: string; unit?: string; note?: string; children?: React.ReactNode }) {
  return (
    <section className="tile">
      <h3>{props.label}</h3>
      <div className="big">
        {props.value}
        {props.unit && <small>{props.unit}</small>}
      </div>
      {props.children}
      {props.note && <p className="note">{props.note}</p>}
    </section>
  );
}

function Hud({ feed, onOpen, onAll }: { feed: Feed; onOpen: (m: Message) => void; onAll: () => void }) {
  const h = feed.health;
  const ready = latest(h, 'training_readiness');
  const sleep = latest(h, 'sleep_score');
  const hrv = latest(h, 'hrv_last_night');
  const rhr = latest(h, 'resting_hr');
  const bb = latest(h, 'body_battery_high');
  const days = Math.ceil((RACE.getTime() - startOfDay(new Date()).getTime()) / 86400000);
  const series = (k: keyof Health) => [...h].reverse().slice(-14).map((r) => r[k] as number | null);
  const newest = feed.messages[0];
  const week = useWeek(feed.activities);

  const line = `${greeting()}, Hannes. Alla system online. ${days} dagar till Jönköping.`;

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
      {ready && <p className="asof">Beredskap mätt {dayLabel(ready.row.day)}</p>}

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

      <section className="panel">
        <h2>
          Veckans belastning <span>{fmtDur(week.total)}</span>
        </h2>
        {(['sim', 'cykel', 'lop', 'styrka'] as Group[]).map((g) => (
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
          <button className="link" onClick={onAll}>
            Alla
          </button>
        </h2>
        {newest ? <Card m={newest} onOpen={onOpen} /> : <p className="note">Inga rapporter än. Nästa analys landar här.</p>}
      </section>
    </>
  );
}

function useWeek(acts: Activity[]) {
  return useMemo(() => {
    const mon = mondayOf(new Date()).getTime();
    const prevMon = mon - 7 * 86400000;
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

function Card({ m, onOpen }: { m: Message; onOpen: (m: Message) => void }) {
  const preview = m.body_md.replace(/[#*_>`|-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return (
    <button className="card" data-unread={!m.read_at} onClick={() => onOpen(m)}>
      <div className="meta">
        <span className={`chip k-${m.kind}`}>{KIND[m.kind] ?? m.kind}</span>
        <time>{fmtWhen(new Date(m.created_at))}</time>
      </div>
      <h4>{m.title}</h4>
      <p>{preview}…</p>
    </button>
  );
}

function Reports({ messages, onOpen }: { messages: Message[]; onOpen: (m: Message) => void }) {
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

function Sessions({ feed, onOpen }: { feed: Feed; onOpen: (m: Message) => void }) {
  const byAct = useMemo(() => {
    const map = new Map<number, Message>();
    for (const m of feed.messages) if (m.activity_id && !map.has(m.activity_id)) map.set(m.activity_id, m);
    return map;
  }, [feed.messages]);
  return (
    <>
      <h1 className="page">Pass · 8 veckor</h1>
      {feed.activities.length === 0 && <p className="note">Inga pass i perioden.</p>}
      <div className="stack">
        {feed.activities.map((a) => {
          const g = groupOf(a.sport);
          const msg = byAct.get(a.activity_id);
          const z = [a.hr_zone1_s, a.hr_zone2_s, a.hr_zone3_s, a.hr_zone4_s, a.hr_zone5_s].map((x) => x ?? 0);
          const zt = z.reduce((s, x) => s + x, 0);
          return (
            <article className="act" key={a.activity_id} style={{ ['--g' as string]: GROUPS[g].color }}>
              <div className="meta">
                <span className="chip sport">{GROUPS[g].label}</span>
                <time>{fmtWhen(parseLocal(a.start_local))}</time>
              </div>
              <h4>{a.name || GROUPS[g].label}</h4>
              <p className="mono">{activityHeadline(a)}</p>
              {zt > 0 && (
                <div className="zones" title="Tid i pulszon 1–5" aria-label="Fördelning pulszoner">
                  {z.map((x, i) => (
                    <i key={i} className={`z${i + 1}`} style={{ width: `${(x / zt) * 100}%` }} />
                  ))}
                </div>
              )}
              <div className="foot">
                <span>Belastning {num(a.training_load)}</span>
                {msg ? (
                  <button className="link" onClick={() => onOpen(msg)}>
                    Läs analys
                  </button>
                ) : (
                  <span className="dim">Ingen analys än</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function Reader({ message, onClose }: { message: Message; onClose: () => void }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(message.body_md, { async: false, gfm: true, breaks: true })),
    [message.body_md],
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const metrics = message.metrics ? Object.entries(message.metrics) : [];
  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={message.title} ref={ref} tabIndex={-1}>
      <header>
        <button className="ghost" onClick={onClose}>
          ← Tillbaka
        </button>
        <span className={`chip k-${message.kind}`}>{KIND[message.kind] ?? message.kind}</span>
      </header>
      <div className="reader-body">
        <time>{fmtWhen(new Date(message.created_at))}</time>
        <h1>{message.title}</h1>
        {metrics.length > 0 && (
          <dl className="metrics">
            {metrics.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
