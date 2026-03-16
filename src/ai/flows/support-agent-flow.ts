'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  SupportAgentInputSchema,
  type SupportAgentInput,
  SupportAgentOutputSchema,
  type SupportAgentOutput,
} from '@/lib/types';

export async function supportAgent(input: SupportAgentInput): Promise<SupportAgentOutput> {
  return supportAgentFlow(input);
}

const APEX_KNOWLEDGE = `
Apex Wallet is an institutional-grade, self-custodial cryptocurrency wallet and exchange platform.
Users hold their own private keys — Apex never holds or custodies funds.

SUPPORTED CRYPTOCURRENCIES: BTC (Bitcoin), ETH (Ethereum), SOL (Solana), USDT (Tether),
USDC, BNB, ADA, XRP, DOT, LINK, AVAX, MATIC, LTC, UNI, ATOM, and more.

DISPLAY CURRENCIES: USD, EUR, GBP, ZAR, AUD, CAD, JPY, CHF, CNY, INR, NGN, BRL, MXN, SGD,
HKD, NZD, SEK, NOK, DKK, PLN. Change via the currency picker in the top-right header.

DASHBOARD (/):
- Portfolio Overview: total value, pie chart, 24h changes, live prices.
- Market Overview: live prices and 24h changes. Auto-refreshes every 60 seconds.
- Transaction History: full log of all past transactions.
- Price Alerts: steps: click Add Alert, select coin, choose Above or Below, enter price, save.

MY WALLETS (/wallets): All wallets with live balances, USD values, and 24h trends.

SWAP (/swap): Exchange one crypto for another.
Steps: select FROM asset, select TO asset, enter amount, review rate and fee, confirm swap.

SEND AND RECEIVE (/send-receive):
- SEND: select asset, enter recipient address, enter amount, confirm. Transactions above $10,000
  require Travel Rule compliance verification. Network fee is deducted automatically.
- RECEIVE: click Receive, select asset, share your address or QR code.

CASH OUT (/cash-out):
- Bank Transfer: select asset, enter amount, enter bank details, confirm. Arrives in 1-3 business days.
- Crypto ATM: select asset, enter amount, receive a 6-digit PIN valid 30 minutes, use at ATM.
- Minimum $10. Fees shown before confirmation.

SETTINGS (/settings):
- Account: update name and email.
- Appearance: dark or light mode, language.
- Localization: display currency.
- Notifications: email alerts, price alerts, transaction alerts.
- Security: change password, enable 2FA, view sessions, revoke access.

WALLET CREATION AND IMPORT:
- Create: login screen, Create New Wallet. Generates new address and seed phrase. Back it up immediately.
- Import: login screen, Import Existing Wallet. Enter your 12 or 24-word seed phrase.

TRANSACTION STATUSES:
- Completed: confirmed on blockchain.
- Pending: ETH and SOL take 1-5 minutes. BTC up to 60 minutes.
- Reconciling: compliance verification in progress.
- Failed: could not process. Funds are not deducted.

SECURITY:
- Non-custodial: private keys never leave the device.
- Seed phrase: 12 or 24 words. Store offline, never share. View in Settings, Security.
- 2FA: enable in Settings, Security.
- If compromised: Settings, Security, Revoke All Sessions.

FEES:
- Network fees charged by the blockchain, not Apex.
- Small platform fee on swaps (shown in preview).
- Cash-out fees shown before confirmation. Receiving is free.

TROUBLESHOOTING:
- Balance shows 0: ensure wallet is connected, refresh, or re-import with seed phrase.
- Pending for 2+ hours: contact support.
- Wrong swap amount: slippage during volatility.
- Forgot password: Forgot Password link on login page.
- Lost seed phrase: cannot be recovered, always store offline.
- ATM PIN expired: generate a new one in Cash Out.

CONTACT: support@apexwallet.io (24-48 hours). Security issues: security@apexwallet.io (4 hours).
`;

// Internal schema used only within this flow
const InternalPromptSchema = z.object({ builtPrompt: z.string() });

const supportPrompt = ai.definePrompt({
  name: 'supportAgentPrompt',
  input: { schema: InternalPromptSchema },
  output: { schema: SupportAgentOutputSchema },
  prompt: `{{builtPrompt}}`,
});

const supportAgentFlow = ai.defineFlow(
  {
    name: 'supportAgentFlow',
    inputSchema: SupportAgentInputSchema,
    outputSchema: SupportAgentOutputSchema,
  },
  async (input) => {
    const historyLines = (input.history ?? [])
      .map(m => `${m.role === 'user' ? 'User' : 'Apex Support'}: ${m.content}`)
      .join('\n');

    const builtPrompt = [
      'You are Apex Support, the official AI customer support agent for Apex Crypto Wallet.',
      'You are professional, warm, concise, and always accurate.',
      'You have deep knowledge of the platform documented below.',
      '',
      'PLATFORM KNOWLEDGE:',
      APEX_KNOWLEDGE,
      '',
      'RULES:',
      '- Answer the specific question directly and concisely.',
      '- Give step-by-step instructions when explaining how to use a feature.',
      '- Be empathetic if the user is frustrated.',
      '- Never make up features not documented above.',
      '- If unsure, suggest contacting support@apexwallet.io.',
      '- Keep responses concise — 2 to 4 paragraphs unless a step-by-step guide is needed.',
      '- Never say dummy data, test mode, or simulation. The platform is real.',
      '- Use plain text with dashes for lists.',
      '- For security or lost fund concerns, escalate to security@apexwallet.io.',
      '',
      ...(historyLines ? ['CONVERSATION HISTORY:', historyLines, ''] : []),
      `USER MESSAGE: ${input.query}`,
      '',
      'YOUR RESPONSE:',
    ].join('\n');

    const { output } = await supportPrompt({ builtPrompt });
    return output!;
  }
);
