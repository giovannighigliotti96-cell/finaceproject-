import { useEffect, useRef } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 ore
const BACKUP_KEY = 'last-auto-backup-timestamp';

/**
 * Hook per backup automatico giornaliero su GitHub Gists
 * Si attiva quando:
 * - L'app viene aperta e sono passate 24h dall'ultimo backup
 * - Dopo operazioni critiche (chiusura ciclo, transazioni importanti)
 */
export function useAutoBackup() {
  const syncToCloud = useFinanceStore(state => state.syncToCloud);
  const data = useFinanceStore(state => state.data);
  const isBackingUp = useRef(false);

  const shouldBackup = () => {
    const { githubToken, gistId } = data.settings;
    
    // Non fare backup se non configurato
    if (!githubToken || !gistId) {
      return false;
    }

    const lastBackup = localStorage.getItem(BACKUP_KEY);
    if (!lastBackup) return true;

    const timeSinceLastBackup = Date.now() - parseInt(lastBackup, 10);
    return timeSinceLastBackup >= BACKUP_INTERVAL_MS;
  };

  const performBackup = async () => {
    if (isBackingUp.current) return;
    
    try {
      isBackingUp.current = true;
      console.log('[AutoBackup] Esecuzione backup automatico...');
      
      await syncToCloud();
      localStorage.setItem(BACKUP_KEY, Date.now().toString());
      
      console.log('[AutoBackup] ✓ Backup completato con successo');
    } catch (error) {
      console.warn('[AutoBackup] Errore durante il backup automatico:', error.message);
      // Non mostriamo errori all'utente per non disturbare l'esperienza
    } finally {
      isBackingUp.current = false;
    }
  };

  // Backup automatico all'avvio dell'app (se necessario)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldBackup()) {
        performBackup();
      }
    }, 5000); // Aspetta 5 secondi dopo il caricamento per non rallentare l'app

    return () => clearTimeout(timer);
  }, []); // Solo al mount

  // Backup dopo operazioni critiche (monitora lastSync)
  useEffect(() => {
    const { lastSync } = data.settings;
    
    // Se lastSync è recente (< 10 secondi), probabilmente è un backup manuale
    // Non fare nulla per evitare backup duplicati
    if (lastSync) {
      const timeSinceSync = Date.now() - new Date(lastSync).getTime();
      if (timeSinceSync < 10000) {
        // Aggiorna il timestamp del backup automatico per evitare backup immediato
        localStorage.setItem(BACKUP_KEY, Date.now().toString());
      }
    }
  }, [data.settings.lastSync]);

  return {
    performBackup,
    shouldBackup,
  };
}
