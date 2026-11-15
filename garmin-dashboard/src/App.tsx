import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Unauthorized,
  clearKey,
  fetchFeed,
  fetchTrainingIcs,
  loadKey,
  markRead,
  saveKey,
  type Activity,
  type Feed,
  type Message,
} from './api';
import { buildPlan, isDone, parseIcs, type Ev } from './ics';
import { registerSw } from './push';
import { Reader } from './ui';
import { startOfDay } from './util';
import { DetailSheet, Goal, Hud, PlanView, Reports, Sessions, Trends, type PlanData } from './views';

type Tab = 'hud' | 'plan' | 'pass' | 'trend' | 'mal' | 'rapporter';

const TABS: [Tab, string][] = [
  ['hud', 'Läge'],
  ['plan', 'Plan'],
  ['pass', 'Pass'],
  ['trend', 'Trend'],
  ['mal', 'Mål'],
];

export default function App() {
  const [key, setKey] = useState<string | null>(() => loadKey());
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [tab, setTab] = useState<Tab>('hud');
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [booted, setBooted] = useState(false);
  const [training, setTraining] = useState<Ev[] | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const pending = useRef<number | null>(Number(new URLSearchParams(window.location.search).get('m')) || null);
  const hasFeed = useRef(false);

  const refresh = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    fetchTrainingIcs().then(
      (t) => {
        setTraining(parseIcs(t));
        setTrainingError(null);
      },
      () => setTrainingError('ingen kontakt med GitHub'),
    );
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
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), 30000);
    const vis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [refresh]);

  useEffect(() => {
    registerSw();
    const t = setTimeout(() => setBooted(true), 1500);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.open) {
        pending.current = Number(e.data.open);
        refresh();
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => {
      clearTimeout(t);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
  }, [refresh]);

  const openMessage = useCallback(
    (m: Message) => {
      setOpen(m.id);
      if (!m.read_at && key) {
        setFeed((f) =>
          f && { ...f, messages: f.messages.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x)) },
        );
        markRead(key, m.id).catch(() => undefined);
      }
    },
    [key],
  );

  // Öppna rapporten som en notis pekade på, så fort den finns i flödet.
  useEffect(() => {
    if (!feed || pending.current == null) return;
    const m = feed.messages.find((x) => x.id === pending.current);
    if (m) {
      pending.current = null;
      history.replaceState(null, '', window.location.pathname);
      openMessage(m);
    }
  }, [feed, openMessage]);

  const work = useMemo(() => (feed?.work?.ics ? parseIcs(feed.work.ics) : []), [feed?.work?.ics]);
  const plan: PlanData = useMemo(() => {
    const now = Date.now();
    return {
      days: buildPlan(training ?? [], work, startOfDay(new Date()), 14),
      next: (training ?? []).find((e) => e.end.getTime() > now && !isDone(e)) ?? null,
      trainingError: training ? null : trainingError,
      workFetched: feed?.work?.fetched_at ?? null,
    };
  }, [training, trainingError, work, feed?.work?.fetched_at]);

  if (!key) return <Lock error={error} onKey={(k) => (saveKey(k), setError(null), setKey(k))} />;

  const unread = feed?.messages.filter((m) => !m.read_at).length ?? 0;
  const current = feed?.messages.find((m) => m.id === open) ?? null;
  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  return (
    <div className="shell">
      {!booted && <Boot />}
      <header className="top">
        <div className="brand">
          <span className="dot" data-busy={loading} data-stale={stale} />
          COACH<span className="thin">·OS</span>
        </div>
        <Clock />
        <button className="ghost inbox" data-on={tab === 'rapporter'} onClick={() => go('rapporter')} aria-label={`Rapporter, ${unread} olästa`}>
          RAPPORTER
          {unread > 0 && <b className="count">{unread}</b>}
        </button>
      </header>

      <main>
        {error && <div className="alert">{error}</div>}
        {stale && <div className="alert quiet">Offline. Visar senast hämtade data.</div>}
        {!feed && !error && <div className="loading">Hämtar telemetri…</div>}
        {feed && tab === 'hud' && (
          <Hud feed={feed} plan={plan} accessKey={key} onOpen={openMessage} onReports={() => go('rapporter')} onPlan={() => go('plan')} />
        )}
        {feed && tab === 'plan' && <PlanView plan={plan} />}
        {feed && tab === 'pass' && <Sessions feed={feed} onDetail={setDetail} />}
        {feed && tab === 'trend' && <Trends feed={feed} />}
        {feed && tab === 'mal' && <Goal feed={feed} />}
        {feed && tab === 'rapporter' && <Reports messages={feed.messages} onOpen={openMessage} />}
      </main>

      <nav className="nav">
        {TABS.map(([id, label]) => (
          <button key={id} data-on={tab === id} onClick={() => go(id)}>
            {label}
          </button>
        ))}
      </nav>

      {detail && feed && (
        <DetailSheet
          activity={detail}
          accessKey={key}
          message={feed.messages.find((m) => m.activity_id === detail.activity_id)}
          onOpen={openMessage}
          onClose={() => setDetail(null)}
        />
      )}
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
  return <span className="clock">{now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>;
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
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Åtkomstnyckel" autoComplete="off" aria-label="Åtkomstnyckel" />
        <button type="submit">Lås upp</button>
      </form>
    </div>
  );
}
