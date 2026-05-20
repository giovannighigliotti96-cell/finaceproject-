import { useEffect, useRef, useState } from 'react';
import { auth } from '../lib/firebase';
import { saveUserData, subscribeUserData } from '../lib/firestore';
import { useFinanceStore } from '../store/useFinanceStore';
import { onAuthStateChanged } from 'firebase/auth';
import { create } from 'zustand';

export const useSyncStore = create((set) => ({
  syncStatus: 'offline',
  isInitializing: true,
  setSyncStatus: (status) => set({ syncStatus: status }),
  setIsInitializing: (isInit) => set({ isInitializing: isInit }),
}));

export function isMeaningfulStoreData(data) {
  if (!data) return false;
  const hasPeriods = Array.isArray(data.periods) && data.periods.length > 0;
  const hasTransactions = Array.isArray(data.transactions) && data.transactions.length > 0;
  const hasAccounts = Array.isArray(data.accounts) && data.accounts.length > 0;
  const hasGoals = Array.isArray(data.goals) && data.goals.length > 0;
  const hasAuditLog = Array.isArray(data.auditLog) && data.auditLog.length > 0;
  const hasActivePeriod = data.settings && data.settings.activePeriodId !== null && data.settings.activePeriodId !== undefined;
  
  return hasPeriods || hasTransactions || hasAccounts || hasGoals || hasAuditLog || hasActivePeriod;
}

export function useFirebaseSync() {
  const storeData = useFinanceStore(state => state.data);
  const setData = useFinanceStore(state => state.setData);
  const updateSettings = useFinanceStore(state => state.updateSettings);
  
  const syncStatus = useSyncStore(state => state.syncStatus);
  const setSyncStatus = useSyncStore(state => state.setSyncStatus);
  
  const lastSyncTimeRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const skipNextWriteRef = useRef(false);
  const isInitializing = useSyncStore(state => state.isInitializing);
  const setIsInitializing = useSyncStore(state => state.setIsInitializing);
  const [user, setUser] = useState(null);
  
  const previousSyncedDataRef = useRef(null);
  // Reference per memorizzare lo stato di migrazione effettivo rilevato sul Cloud
  const cloudIsMigratedRef = useRef(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setSyncStatus('offline');
        setIsInitializing(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Inizializzazione e Subscribe
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    let unsubscribeSnapshot = null;

    const initSync = async () => {
      setIsInitializing(true);
      try {
        if (isMounted) {
          previousSyncedDataRef.current = useFinanceStore.getState().data;
          
          unsubscribeSnapshot = subscribeUserData(user.uid, (remoteData, remoteUpdatedAt, isMigrated) => {
             if (remoteData && remoteUpdatedAt > lastSyncTimeRef.current) {
                skipNextWriteRef.current = true;
                lastSyncTimeRef.current = remoteUpdatedAt;
                
                // Aggiorna lo stato di migrazione cloud e la baseline
                cloudIsMigratedRef.current = isMigrated;
                previousSyncedDataRef.current = remoteData;
                
                setData(remoteData);
             }
             setIsInitializing(false);
          });
        }
      } catch (error) {
        console.error("Init sync error:", error);
        setIsInitializing(false);
      }
    };

    initSync();

    return () => {
      isMounted = false;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    }
  }, [user]);

  // Scrittura Debounce + Diffing Integrato
  useEffect(() => {
    if (!user || !storeData || isInitializing) return;
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }

    setSyncStatus('syncing');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Passiamo cloudIsMigratedRef.current per garantire la protezione da Bypass Migrazione
        await saveUserData(user.uid, storeData, previousSyncedDataRef.current, cloudIsMigratedRef.current);
        
        lastSyncTimeRef.current = Date.now();
        previousSyncedDataRef.current = storeData;
        
        // Una volta completato il primo salvataggio con successo, il cloud è da considerarsi migrato
        cloudIsMigratedRef.current = true;
        
        setSyncStatus('synced');
        updateSettings({ lastCloudSync: new Date().toISOString() });
      } catch (error) {
        console.error("Errore durante il salvataggio:", error);
        setSyncStatus('error');
      }
    }, 2000);

    return () => clearTimeout(debounceTimerRef.current);
  }, [storeData, user, isInitializing]);

  return { syncStatus, user, isInitializing };
}
