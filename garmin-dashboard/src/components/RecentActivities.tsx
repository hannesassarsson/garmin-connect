import type { ActivitySummary } from '../types';

interface Props {
  activities: ActivitySummary[];
}

const typeEmoji: Record<string, string> = {
  running: '🏃',
  cycling: '🚴',
  strength: '🏋️',
  swimming: '🏊',
  walking: '🚶',
  hiking: '🥾',
};

export function RecentActivities({ activities }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold px-1">Senaste aktiviteter</h2>

      <div className="space-y-2">
        {activities.map((act) => (
          <div
            key={act.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-xl">
              {typeEmoji[act.type] || '⚡'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{act.name}</p>
              <p className="text-xs text-slate-500">
                {act.date} · {act.durationMinutes} min
                {act.distanceKm ? ` · ${act.distanceKm} km` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums">{act.calories}</p>
              <p className="text-[10px] text-slate-500">kcal</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
