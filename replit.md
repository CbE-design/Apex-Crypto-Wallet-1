# Apex Crypto Wallet

An institutional-grade cryptocurrency wallet and exchange app built with Next.js, Firebase, and Genkit AI.

## Design System

- **Theme**: Deep navy dark UI (`#080E1A` base), cobalt blue primary (`#3B8EF3`), emerald green accent (`#16C780`)
- **Typography**: Inter, 4-level hierarchy — display / heading / body / caption
- **Components**: Glass cards, premium gradient buttons, pill active states on nav
- **Aurora background**: Radial gradient overlay across all dashboard pages

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: Tailwind CSS, Radix UI, shadcn/ui components
- **Auth/DB**: Firebase (Firestore, Firebase Admin SDK)
- **AI**: Google Genkit + Gemini API
- **Blockchain**: ethers.js, ccxt (exchange integrations)
- **Email**: Resend
- **Charts**: Recharts

## Project Structure

- `src/app/` — Next.js App Router pages and layouts
- `src/components/` — Reusable UI components
- `src/ai/` — Genkit AI flows and configuration
- `src/lib/` — Utilities and helpers
- `src/services/` — Firebase and external service clients
- `src/context/` — React context providers
- `src/firebasehooks/` — Firebase custom hooks
- `functions/` — Firebase Cloud Functions

## Running the App

```bash
npm run dev        # Start dev server on port 5000
npm run build      # Production build
npm run start      # Start production server on port 5000
```

## Required Environment Variables

Set these in Replit Secrets:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI features |
| `RESEND_API_KEY` | Resend API key for email sending |
| `FROM_EMAIL` | Sender email address |
| `FIREBASE_ADMIN_SDK_CONFIG` | Firebase Admin SDK JSON config (stringified) |
| `EXCHANGE_API_KEY` | Crypto exchange API key |
| `EXCHANGE_API_SECRET` | Crypto exchange API secret |
| `EXCHANGE_SANDBOX_MODE` | Set to `true` for sandbox/testing mode |

## Legal & Compliance Features

South Africa-specific regulatory compliance throughout the app:

- **4 Legal Pages** at `/legal/terms`, `/legal/privacy`, `/legal/risk-disclosure`, `/legal/aml-policy`
  - Terms of Service (FICA, FSCA, SARB, POCA compliant)
  - Privacy Policy (POPIA No. 4 of 2013 compliant)
  - Risk Disclosure Statement (FSCA guidelines)
  - AML, FICA & Compliance Policy (FATF Travel Rule, CARF, sanctions screening)
- **LegalFooter** (`src/components/legal-footer.tsx`) — injected into all non-admin pages
- **RiskDisclaimer** (`src/components/risk-disclaimer.tsx`) — collapsible dismissable banner; variants: trading/withdrawal/transfer/general; used on Swap, Send/Receive, and Cash-Out pages
- **Privacy Mode** (`src/hooks/use-privacy-mode.ts`) — functional localStorage toggle in Settings
- **Legal links** in Settings page under "Legal & Compliance" section
- **Legal links** in sidebar footer (compact grid)
- **T&C acceptance text** on login page with regulatory badge bar (FICA, FSCA, POPIA, FATF)
- **Legal layout** (`src/app/legal/layout.tsx`) — standalone layout, excluded from sidebar routing via `app-content.tsx`

Key SA thresholds enforced in UI copy:
- R3,000 — FATF Travel Rule trigger for crypto transfers
- R25,000 — Enhanced FICA due diligence threshold
- EFT: 1.5% + R15 fee | SWIFT: 3.5% + R250 fee

## Admin Panel

Full admin control centre at `/admin`:
- **Dashboard** — KPIs, Protocol Gate toggle, broadcast tabs (push + email)
- **Withdrawals** `/admin/withdrawals` — Approve/reject with Firestore transaction
- **KYC** `/admin/kyc` — Approve/reject with notification creation
- **User Registry** `/admin/users` — Search, filter by KYC status, portfolio drilldown
- **Notifications** `/admin/notifications` — Mark as read, mark all as read, sorted client-side
- **Fund Wallet** `/admin/direct-send` — Force credit any asset to any user wallet
- **Settings** `/admin/settings` — Platform controls, compliance, fees, security, deploy Firestore rules

### Firebase Admin SDK
`src/lib/firebase-admin.ts` auto-discovers credentials in this priority order:
1. `FIREBASE_ADMIN_SDK_CONFIG` env var (JSON string)
2. `firebase-service-account.json` file in project root (gitignored)

### Automated Rules Deployment
- `npm run deploy:rules` → `node scripts/deploy-rules.js` → deploys `firestore.rules` live
- **In-panel**: Settings page has "Deploy Security Rules to Firebase" button → `POST /api/admin/deploy-rules`
- Service account: `firebase-service-account.json` (gitignored, never commit)

### Query Strategy
All Firestore queries that combine `where` + `orderBy` sort client-side to avoid composite index requirements:
- `admin_notifications` — fetched as flat collection, sorted by `createdAt` desc in JS
- `users` — fetched as flat collection, sorted by `createdAt` desc in JS
- `withdrawal_requests` per user — fetched with `where('userId')` only, sorted by `createdAt` desc in JS

## Replit Configuration

- Port: **5000** (required for Replit webview)
- Dev server binds to `0.0.0.0` for proxy compatibility
- Replit domains whitelisted in `next.config.ts` for server actions
- Dependencies installed with `--legacy-peer-deps` due to genkit peer conflict
