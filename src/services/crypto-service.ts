
'use server';

import { marketCoins } from '@/lib/data';

/**
 * @fileOverview Crypto price service backed by the CoinGecko free public API.
 * Next.js fetch() caching handles deduplication and revalidation server-side.
 *
 * - getLivePrices     — current prices converted to any fiat currency
 * - getLive24hChanges — 24-hour percentage change for each symbol
 * - getFiatRate       — USD → target fiat conversion rate (Frankfurter API)
 */

export const COINGECKO_IDS: Record<string, string> = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  LINK:  'chainlink',
  SOL:   'solana',
  BNB:   'binancecoin',
  XRP:   'ripple',
  ADA:   'cardano',
  USDT:  'tether',
  USDC:  'usd-coin',
  DOGE:  'dogecoin',
  MATIC: 'matic-network',
  POL:   'matic-network',
  AVAX:  'avalanche-2',
  DOT:   'polkadot',
  UNI:   'uniswap',
  ATOM:  'cosmos',
  LTC:   'litecoin',
  BCH:   'bitcoin-cash',
  TRX:   'tron',
  SHIB:  'shiba-inu',
  TON:   'the-open-network',
  SUI:   'sui',
  APT:   'aptos',
  OP:    'optimism',
  ARB:   'arbitrum',
};

const FALLBACK_FIAT_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, ZAR: 18.62, AUD: 1.53,
  CAD: 1.36, JPY: 149.50, CHF: 0.90, CNY: 7.24, INR: 83.10,
  NGN: 1580.00, BRL: 4.97, MXN: 17.15, SGD: 1.34, HKD: 7.82,
  NZD: 1.63, SEK: 10.45, NOK: 10.52, DKK: 6.87, PLN: 3.95,
};

/**
 * Fetch USD prices + 24h changes from CoinGecko for a set of crypto symbols.
 * Next.js deduplicates identical fetch calls within the same request and
 * caches the HTTP response for 60 seconds across requests.
 */
async function fetchCoinGecko(
  symbols: string[],
): Promise<{ usdPrices: Record<string, number>; changes: Record<string, number> }> {
  const usdPrices: Record<string, number> = {};
  const changes: Record<string, number> = {};

  const stableCoins = ['USDT', 'USDC'];
  for (const s of symbols) {
    if (stableCoins.includes(s)) { usdPrices[s] = 1; changes[s] = 0.01; }
  }

  const cryptoSymbols = symbols.filter(s => !stableCoins.includes(s));
  if (cryptoSymbols.length === 0) return { usdPrices, changes };

  const ids = cryptoSymbols.map(s => COINGECKO_IDS[s]).filter(Boolean).join(',');
  if (!ids) {
    for (const sym of cryptoSymbols) {
      const coin = marketCoins.find(c => c.symbol === sym);
      usdPrices[sym] = coin?.priceUSD ?? 0;
      changes[sym]   = coin?.change24h ?? 0;
    }
    return { usdPrices, changes };
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&precision=8`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const json = await res.json() as Record<string, Record<string, number>>;
      for (const sym of cryptoSymbols) {
        const id = COINGECKO_IDS[sym];
        if (!id || !json[id]) continue;
        usdPrices[sym] = json[id]['usd'] ?? 0;
        changes[sym]   = json[id]['usd_24h_change'] ?? 0;
      }
    }
  } catch {
    // CoinGecko unavailable — fall through to static data
  }

  for (const sym of cryptoSymbols) {
    if (usdPrices[sym] === undefined) {
      const coin = marketCoins.find(c => c.symbol === sym);
      usdPrices[sym] = coin?.priceUSD ?? 0;
      changes[sym]   = coin?.change24h ?? 0;
    }
  }

  return { usdPrices, changes };
}

export async function getFiatRate(targetCurrency: string): Promise<number> {
  const upper = targetCurrency.toUpperCase();
  if (upper === 'USD') return 1;
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${upper}`,
      { next: { revalidate: 600 } },
    );
    if (res.ok) {
      const json = await res.json();
      const rate: number = json?.rates?.[upper];
      if (rate && rate > 0) return rate;
    }
  } catch {
    // Fall through to hardcoded rates
  }
  return FALLBACK_FIAT_RATES[upper] ?? 1;
}

export async function getLivePrices(
  symbols: string[],
  targetCurrency = 'USD',
): Promise<Record<string, number>> {
  const { usdPrices } = await fetchCoinGecko(symbols);
  if (targetCurrency.toUpperCase() === 'USD') return usdPrices;
  const rate = await getFiatRate(targetCurrency);
  const result: Record<string, number> = {};
  for (const [sym, price] of Object.entries(usdPrices)) {
    result[sym] = price * rate;
  }
  return result;
}

export async function getLive24hChanges(
  symbols: string[],
): Promise<Record<string, number>> {
  const { changes } = await fetchCoinGecko(symbols);
  return changes;
}
