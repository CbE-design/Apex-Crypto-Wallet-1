---
name: On-chain versus virtual balances
description: Keep public blockchain transfers separate from the app's Firestore demo ledger.
---

Publicly verifiable transfers require a real network asset and transaction hash; Firestore virtual balances cannot be presented as on-chain funds.

**Why:** Treating an internal credit as a blockchain asset would mislead users and cannot produce a valid block-explorer transaction.

**How to apply:** Keep on-chain sends network-specific, sign locally with the self-custodial wallet, and never debit virtual balances unless a real bridge or token contract has been implemented.