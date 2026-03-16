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

## Replit Configuration

- Port: **5000** (required for Replit webview)
- Dev server binds to `0.0.0.0` for proxy compatibility
- Replit domains whitelisted in `next.config.ts` for server actions
- Dependencies installed with `--legacy-peer-deps` due to genkit peer conflict
