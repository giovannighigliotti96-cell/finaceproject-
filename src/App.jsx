import React, { useState, useEffect, Suspense, lazy } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { FinanceProvider } from './context/FinanceContext';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useFinanceStore } from './store/useFinanceStore';
import { useAutoBackup } from './hooks/useAutoBackup';

const Overview = lazy(() => import('./views/Overview'));
const CashControl = lazy(() => import('./views/CashControl'));
const BudgetActual = lazy(() => import('./views/BudgetActual'));
const DailySpending = lazy(() => import('./views/DailySpending'));
const FixedCosts = lazy(() => import('./views/FixedCosts'));
const Forecast = lazy(() => import('./views/Forecast'));
const Historical = lazy(() => import('./views/Historical'));
const Goals = lazy(() => import('./views/Goals'));
const Accounts = lazy(() => import('./views/Accounts'));
const AdminSetup = lazy(() => import('./views/AdminSetup'));
const PeriodClose = lazy(() => import('./views/PeriodClose'));
const SettingsView = lazy(() => import('./views/Settings'));
const ImportBanca = lazy(() => import('./views/ImportBanca'));

import './index.css';

// DEBUG: Esponi store globalmente per debug (solo in development)
if (import.meta.env.DEV) {
  window.__FINANCE_STORE__ = useFinanceStore;
  import('./dev/debug_networth.js').then(module => {
    window.debugNetWorth = module.debugNetWorth;
    console.log('🔧 Debug tools loaded. Run debugNetWorth() in console to diagnose Net Worth issues.');
  });
}

// FIX 3.5: Hydration guard — skeleton durante init async di IndexedDB
function HydrationGate({ children }) {
  const [hydrated, setHydrated] = useState(
    useFinanceStore.persist?.hasHydrated?.() ?? false
  );

  // Auto-backup hook - si attiva dopo l'hydration
  useAutoBackup();

  useEffect(() => {
    if (!hydrated) {
      const unsub = useFinanceStore.persist.onFinishHydration(() => {
        setHydrated(true);
      });
      return unsub;
    }
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border-color)',
          borderTop: '3px solid var(--text-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Caricamento dati…
        </p>
      </div>
    );
  }

  return children;
}

const router = createHashRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <ToastProvider>
          <HydrationGate>
            <FinanceProvider>
              <Layout />
            </FinanceProvider>
          </HydrationGate>
        </ToastProvider>
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <Overview /> },
      { path: 'overview', element: <Navigate to="/" replace /> },
      { path: 'cash', element: <CashControl /> },
      { path: 'variable', element: <DailySpending /> },
      { path: 'fixed', element: <FixedCosts /> },
      { path: 'budget', element: <BudgetActual /> },
      { path: 'forecast', element: <Forecast /> },
      { path: 'historical', element: <Historical /> },
      { path: 'accounts', element: <Accounts /> },
      { path: 'admin', element: <AdminSetup /> },
      { path: 'period-close', element: <PeriodClose /> },
      { path: 'goals', element: <Goals /> },
      { path: 'settings', element: <SettingsView /> },
      { path: 'import', element: <ImportBanca /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ]
  }
]);

function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted">Caricamento in corso...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default App;
