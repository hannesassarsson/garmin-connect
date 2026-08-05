import type { SleepData } from '../types';

interface Props {
  sleep: SleepData;
}

const qualityLabels = {
  excellent: { text: 'Utmärkt', color: 'text-emerald-400' },
  good: { text: 'Bra', color: 'text-sky-400' },
  fair: { text: 'Okej', color: 'text-amber-400' },
  poor: { text: 'Dålig', color: 'text-rose-400' },
};

export function SleepCard({ sleep }: Props) {
  const quality = qualityLabels[sleep.quality];
  const totalMinutes = sleep.deepMinutes + sleep.lightMinutes + sleep.remMinutes + sleep.awakeMinutes;

  const stages = [
    { label: 'Djup', minutes: sleep.deepMinutes, color: 'bg-indigo-500', pct: (sleep.deepMinutes / totalMinutes) * 100 },
    { label: 'REM', minutes: sleep.remMinutes, color: 'bg-violet-500', pct: (sleep.remMinutes / totalMinutes) * 100 },
    { label: 'Lätt', minutes: sleep.lightMinutes, color: 'bg-sky-500', pct: (sleep.lightMinutes / totalMinutes) * 100 },
    { label: 'Vaken', minutes: sleep.awakeMinutes, color: 'bg-slate-600', pct: (sleep.awakeMinutes / totalMinutes) * 100 },
  ];

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Sömn</h2>
        <span className={`text-sm font-medium ${quality.color}`}>{quality.text}</span>
      </div>

      <div className="flex items-end gap-3 mb-5">
        <div>
          <p className="text-4xl font-bold tabular-nums tracking-tight">{sleep.score}</p>
          <p className="text-xs text-slate-500">Sömnpoäng</p>
        </div>
        <div className="pb-1">
          <p className="text-xl font-semibold tabular-nums">{sleep.totalHours.toFixed(1)} h</p>
          <p className="text-xs text-slate-500">Total sömn</p>
        </div>
      </div>

      {/* Sleep stages bar */}
      <div className="h-3 rounded-full overflow-hidden flex mb-3">
        {stages.map((s) => (
          <div
            key={s.label}
            className={`${s.color} h-full`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.minutes} min`}
          />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {stages.map((s) => (
          <div key={s.label}>
            <div className={`w-2 h-2 rounded-full ${s.color} mx-auto mb-1`} />
            <p className="text-[11px] text-slate-400">{s.label}</p>
            <p className="text-xs font-medium tabular-nums">{s.minutes}m</p>
          </div>
        ))}
      </div>
    </section>
  );
}
