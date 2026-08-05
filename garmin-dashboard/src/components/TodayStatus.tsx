import type { DailyStatus, RecoveryData } from '../types';

interface Props {
  status: DailyStatus;
  recovery: RecoveryData;
}

const statusConfig = {
  great: {
    label: 'Toppform',
    color: 'from-emerald-500 to-green-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    emoji: '🔥',
  },
  good: {
    label: 'Bra',
    color: 'from-sky-500 to-cyan-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
    emoji: '👍',
  },
  tired: {
    label: 'Trött',
    color: 'from-amber-500 to-orange-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    emoji: '😮‍💨',
  },
  needs_rest: {
    label: 'Behöver vila',
    color: 'from-rose-500 to-red-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    emoji: '😴',
  },
};

export function TodayStatus({ status, recovery }: Props) {
  const config = statusConfig[status.overall];

  return (
    <section className={`rounded-3xl border p-5 ${config.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400 mb-1">Hur mår jag idag?</p>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <span>{config.emoji}</span>
            <span className={`bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
              {config.label}
            </span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Body Battery</p>
          <p className="text-3xl font-bold tabular-nums">{recovery.bodyBattery}</p>
        </div>
      </div>

      <p className="mt-4 text-slate-300 text-sm leading-relaxed">
        {status.message}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-500">HRV</p>
          <p className="text-lg font-semibold tabular-nums">{recovery.hrv}</p>
          <p className="text-[10px] text-slate-500 capitalize">{recovery.hrvStatus}</p>
        </div>
        <div className="rounded-2xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-500">Stress</p>
          <p className="text-lg font-semibold tabular-nums">{recovery.stress}</p>
          <p className="text-[10px] text-slate-500">av 100</p>
        </div>
        <div className="rounded-2xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-500">Vilopuls</p>
          <p className="text-lg font-semibold tabular-nums">{recovery.restingHR}</p>
          <p className="text-[10px] text-slate-500">bpm</p>
        </div>
      </div>
    </section>
  );
}
