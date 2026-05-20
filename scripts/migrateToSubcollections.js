const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrateUsers() {
  console.log('Avvio migrazione a Subcollections in Background...');
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    
    // 1. Salta chi ha già migrato o non ha storeData
    if (data.transactionsMigrated || !data.storeData || !data.storeData.transactions) {
      console.log(`[SKIP] Utente ${userDoc.id} già migrato o privo di dati.`);
      continue;
    }

    const transactions = data.storeData.transactions;
    if (!transactions || !transactions.length) {
      console.log(`[SKIP] Utente ${userDoc.id} ha un array transazioni vuoto.`);
      continue;
    }

    console.log(`[MIGRAZIONE] Utente ${userDoc.id} - ${transactions.length} tx da elaborare...`);
    
    const BATCH_LIMIT = 450; 
    let batch = db.batch();
    let opsCount = 0;
    let totalProcessed = 0;
    const totalTx = transactions.length;

    for (const tx of transactions) {
      const txRef = userDoc.ref.collection('transactions').doc(tx.id);
      batch.set(txRef, tx, { merge: true });
      opsCount++;
      totalProcessed++;
      
      const isLastOp = totalProcessed === totalTx;
      if (opsCount >= BATCH_LIMIT || isLastOp) {
        
        // [SICUREZZA ATOMICA] Aggiorna il documento radice rimuovendo l'array monolitico 
        // e apponendo il flag solo nell'ultimo batch utile. 
        if (isLastOp) {
           const cleanStoreData = { ...data.storeData };
           delete cleanStoreData.transactions; // Libera spazio dal documento principale
           batch.update(userDoc.ref, {
             storeData: cleanStoreData,
             transactionsMigrated: true,
             migrationDate: admin.firestore.FieldValue.serverTimestamp()
           });
        }
        
        await batch.commit();
        batch = db.batch(); 
        opsCount = 0;
      }
    }
    console.log(`[SUCCESSO] Utente ${userDoc.id} completato con successo (${totalProcessed} tx).`);
  }
}

migrateUsers().then(() => {
  console.log('Script di background concluso con successo.');
  process.exit(0);
}).catch(err => {
  console.error('Errore critico durante lo script:', err);
  process.exit(1);
});
