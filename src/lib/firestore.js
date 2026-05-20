import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Funzione di Diffing (Eseguita in memoria dal client)
 */
function calculateDiff(prevTxs = [], currentTxs = []) {
  const prevMap = new Map(prevTxs.map(t => [t.id, t]));
  const currentMap = new Map(currentTxs.map(t => [t.id, t]));
  
  const toWrite = [];
  const toDelete = [];

  // Trova Aggiunti e Modificati
  currentMap.forEach((tx, id) => {
    if (!prevMap.has(id)) {
      toWrite.push(tx);
    } else {
      // Comparazione veloce per modifiche (funziona bene per oggetti piatti)
      if (JSON.stringify(tx) !== JSON.stringify(prevMap.get(id))) {
        toWrite.push(tx);
      }
    }
  });

  // Trova Eliminati
  prevMap.forEach((tx, id) => {
    if (!currentMap.has(id)) {
      toDelete.push(id);
    }
  });

  return { toWrite, toDelete };
}

export async function saveUserData(uid, currentStoreData, previousStoreData = null, cloudIsMigrated = false) {
  try {
    const { transactions: currentTxs, ...coreData } = currentStoreData;
    const prevTxs = previousStoreData?.transactions || [];
    
    let toWrite = [];
    let toDelete = [];

    if (cloudIsMigrated) {
      // Se il cloud è già migrato, ottimizziamo usando il diffing standard
      const diff = calculateDiff(prevTxs, currentTxs || []);
      toWrite = diff.toWrite;
      toDelete = diff.toDelete;
    } else {
      // [PROTEZIONE DATA LOSS] Se il cloud NON è ancora migrato, FORZIAMO la migrazione di tutto lo storico.
      // Questo previene la perdita di dati se l'utente modifica solo impostazioni minori (coreData)
      toWrite = currentTxs || [];
      toDelete = [];
    }
    
    // Rimuoviamo permanentemente l'array dal payload del documento principale
    delete coreData.transactions;
    
    const BATCH_LIMIT = 450;
    const allOperations = [
      ...toWrite.map(tx => ({ type: 'set', tx })),
      ...toDelete.map(id => ({ type: 'delete', id }))
    ];
    
    const totalOps = allOperations.length;
    let batch = writeBatch(db);
    
    // CASO 1: Nessuna operazione e utente già migrato (es. aggiornamento parziale dei settings)
    if (totalOps === 0 && cloudIsMigrated) {
      const docRef = doc(db, 'users', uid);
      batch.set(docRef, { 
        storeData: coreData, 
        updatedAt: Date.now(),
        transactionsMigrated: true 
      }, { merge: true });
      await batch.commit();
      console.log('[firestore] Solo aggiornamento Core completato.');
      return;
    }

    // CASO 2: Transazioni da sincronizzare (Lazy Migration o Delta standard)
    let opCount = 0;
    let totalOpsProcessed = 0;
    
    for (const op of allOperations) {
      if (op.type === 'set') {
        const txRef = doc(db, 'users', uid, 'transactions', op.tx.id);
        batch.set(txRef, op.tx, { merge: true });
      } else if (op.type === 'delete') {
        const txRef = doc(db, 'users', uid, 'transactions', op.id);
        batch.delete(txRef);
      }
      
      opCount++;
      totalOpsProcessed++;
      
      const isLastOp = totalOpsProcessed === totalOps;
      if (opCount >= BATCH_LIMIT || isLastOp) {
        // [SICUREZZA ATOMICA] Il flag viene impostato e l'array legacy pulito sul cloud 
        // SOLO ed esclusivamente nell'ultimo batch andato a buon fine.
        if (isLastOp) {
          const docRef = doc(db, 'users', uid);
          batch.set(docRef, { 
            storeData: coreData, 
            updatedAt: Date.now(),
            transactionsMigrated: true 
          }, { merge: true });
        }
        
        await batch.commit();
        batch = writeBatch(db); 
        opCount = 0;
      }
    }
    
    console.log(`[firestore] Sync completato (Forza Migrazione: ${!cloudIsMigrated}): ${toWrite.length} scritti, ${toDelete.length} eliminati.`);
  } catch (error) {
    console.error('[firestore] Error saving user data:', error);
    throw error;
  }
}

export function subscribeUserData(uid, callback) {
  const docRef = doc(db, 'users', uid);
  const txCollectionRef = collection(db, 'users', uid, 'transactions');
  
  let coreData = null;
  let txData = [];
  let isMigrated = false;
  
  // Flag per prevenire il flash UI iniziale e le race condition nei listener
  let hasCoreLoaded = false;
  let hasTxLoaded = false;

  const notify = () => {
    if (!hasCoreLoaded) return;
    
    // Previene flash UI: Se è migrato ma la subcollection non è ancora pronta, attendiamo.
    if (isMigrated && !hasTxLoaded) {
      return;
    }

    const payload = { ...coreData };
    if (isMigrated) {
      payload.transactions = txData;
    }
    // Passiamo lo stato corretto di isMigrated al sync client per pilotare il comportamento di scrittura
    callback(payload, coreData.updatedAt || Date.now(), isMigrated);
  };

  const unsubCore = onSnapshot(docRef, (docSnap) => {
    hasCoreLoaded = true;
    if (docSnap.exists()) {
      const rawData = docSnap.data();
      coreData = rawData.storeData || {};
      isMigrated = rawData.transactionsMigrated === true;
      notify();
    }
  });

  const unsubTx = onSnapshot(txCollectionRef, (snapshot) => {
    hasTxLoaded = true;
    txData = snapshot.docs.map(d => d.data());
    notify();
  });

  return () => {
    unsubCore();
    unsubTx();
  };
}
