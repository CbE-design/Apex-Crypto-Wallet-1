import { NextRequest, NextResponse } from 'next/server';
import { marketCoins } from '@/lib/data';

const COINGECKO_IDS: Record<string, string> = {
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

interface CacheEntry {
  data: { prices: Record<string, number>; changes: Record<string, number> };
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000;

function staticFallback(symbols: string[], currency: string): { prices: Record<string, number>; changes: Record<string, number> } {
  const prices: Record<string, number> = {};
  const changes: Record<string, number> = {};
  for (const sym of symbols) {
    const coin = marketCoins.find(c => c.symbol === sym);
    prices[sym] = coin?.priceUSD ?? 0;
    changes[sym] = coin?.change24h ?? 0;
  }
  if (currency !== 'USD') {
    const FALLBACK_RATES: Record<string, number> = {
      EUR: 0.92, GBP: 0.79, ZAR: 18.62, AUD: 1.53, CAD: 1.36,
      JPY: 149.50, CHF: 0.90, CNY: 7.24, INR: 83.10, NGN: 1580.00,
      BRL: 4.97, MXN: 17.15, SGD: 1.34, HKD: 7.82, NZD: 1.63,
      SEK: 10.45, NOK: 10.52, DKK: 6.87, PLN: 3.95,
    };
    const rate = FALLBACK_RATES[currency] ?? 1;
    for (const sym of symbols) {
      prices[sym] = (prices[sym] ?? 0) * rate;
    }
  }
  return { prices, changes };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawSymbols = searchParams.get('symbols') ?? '';
  const currency = (searchParams.get('currency') ?? 'USD').toUpperCase();

  const symbols = rawSymbols
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ prices: {}, changes: {} });
  }

  const cacheKey = `${symbols.sort().join(',')}|${currency}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  const stableSymbols = symbols.filter(s => s === 'USDT' || s === 'USDC');
  const cryptoSymbols = symbols.filter(s => s !== 'USDT' && s !== 'USDC');

  const ids = cryptoSymbols
    .map(s => COINGECKO_IDS[s])
    .filter(Boolean)
    .join(',');

  const prices: Record<string, number> = {};
  const changes: Record<string, number> = {};

  stableSymbols.forEach(s => { prices[s] = 1; changes[s] = 0.01; });

  const unmappedSymbols = cryptoSymbols.filter(s => !COINGECKO_IDS[s]);
  for (const sym of unmappedSymbols) {
    const coin = marketCoins.find(c => c.symbol === sym);
    prices[sym] = coin?.priceUSD ?? 0;
    changes[sym] = coin?.change24h ?? 0;
  }

  if (ids) {
    const cur = currency.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${cur},usd&include_24hr_change=true&precision=8`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });

      if (res.ok) {
        const json = await res.json() as Record<string, Record<string, number>>;

        for (const sym of cryptoSymbols) {
          const id = COINGECKO_IDS[sym];
          if (!id || !json[id]) continue;
          const entry = json[id];
          prices[sym] = entry[cur] ?? entry['usd'] ?? 0;
          changes[sym] = entry[`${cur}_24h_change`] ?? entry['usd_24h_change'] ?? 0;
        }
      } else {
        const fb = staticFallback(cryptoSymbols, currency);
        Object.assign(prices, fb.prices);
        Object.assign(changes, fb.changes);
      }
    } catch {
      const fb = staticFallback(cryptoSymbols, currency);
      Object.assign(prices, fb.prices);
      Object.assign(changes, fb.changes);
    }
  }

  const data = { prices, changes };
  responseCache.set(cacheKey, { data, timestamp: Date.now() });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
