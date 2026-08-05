import type { AIRecommendation as AIRec } from '../types';

interface Props {
  recommendations: AIRec[];
}

const priorityStyles = {
  high: 'border-rose-500/40 bg-rose-500/10',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-slate-700 bg-slate-900/40',
};

const typeIcons: Record<string, string> = {
  recovery: '🔋',
  training: '🏃',
  sleep: '🌙',
  general: '💡',
};

export function AIRecommendation({ recommendations }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold px-1">AI-rekommendationer</h2>

      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className={`rounded-2xl border p-4 ${priorityStyles[rec.priority]}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">
              {typeIcons[rec.type] || '💡'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm">{rec.title}</h3>
                {rec.priority === 'high' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                    Viktigt
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {rec.text}
              </p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
