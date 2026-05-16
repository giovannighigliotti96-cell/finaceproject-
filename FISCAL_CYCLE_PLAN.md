# Refactoring Architetturale Totale: "Fiscal Cycle Paradigm"

Questo piano delinea la trasformazione radicale della Liquidity Dashboard per passare dal concetto rigido di "Mese Solare" al "Ciclo Fiscale Personale" (da stipendio a stipendio), elevando il sistema a un livello da Private CFO.

## 1. Cambio Paradigma Temporale
L'applicazione smetterà di filtrare i dati banalmente tramite `date.startsWith('YYYY-MM')`. Verrà introdotta l'entità **Periodo Fiscale**. Un periodo avrà una `startDate` (es. 12 del mese) e una `endDate` prevista (es. 11 del mese successivo). Il motore finanziario calcolerà il rateo di spesa e il runway basandosi esclusivamente sui giorni effettivi del ciclo corrente.

## 2. Nuovo Data Model (Zustand: `useFinanceStore.js`)
Lo store verrà completamente sovrascritto per supportare il nuovo schema:
- **`settings`**: `viewMode` (calendar/fiscal), `safetyBuffer`, `defaultIncome`, `theme`, `currency`.
- **`periods`**: `{ id, type, startDate, endDate, status, openingBalance, targetClosingBalance }`.
- **`accounts`**: `{ id, name, type, currentBalance }`. I tipi includono `operating_liquidity`, `restricted_savings`, `investment`, `liability`.
- **`recurringRules`**: `{ id, name, dayOfMonth, amount, categoryId, type }`. Il motore estrapolerà le uscite future partendo da queste regole.
- **`transactions`**: Aggiunta di `periodId`, `accountId`, `nature` (fixed/variable/extraordinary), e `status` (planned/paid).
- **`goals`** e **`auditLog`** per storicizzare gli eventi critici di chiusura/quadratura.

## 3. Motore Finanziario e Formule (`FinanceContext.jsx`)
Il blocco `computed` nel Context verrà riscritto. Introdurremo il calcolo di:
- **KPI Primario (Spendibile Giornaliero fino a Stipendio)**: 
  `([Liquidità Operativa Reale] - [Uscite Fisse Previste nel Ciclo] - [Uscite Variabili Pianificate] - [Buffer Sicurezza]) / [Giorni allo Stipendio]`.
- **Cash Buffer Ratio**: `operatingLiquidity / averageMonthlyEssentialOutflows`.
- **Net Worth**: `Asset (Liquidity + Savings + Investments) - Liabilities`.
- **Proiezioni Fisse**: Logica di match tra la data odierna, il giorno delle `recurringRules` e la fine del periodo per estrapolare esattamente quanti soldi usciranno prima del prossimo stipendio.

## 4. Information Architecture e Navigation (`Layout.jsx`)
La sidebar verrà aggiornata per ospitare il nuovo routing e supportare le operazioni di riconciliazione e setup.
- Overview
- Cash Control (modulo Bridge to Salary)
- Daily Spending (Transazioni e inserimento multi-flag)
- Budget vs Actual
- Forecast
- **Accounts** *(NUOVA)*
- **Admin / Setup** *(NUOVA)*
- **Period Close / Reconciliation** *(NUOVA)*
- Goals
- Settings

## 5. Dettaglio Viste e Refactoring File
Ogni file sarà riscritto per intero, senza alcun placeholder (Regola di ingaggio #1).

### A. Viste Nuove
1. **`src/views/AdminSetup.jsx`**: "Control Center". Permetterà di definire le date del ciclo fiscale corrente, configurare il buffer di sicurezza e fare l'override delle `recurringRules` per il mese in corso.
2. **`src/views/PeriodClose.jsx`**: Wizard di quadratura avanzato. Input del saldo reale banca, calcolo dello scostamento e lock contabile del periodo con passaggio al successivo.
3. **`src/views/Accounts.jsx`**: Grid riepilogativa del Net Worth diviso per tipologia di conto.

### B. Viste da Aggiornare Pesantemente
1. **`Overview.jsx`**: Il layout sarà guidato dal KPI Primario (lo "Spendibile Giornaliero") e conterrà un widget per il Net Worth e il motore di alert.
2. **`CashControl.jsx`**: Timeline "Bridge to Salary" che simula l'erosione del saldo giorno per giorno fino al giorno 0 (il prossimo accredito).
3. **`DailySpending.jsx` e `TransactionFormModal.jsx`**: Aggiunta dei field `nature` (planned/unplanned/extraordinary) e selezione dell'`accountId`.

---

## ⚠️ Open Questions per l'Utente
1. Sei d'accordo che le `recurringRules` (es. mutuo il giorno 10, bolletta il giorno 20) agiscano come un "peso morto" sul saldo previsto finché la transazione reale non viene marcata come "paid"? (Questo è l'approccio più sicuro da Private CFO).
2. Per il "Fiscal Cycle", preferisci che la data finale sia impostabile manualmente ogni volta (es. "il mese prossimo mi pagano il 13 invece del 12 perché è sabato") o calcolata automaticamente? Io suggerisco di prevedere un input nel `AdminSetup` per variare dinamicamente la data del prossimo stipendio.
