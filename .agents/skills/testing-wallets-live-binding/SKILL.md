---
name: testing-wallets-live-binding
description: End-to-end test the Apex wallet UI — wallet import/PIN login and the /wallets live-bound ledger (Firestore balances + live prices). Use when verifying wallet-page, dashboard portfolio, or live-price UI changes.
---

# Testing Apex wallet UI end-to-end

## What this covers
Signing into the app with a wallet, and verifying pages that bind to
`users/{uid}/wallets/{SYMBOL}` Firestore docs priced via `useLivePrices()` (`/wallets`,
dashboard `PortfolioOverview`).

## Devin Secrets Needed
- A Firebase **service-account JSON** (Admin SDK) for project `studio-8025635453-a4860`, used only to
  seed/read Firestore balances during testing. In past sessions this was provided ad-hoc and wiped after.
  There is no permanently-saved secret name yet — request one (session-only) if you need to seed balances.
  Wipe it with `shred -u` when done.

## Local setup
```bash
cd ~/repos/Apex-Crypto-Wallet-1
npm install --legacy-peer-deps   # if needed
export FIREBASE_ADMIN_SDK_CONFIG="$(cat /path/to/sa.json)"   # enables /api/auth/wallet-token locally
PORT=3000 npm run dev
```
The wallet-token route needs a valid Admin SDK config or wallet creation returns 503.

## Deterministic login (import a known wallet)
Generate a wallet so you know the uid up front (uid = `w_` + address[2:].toLowerCase(), 40 hex chars):
```bash
node -e "const {ethers}=require('ethers');const w=ethers.Wallet.createRandom();
console.log(w.mnemonic.phrase);console.log('w_'+w.address.slice(2).toLowerCase().slice(0,40));"
```
Then in the UI: `/login` → **Import Existing Wallet** → paste mnemonic → **Restore Wallet** →
create a 6-digit PIN → confirm PIN → **Skip for now** (passkey). App redirects to `/`. If it shows a
locked screen, re-enter the PIN. This is **setup** — do it before starting the recording.

Importing a brand-new wallet seeds ALL `marketCoins` (~9: BTC, ETH, LINK, SOL, BNB, XRP, ADA, USDT, DOGE)
into `users/{uid}/wallets` with `balance: 0`. So a fresh wallet is NOT empty — it shows ~9 assets at `$0.00`.

## Seeding balances (to test dynamic values)
Doc id = symbol; fields `{ balance, currency }`:
```js
const admin=require('.../node_modules/firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('/path/sa.json'))});
await admin.firestore().doc(`users/${uid}/wallets/SOL`).set({balance:10,currency:'SOL'},{merge:true});
```
Reload the page in the browser after seeding (client `useCollection` picks it up on reload).

## Key assertions for /wallets
- NOT the old mock: the mock was exactly 3 rows — `1.05 BTC`=$50,210.42, `4.82 ETH`=$16,850.11,
  `8,421 XRP`=$5,012.77 with fixed +2.5/-1.2/+5.8%. Real page shows the full Firestore set.
- Seeded balances render as `amount × live price` and sort **descending by USD value**.
- BTC amount formats to 6 decimals, others 4 (per page code).

## Gotcha — cold-cache static-price flash (might be broken / might be fine)
`/api/prices` proxies CoinGecko with a ~60s cache and a **static fallback** (from `lib/data`) when the
live call is slow/rate-limited. On a cold cache the page may briefly show static prices
(e.g. SOL×$130=$1,300, ADA×$0.70=$3,500) BEFORE live values arrive, then update to live
(SOL×~$76, ADA×~$0.16). To assert LIVE prices reliably: warm the cache first
(`curl "localhost:3000/api/prices?symbols=SOL,ADA&currency=USD"`), then reload and wait a few seconds.
Cross-check displayed USD = balance × the price in the `/api/prices` JSON. If the page NEVER shows live
values even with a warm cache, that would indicate a real binding bug in the price mapping.

## Console noise to ignore
`Warning: Extra attributes from the server: devin-hidden` is a benign Next.js dev hydration warning,
not a page error.
