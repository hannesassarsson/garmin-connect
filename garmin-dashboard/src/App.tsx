import { useState } from 'react';
import { TodayStatus } from './components/TodayStatus';
import { SleepCard } from './components/SleepCard';
import { RecoveryCard } from './components/RecoveryCard';
import { AIRecommendation } from './components/AIRecommendation';
import { RecentActivities } from './components/RecentActivities';
import { BottomNav } from './components/BottomNav';
import { mockDashboardData } from './data/mockData';

type Tab = 'today' | 'sleep' | 'activities' | 'more';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const data = mockDashboardData;

  const lastSyncTime = new Date(data.lastSync).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Garmin Dashboard</h1>
            <p className="text-[11px] text-slate-500">
              Forerunner 265 · Synkad {lastSyncTime}
            </p>
          </div>
          <button
            className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 active:scale-95 transition"
            onClick={() => alert('Här kommer den riktiga Garmin-synken senare 🚀')}
          >
            Uppdatera
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {activeTab === 'today' && (
          <>
            <TodayStatus status={data.status} recovery={data.recovery} />
            <AIRecommendation recommendations={data.recommendations} />
            <RecentActivities activities={data.recentActivities.slice(0, 2)} />
          </>
        )}

        {activeTab === 'sleep' && (
          <>
            <SleepCard sleep={data.sleep} />
            <RecoveryCard recovery={data.recovery} />
            <AIRecommendation
              recommendations={data.recommendations.filter(
                (r) => r.type === 'sleep' || r.type === 'recovery'
              )}
            />
          </>
        )}

        {activeTab === 'activities' && (
          <>
            <RecentActivities activities={data.recentActivities} />
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-center text-slate-400 text-sm">
              Detaljerade aktivitetsvyer + kartor kommer i nästa version.
            </div>
          </>
        )}

        {activeTab === 'more' && (
          <div className="space-y-4">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-lg font-semibold mb-3">Inställningar</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span>Garmin-konto</span>
                  <span className="text-slate-500">Ej kopplat ännu</span>
                </li>
                <li className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span>Automatisk synk</span>
                  <span className="text-emerald-400">Vid öppning</span>
                </li>
                <li className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span>Tema</span>
                  <span className="text-slate-500">Mörkt</span>
                </li>
                <li className="flex justify-between items-center py-2">
                  <span>Version</span>
                  <span className="text-slate-500">0.1.0 (MVP)</span>
                </li>
              </ul>
            </section>

            <p className="text-center text-xs text-slate-600 px-4">
              Nästa steg: koppla inofficiell Garmin-login + riktig AI-analys.
            </p>
          </div>
        )}
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

export default App;
