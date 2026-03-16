
'use server';

import * as ccxt from 'ccxt';
import { marketCoins } from '@/lib/data';

/**
 * @fileOverview A service for fetching cryptocurrency data using the ccxt library
 * and real fiat exchange rates via the Frankfurter API.
 *
 * - getLivePrices - Fetches current crypto prices in any target fiat currency.
 * - getFiatRate    - Fetches a live USD→target fiat conversion rate.
 */

const cache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL_CRYPTO = 60 * 1000;  // 1 minute for crypto prices
const CACHE_TTL_FIAT   = 10 * 60 * 1000; // 10 minutes for fiat rates

// Realistic fallback rates (USD → target), updated periodically
const FALLBACK_FIAT_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  ZAR: 18.62,
  AUD: 1.53,
  CAD: 1.36,
  JPY: 149.50,
  CHF: 0.90,
  CNY: 7.24,
  INR: 83.10,
  NGN: 1580.00,
  BRL: 4.97,
  MXN: 17.15,
  SGD: 1.34,
  HKD: 7.82,
  NZD: 1.63,
  SEK: 10.45,
  NOK: 10.52,
  DKK: 6.87,
  PLN: 3.95,
};

function getExchangeInstance() {
  const exchangeId = 'binance' as keyof typeof ccxt.exchanges;
  const exchangeClass = ccxt[exchangeId];
  const exchange = new exchangeClass({
    apiKey: process.env.EXCHANGE_API_KEY,
    secret: process.env.EXCHANGE_API_SECRET,
  });
  if (process.env.EXCHANGE_SANDBOX_MODE === 'true' && exchange.has['sandbox']) {
    exchange.setSandboxMode(true);
  }
  return exchange;
}

/**
 * Fetches the USD→targetCurrency fiat rate using the Frankfurter open API.
 * Falls back to hardcoded rates if the request fails.
 */
async function getFiatRate(targetCurrency: string): Promise<number> {
  const upper = targetCurrency.toUpperCase();
  if (upper === 'USD') return 1;

  const cacheKey = `FIAT-USD-${upper}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_FIAT) {
    return cached.price;
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${upper}`,
      { next: { revalidate: 600 } }
    );
    if (res.ok) {
      const json = await res.json();
      const rate: number = json?.rates?.[upper];
      if (rate && rate > 0) {
        cache.set(cacheKey, { price: rate, timestamp: Date.now() });
        return rate;
      }
    }
  } catch {
    // Network error — fall through to hardcoded rates
  }

  // Use hardcoded fallback
  const fallback = FALLBACK_FIAT_RATES[upper] ?? 1;
  cache.set(cacheKey, { price: fallback, timestamp: Date.now() });
  return fallback;
}

/**
 * Fetches USD prices for the given symbols from Binance, then converts to
 * the target fiat currency using a real exchange-rate lookup.
 */
export async function getLivePrices(
  symbols: string[],
  targetCurrency: string = 'USD'
): Promise<Record<string, number>> {
  const exchange = getExchangeInstance();
  const symbolsToFetch: string[] = [];
  const usdPrices: Record<string, number> = {};

  // --- 1. Check USD-price cache ---
  for (const symbol of symbols) {
    // USDT is always 1:1 with USD
    if (symbol === 'USDT') {
      usdPrices['USDT'] = 1;
      continue;
    }
    const cached = cache.get(`${symbol}-USD`);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_CRYPTO) {
      usdPrices[symbol] = cached.price;
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // --- 2. Fetch remaining from Binance ---
  if (symbolsToFetch.length > 0) {
    const nonStable = symbolsToFetch.filter(s => s !== 'USDT');
    if (nonStable.length > 0) {
      try {
        const pairs = nonStable.map(s => `${s}/USDT`);
        const tickers = await exchange.fetchTickers(pairs);

        for (const [pair, ticker] of Object.entries(tickers)) {
          const sym = pair.split('/')[0];
          if (ticker?.last && ticker.last > 0) {
            usdPrices[sym] = ticker.last;
            cache.set(`${sym}-USD`, { price: ticker.last, timestamp: Date.now() });
          }
        }
      } catch {
        // Exchange unavailable — fall through to static fallback below
      }
    }

    // Fill any still-missing symbols with static data
    for (const sym of symbolsToFetch) {
      if (usdPrices[sym] === undefined) {
        const staticCoin = marketCoins.find(c => c.symbol === sym);
        usdPrices[sym] = staticCoin?.priceUSD ?? 0;
      }
    }
  }

  // --- 3. Convert USD prices to target fiat ---
  if (targetCurrency.toUpperCase() === 'USD') {
    return usdPrices;
  }

  const fiatRate = await getFiatRate(targetCurrency);
  const result: Record<string, number> = {};
  for (const [sym, price] of Object.entries(usdPrices)) {
    result[sym] = price * fiatRate;
  }
  return result;
}

/**
 * Fetches live 24-hour price change percentages for a list of symbols from Binance.
 * Falls back to static data if the exchange is unavailable.
 */
export async function getLive24hChanges(
  symbols: string[]
): Promise<Record<string, number>> {
  const exchange = getExchangeInstance();
  const result: Record<string, number> = {};

  try {
    const pairs = symbols.filter(s => s !== 'USDT').map(s => `${s}/USDT`);
    if (pairs.length === 0) return result;
    const tickers = await exchange.fetchTickers(pairs);

    for (const [pair, ticker] of Object.entries(tickers)) {
      const sym = pair.split('/')[0];
      if (ticker?.percentage !== undefined && ticker.percentage !== null) {
        result[sym] = parseFloat(ticker.percentage.toFixed(2));
      }
    }
  } catch {
    // Fall back to static data
  }

  // Fill missing with static fallback
  for (const sym of symbols) {
    if (result[sym] === undefined) {
      const staticCoin = marketCoins.find(c => c.symbol === sym);
      result[sym] = staticCoin?.change24h ?? 0;
    }
  }

  result['USDT'] = 0.01;
  return result;
}
