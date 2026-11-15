import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Kind, Message } from './api';
import { canSpeak, speak, stopSpeaking } from './speech';
import { fmtWhen } from './util';

export const KIND: Record<Kind, string> = {
  pass: 'Passanalys',
  morgon: 'Morgonkoll',
  kvall: 'Kvällskoll',
  plan: 'Plan',
  vecka: 'Veckorapport',
  info: 'System',
};

export const LEVEL: Record<string, string> = {
  PRIME: 'Topp',
  HIGH: 'Hög',
  MODERATE: 'Måttlig',
  LOW: 'Låg',
  POOR: 'Dålig',
};

export const HRV: Record<string, string> = {
  BALANCED: 'Balanserad',
  UNBALANCED: 'Obalanserad',
  LOW: 'Låg',
  POOR: 'Dålig',
  NONE: 'Ingen status',
};

export function Typed({ text }: { text: string }) {
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

export function Core({ value, level }: { value: number | null; level: string | null }) {
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
        <circle className="arc" cx="120" cy="120" r={r} strokeDasharray={`${(pct / 100) * c} ${c}`} />
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

export function Spark({ values, color = 'var(--cyan)' }: { values: (number | null)[]; color?: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return <div className="spark-empty">För lite data</div>;
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const xy = pts.map(([i, v]) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`);
  const last = xy[xy.length - 1].split(',');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.join(' ')} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={color} />
    </svg>
  );
}

export function Tile(props: { label: string; value: string; unit?: string; note?: string; children?: React.ReactNode }) {
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

export function Card({ m, onOpen }: { m: Message; onOpen: (m: Message) => void }) {
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

/** Helskärmspanel som glider upp över appen. */
export function Sheet(props: { label: string; onClose: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onClose } = props;
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={props.label} ref={ref} tabIndex={-1}>
      <header>
        <button className="ghost" onClick={onClose}>
          ← Tillbaka
        </button>
        {props.right}
      </header>
      <div className="reader-body">{props.children}</div>
    </div>
  );
}

export function SpeakButton({ text, label = 'Läs upp' }: { text: string; label?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!canSpeak()) return null;
  return (
    <button
      className="ghost"
      aria-pressed={on}
      onClick={() => {
        if (on) {
          stopSpeaking();
          setOn(false);
        } else {
          setOn(true);
          speak(text, () => setOn(false));
        }
      }}
    >
      {on ? '■ Stopp' : `▶ ${label}`}
    </button>
  );
}

export function Reader({ message, onClose }: { message: Message; onClose: () => void }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(message.body_md, { async: false, gfm: true, breaks: true })),
    [message.body_md],
  );
  const metrics = message.metrics ? Object.entries(message.metrics) : [];
  return (
    <Sheet
      label={message.title}
      onClose={onClose}
      right={<SpeakButton text={`${message.title}. ${message.body_md}`} />}
    >
      <div className="meta">
        <span className={`chip k-${message.kind}`}>{KIND[message.kind] ?? message.kind}</span>
        <time>{fmtWhen(new Date(message.created_at))}</time>
      </div>
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
    </Sheet>
  );
}

export interface Series {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

/**
 * Linjediagram med en gemensam y-axel, förklaring och ett hårkors som följer fingret.
 * invert = lägre värden ritas högre upp (används för tempo, där lägre är snabbare).
 */
export function LineChart(props: {
  series: Series[];
  fmtY: (v: number) => string;
  /** Kort format för axeln (utan enhet). Standard: samma som fmtY. */
  fmtAxis?: (v: number) => string;
  fmtX: (x: number) => string;
  height?: number;
  dots?: boolean;
  invert?: boolean;
  label: string;
}) {
  const { series, fmtY, fmtX, height = 150, dots, invert, label } = props;
  const fmtAxis = props.fmtAxis ?? fmtY;
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <div className="spark-empty">För lite data för ett diagram</div>;
  const W = 320;
  const H = height;
  const pad = { l: 36, r: 8, t: 8, b: 18 };
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x));
  let y0 = Math.min(...all.map((p) => p.y));
  let y1 = Math.max(...all.map((p) => p.y));
  const m = (y1 - y0 || 1) * 0.1;
  y0 -= m;
  y1 += m;
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => {
    const t = (y - y0) / (y1 - y0);
    return pad.t + (invert ? t : 1 - t) * (H - pad.t - pad.b);
  };
  const ticks = [0, 0.5, 1].map((t) => y0 + m + t * (y1 - y0 - 2 * m));
  const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = xs[0];
    for (const x of xs) if (Math.abs(sx(x) - px) < Math.abs(sx(best) - px)) best = x;
    setHover(best);
  };
  const tip = hover == null ? null : series.map((s) => ({ s, p: s.points.find((p) => p.x === hover) })).filter((t) => t.p);
  return (
    <figure className="chart">
      {series.length > 1 && (
        <figcaption className="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="gridline" x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} />
            <text className="axis" x={pad.l - 5} y={sy(t) + 3} textAnchor="end">
              {fmtAxis(t)}
            </text>
          </g>
        ))}
        <text className="axis" x={pad.l} y={H - 4}>
          {fmtX(x0)}
        </text>
        <text className="axis" x={W - pad.r} y={H - 4} textAnchor="end">
          {fmtX(x1)}
        </text>
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              opacity={dots ? 0.45 : 1}
            />
            {dots && s.points.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={s.color} stroke="var(--surface)" strokeWidth="1" />)}
          </g>
        ))}
        {hover != null && <line className="cross" x1={sx(hover)} x2={sx(hover)} y1={pad.t} y2={H - pad.b} />}
        {tip?.map(({ s, p }) => (
          <circle key={s.name} cx={sx(p!.x)} cy={sy(p!.y)} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
        ))}
      </svg>
      <div className="tip" aria-live="polite">
        {tip && tip.length > 0 ? (
          <>
            <b>{fmtX(hover!)}</b>
            {tip.map(({ s, p }) => (
              <span key={s.name}>
                <i style={{ background: s.color }} />
                {series.length > 1 ? `${s.name} ` : ''}
                {fmtY(p!.y)}
              </span>
            ))}
          </>
        ) : (
          <span className="dim">Dra över diagrammet för värden</span>
        )}
      </div>
    </figure>
  );
}
