import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  TrendingUp,
  Target,
  Moon,
  Sun,
  Lock,
  Landmark,
  Settings as SettingsIcon,
  ShieldCheck,
  ListOrdered,
  ReceiptText,
  Menu,
  X,
  BarChart3,
  FileUp,
  Cloud,
  Briefcase,
  Bot,
} from 'lucide-react';
import { useSyncStore } from '../hooks/useFirebaseSync';
import ErrorBoundary from './ErrorBoundary';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import { useFinanceStore } from '../store/useFinanceStore';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import Login from '../views/Login';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'cash', label: 'Cash Control', icon: Wallet },
  { id: 'variable', label: 'Costi Variabili', icon: ListOrdered },
  { id: 'fixed', label: 'Costi Fissi', icon: ReceiptText },
  { id: 'budget', label: 'Budget vs Actual', icon: PieChart },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
  { id: 'historical', label: 'Storico', icon: BarChart3 },
  { id: 'accounts', label: 'Conti & Patrimonio', icon: Landmark },
  { id: 'admin', label: 'Admin / Setup', icon: ShieldCheck },
  { id: 'pension', label: 'Previdenza', icon: Briefcase },
  { id: 'advisor', label: 'AI Advisor', icon: Bot },
  { id: 'import', label: 'Import Banca', icon: FileUp },
  { id: 'period-close', label: 'Chiudi Ciclo', icon: Lock },
  { id: 'goals', label: 'Obiettivi', icon: Target },
  { id: 'settings', label: 'Impostazioni', icon: SettingsIcon },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = location.pathname.replace('/', '') || 'overview';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const computed = useOverviewMetrics();
  const data = useFinanceStore(useShallow(state => state.data || {}));
  const updateSettings = useFinanceStore(state => state.updateSettings);
  const resetToEmpty = useFinanceStore(state => state.resetToEmpty);
  const resetToDemo = useFinanceStore(state => state.resetToDemo);
  const syncStatus = useSyncStore(state => state.syncStatus);
  const theme = data?.settings?.theme || 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });

  const pendingFixed = (computed.plannedPeriodTx || []).filter(t => t.nature === 'fixed').length;

  // ─── LOGICA VISIBILITÀ TAB STORICO ──────────────────────────────────
  // Storico: visibile solo se c'è almeno 1 ciclo chiuso (minimo per vista "Mese")
  const closedPeriodsCount = (data?.periods || []).filter(p => p.status === 'closed').length;
  const showHistorical = closedPeriodsCount >= 1;

  return (
    <div className="app-container">

      {/* FIX 3.12: overlay mobile per chiudere sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'none' }}
          className="sidebar-overlay"
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={24} color="var(--text-primary)" />
          <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Private CFO</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navItems
            .filter(item => {
              // Nascondi "Storico" se non ci sono cicli chiusi
              if (item.id === 'historical' && !showHistorical) return false;
              return true;
            })
            .map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            // Badge: mostra il numero di costi fissi pending sulla voce "Costi Fissi"
            const showBadge = item.id === 'fixed' && pendingFixed > 0;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => { navigate(item.id === 'overview' ? '/' : `/${item.id}`); setSidebarOpen(false); }}
                style={{ position: 'relative' }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {showBadge && (
                  <span style={{
                    marginLeft: 'auto',
                    minWidth: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--bg-secondary)' : 'var(--status-red)',
                    color: isActive ? 'var(--status-red)' : 'white',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {pendingFixed}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <div className="kpi-sub mb-2">Workspace Attivo</div>
          <div className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-primary)', fontWeight: 800, fontSize: '0.85rem' }}>
              G
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Giovanni</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main className="main-content">
        <header className="header">
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {navItems.find(n => n.id === activeView)?.label}
            </div>
            {computed.activePeriod && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px', background: 'var(--bg-tertiary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ciclo Fiscale:</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                  {format(parseISO(computed.activePeriod?.startDate || new Date().toISOString()), 'dd MMM', { locale: it })} — {format(parseISO(computed.activePeriod?.endDate || new Date().toISOString()), 'dd MMM yyyy', { locale: it })}
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--status-green-bg)', color: 'var(--status-green)', fontSize: '0.6rem' }}>
                  OPEN
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* KPI Header */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Spendibile al giorno
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: computed.spendibileGiornalieroFinoAlProssimoStipendio >= 0 ? 'var(--status-green)' : 'var(--status-red)' }}>
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(computed.spendibileGiornalieroFinoAlProssimoStipendio ?? 0)}
              </div>
            </div>

            <div style={{ height: '36px', width: '1px', backgroundColor: 'var(--border-color)' }} />

            {/* FIX 3.12: hamburger per mobile */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="hamburger-btn"
              style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.45rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'none', alignItems: 'center' }}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>


            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
              <Cloud 
                size={18} 
                style={{
                  color: syncStatus === 'synced' ? 'var(--status-green)' : 
                         syncStatus === 'syncing' ? 'var(--status-yellow)' : 
                         syncStatus === 'error' ? 'var(--status-red)' : 'var(--text-muted)'
                }} 
              />
            </div>

            <button
              onClick={toggleTheme}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '0.45rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="content-area">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
