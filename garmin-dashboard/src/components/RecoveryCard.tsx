import type { RecoveryData } from '../types';

interface Props {
  recovery: RecoveryData;
}

export function RecoveryCard({ recovery }: Props) {
  const batteryColor =
    recovery.bodyBattery >= 75
      ? 'text-emerald-400'
      : recovery.bodyBattery >= 50
      ? 'text-sky-400'
      : recovery.bodyBattery >= 30
      ? 'text-amber-400'
      : 'text-rose-400';

  const trendArrow =
    recovery.bodyBatteryTrend === 'up'
      ? '↑'
      : recovery.bodyBatteryTrend === 'down'
      ? '↓'
      : '→';

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-lg font-semibold mb-4">Återhämtning</h2>

      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-800"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={batteryColor}
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${recovery.bodyBattery}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold tabular-nums ${batteryColor}`}>
              {recovery.bodyBattery}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-400">Body Battery</p>
          <p className="text-sm font-medium">
            Trend: <span className="text-slate-200">{trendArrow} {recovery.bodyBatteryTrend === 'up' ? 'Stigande' : recovery.bodyBatteryTrend === 'down' ? 'Sjunkande' : 'Stabil'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-950/60 p-3">
          <p className="text-xs text-slate-500 mb-1">HRV-status</p>
          <p className="font-medium capitalize">{recovery.hrvStatus}</p>
          <p className="text-sm text-slate-400 tabular-nums">{recovery.hrv} ms</p>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-3">
          <p className="text-xs text-slate-500 mb-1">Stressnivå</p>
          <p className="font-medium">{recovery.stress < 25 ? 'Låg' : recovery.stress < 50 ? 'Medel' : 'Hög'}</p>
          <p className="text-sm text-slate-400 tabular-nums">{recovery.stress}/100</p>
        </div>
      </div>
    </section>
  );
}
