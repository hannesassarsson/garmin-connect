interface Props {
  active: 'today' | 'sleep' | 'activities' | 'more';
  onChange: (tab: 'today' | 'sleep' | 'activities' | 'more') => void;
}

const tabs = [
  { id: 'today' as const, label: 'Idag', icon: '🏠' },
  { id: 'sleep' as const, label: 'Sömn', icon: '🌙' },
  { id: 'activities' as const, label: 'Aktivitet', icon: '🏃' },
  { id: 'more' as const, label: 'Mer', icon: '⋯' },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur-lg pb-safe">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-3">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 min-w-[64px] py-1.5 rounded-xl transition-colors ${
                isActive ? 'text-sky-400' : 'text-slate-500'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
