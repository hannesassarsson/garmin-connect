import { useState, useEffect, useCallback } from 'react';
import { TodayStatus } from './components/TodayStatus';
import { SleepCard } from './components/SleepCard';
import { RecoveryCard } from './components/RecoveryCard';
import { AIRecommendation } from './components/AIRecommendation';
import { RecentActivities } from './components/RecentActivities';
import { BottomNav } from './components/BottomNav';
import { mockDashboardData } from './data/mockData';
import type { DashboardData } from './types';

type Tab = 'today' | 'sleep' | 'activities' | 'more';

const STORAGE_KEY = 'garmin_credentials';

interface StoredCreds {
  email: string;
  password: string;
  displayName?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [data, setData] = useState<DashboardData>(mockDashboardData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<StoredCreds | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredCreds;
        if (parsed.email && parsed.password) {
          setCreds(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchData = useCallback(async (c: StoredCreds) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/garmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'data',
          email: c.email,
          password: c.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      if (json.ok && json.status) {
        setData({
          status: json.status,
          recovery: json.recovery,
          sleep: json.sleep,
          recommendations: json.recommendations || [],
          recentActivities: json.recentActivities || [],
          lastSync: json.lastSync || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      setError(e.message || 'Kunde inte hämta data från Garmin');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (creds) {
      fetchData(creds);
    }
  }, [creds, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoginLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/garmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Inloggning misslyckades');
      }
      const newCreds: StoredCreds = {
        email: loginEmail.trim(),
        password: loginPassword,
        displayName: json.display_name,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCreds));
      setCreds(newCreds);
      setLoginPassword('');
      setActiveTab('today');
    } catch (e: any) {
      setError(e.message || 'Inloggning misslyckades');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCreds(null);
    setData(mockDashboardData);
    setError(null);
  };

  const lastSyncTime = new Date(data.lastSync).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Garmin Dashboard</h1>
            <p className="text-[11px] text-slate-500">
              Forerunner 265 · {creds ? `Synkad ${lastSyncTime}` : 'Ej inloggad'}
              {loading && ' · Hämtar…'}
            </p>
          </div>
          <button
            className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 active:scale-95 transition disabled:opacity-50"
            onClick={() => creds && fetchData(creds)}
            disabled={!creds || loading}
          >
            {loading ? 'Hämtar…' : 'Uppdatera'}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {activeTab === 'today' && (
          <>
            {!creds && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5 text-center">
                <p className="text-slate-300 mb-3">Koppla ditt Garmin-konto för att se riktig data.</p>
                <button
                  onClick={() => setActiveTab('more')}
                  className="text-sm px-4 py-2 rounded-full bg-sky-600 text-white"
                >
                  Gå till inloggning
                </button>
              </div>
            )}
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
              <h2 className="text-lg font-semibold mb-4">Garmin-konto</h2>

              {creds ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    Inloggad som <span className="font-medium text-white">{creds.displayName || creds.email}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Inloggningen sparas lokalt på den här enheten. Du behöver bara logga in en gång.
                  </p>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2.5 rounded-xl border border-slate-700 text-sm text-slate-300 active:scale-[0.98]"
                  >
                    Logga ut
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Garmin e-post</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
                      placeholder="din@email.com"
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Lösenord</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium disabled:opacity-50 active:scale-[0.98]"
                  >
                    {loginLoading ? 'Loggar in…' : 'Logga in med Garmin'}
                  </button>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Inloggningen sker mot Garmin Connect via inofficiell metod.
                    Uppgifterna sparas bara lokalt i din webbläsare.
                  </p>
                </form>
              )}
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-lg font-semibold mb-3">Inställningar</h2>
              <ul className="space-y-3 text-sm text-slate-300">
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
                  <span className="text-slate-500">0.2.0</span>
                </li>
              </ul>
            </section>
          </div>
        )}
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

export default App;
