
'use server';

import * as ccxt from 'ccxt';
import { marketCoins } from '@/lib/data';

/**
 * @fileOverview A service for fetching cryptocurrency data using the ccxt library.
 *
 * - getLivePrices - Fetches the current prices for a list of cryptocurrencies against a target fiat currency.
 */

// Simple in-memory cache
const cache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

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
 * Fetches the current price for a list of given cryptocurrency symbols against a target fiat currency.
 * Uses USD as a base for cross-currency conversions to ensure reliability.
 * @param symbols - An array of cryptocurrency symbols (e.g., ['BTC', 'ETH']).
 * @param targetCurrency - The fiat currency to get the price in (e.g., 'USD', 'EUR'). Defaults to 'USD'.
 * @returns A promise that resolves to a record mapping symbols to their prices in the target currency.
 */
export async function getLivePrices(symbols: string[], targetCurrency: string = 'USD'): Promise<Record<string, number>> {
    const exchange = getExchangeInstance();
    const isUsdTarget = targetCurrency.toUpperCase() === 'USD';
    
    const symbolsToFetch: string[] = [];
    const cachedPrices: Record<string, number> = {};

    // Check cache first
    for (const symbol of symbols) {
        const cacheKey = `${symbol}-USD`;
        const cached = cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            cachedPrices[symbol] = cached.price;
        } else {
            symbolsToFetch.push(symbol);
        }
    }
    
    if (symbolsToFetch.length === 0) {
        return convertPrices(cachedPrices, targetCurrency, exchange);
    }

    if (!exchange) {
        return getStaticPrices(symbols, targetCurrency);
    }

    try {
        // 1. Fetch all crypto prices against USD first.
        const usdPairs = symbolsToFetch.map(s => `${s}/USDT`);
        const usdTickers = await exchange.fetchTickers(usdPairs);
        const fetchedUsdPrices: Record<string, number> = {};

        for (const symbol in usdTickers) {
            const originalSymbol = symbol.split('/')[0];
            if (usdTickers[symbol]?.last) {
                fetchedUsdPrices[originalSymbol] = usdTickers[symbol]!.last!;
                // Update cache
                cache.set(`${originalSymbol}-USD`, { price: fetchedUsdPrices[originalSymbol], timestamp: Date.now() });
            }
        }
        
        // Fill any missing USD prices from static data.
        symbolsToFetch.forEach(s => {
            if (!fetchedUsdPrices[s]) {
                const staticCoin = marketCoins.find(c => c.symbol === s);
                if (staticCoin) {
                    fetchedUsdPrices[s] = staticCoin.priceUSD;
                }
            }
        });
        
        const allUsdPrices = { ...cachedPrices, ...fetchedUsdPrices };

        return convertPrices(allUsdPrices, targetCurrency, exchange);

    } catch (error) {
        return getStaticPrices(symbols, targetCurrency);
    }
}

async function convertPrices(usdPrices: Record<string, number>, targetCurrency: string, exchange: ccxt.Exchange) {
    if (targetCurrency.toUpperCase() === 'USD') {
        return usdPrices;
    }

    const rateCacheKey = `USD-${targetCurrency}`;
    const cachedRate = cache.get(rateCacheKey);

    let usdToTargetRate = 1;
    if (cachedRate && (Date.now() - cachedRate.timestamp < CACHE_TTL)) {
        usdToTargetRate = cachedRate.price;
    } else {
        try {
            const targetRateTicker = await exchange.fetchTicker(`${targetCurrency.toUpperCase()}/USDT`);
            if (targetRateTicker && targetRateTicker.last) {
                usdToTargetRate = 1 / targetRateTicker.last;
                 cache.set(rateCacheKey, { price: usdToTargetRate, timestamp: Date.now() });
            }
        } catch (rateError) {
             // Silently handle rate error and fallback to 1
        }
    }

    const targetPrices: Record<string, number> = {};
    for (const symbol in usdPrices) {
        targetPrices[symbol] = usdPrices[symbol] * usdToTargetRate;
    }

    return targetPrices;
}


/**
 * A fallback function to get prices from the static data file.
 * NOTE: This only works accurately for USD. For other currencies, it returns 0.
 */
function getStaticPrices(symbols: string[], targetCurrency: string = 'USD'): Record<string, number> {
    const isUsd = targetCurrency.toUpperCase() === 'USD';

    return symbols.reduce((acc, symbol) => {
        const coin = marketCoins.find(c => c.symbol === symbol);
        if (coin) {
            acc[symbol] = isUsd ? coin.priceUSD : 0; 
        } else {
            acc[symbol] = 0;
        }
        return acc;
    }, {} as Record<string, number>);
}
