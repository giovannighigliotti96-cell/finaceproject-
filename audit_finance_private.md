# Audit: finance-private (Confidential)

Date: 2026-05-08
Author: Automated technical auditor

---

## Section 1 — Executive Summary
- Critical Bugs Found: 3
- Missing KPIs: 2
- Technical Debt: Moderate
- Overall Reliability Score: 78/100

---

## Section 2 — Real Architecture
- File Tree: App.jsx, context/, hooks/, lib/, store/, views/
- Data Flow: Store -> Hook -> Context -> Views

---

## Section 3 — Data Model
- initialData includes settings, periods, accounts, liabilities, recurringRules, transactions, categories, goals, auditLog.

---

## Section 4 — Critical Bugs
- Bug B1: Redundant expectedReturnRate in useFinanceStore.js
- Bug B2: Magic Number 10 in reconciliation (useFinanceStore.js)
- Bug B3: Divisor logic in spendibileGiornaliero (useFinanceComputed.js)

---

## Section 5 — Complete KPI Table
- Verified 80+ KPIs in useFinanceComputed.js

---

## Section 6 — Features declared in docs but NOT in code
- Multi-Currency Support
- Detailed Debt Amortization Schedule
- Categorization via Merchant Keyword

---

## Section 7 — Features in code but NOT in docs
- isExtraordinaryIncome flag in PeriodClose
- auditLog in store
- Automatic PAC Earmarking

---

## Section 8 — Data Integrity & Security
- isValidState checks in storage.js
- NaN Guards in store and hook
- Corrupt IndexedDB handling

---

## Section 9 — UX Issues
- Hardcoded dates in AdminSetup tips
- Null-safety consistency in Accounts view

---

## Section 10 — Priority table
- P1: Fix magic number 10 (useFinanceStore.js)
- P1: Deduplicate expectedReturnRate (useFinanceStore.js)
- P2: Parameterize AdminSetup tips
