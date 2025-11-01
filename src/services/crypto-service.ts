
'use server';

import * as ccxt from 'ccxt';
import { marketCoins } from '@/lib/data';

/**
 * @fileOverview A service for fetching cryptocurrency data using the ccxt library.
 *
 * - getLivePrices - Fetches the current USD price for a list of cryptocurrencies.
 */

// This function initializes the ccxt exchange instance with credentials from environment variables.
// It's kept separate to be reusable for other functions like creating orders.
function getExchangeInstance() {
    const exchangeId = process.env.EXCHANGE_ID as keyof typeof ccxt.exchanges;
    if (!exchangeId || !ccxt.exchanges.includes(exchangeId)) {
        // Return null instead of throwing an error to allow fallback to static data
        console.warn(`Exchange ID "${process.env.EXCHANGE_ID}" is not valid or not set. Falling back to static data.`);
        return null;
    }

    const exchangeClass = ccxt[exchangeId];
    const exchange = new exchangeClass({
        apiKey: process.env.EXCHANGE_API_KEY,
        secret: process.env.EXCHANGE_API_SECRET,
    });

    // Enable sandbox mode if the exchange supports it and if it's configured in .env
    if (process.env.EXCHANGE_SANDBOX_MODE === 'true' && exchange.has['sandbox']) {
        exchange.setSandboxMode(true);
    }

    return exchange;
}

/**
 * Fetches the current USD price for a list of given cryptocurrency symbols.
 * @param symbols - An array of cryptocurrency symbols (e.g., ['BTC', 'ETH']).
 * @returns A promise that resolves to a record mapping symbols to their USD prices.
 */
export async function getLivePrices(symbols: string[]): Promise<Record<string, number>> {
    const exchange = getExchangeInstance();

    // If the exchange isn't configured, fall back to static data immediately.
    if (!exchange) {
        return symbols.reduce((acc, symbol) => {
            const coin = marketCoins.find(c => c.symbol === symbol);
            acc[symbol] = coin ? coin.priceUSD : 0;
            return acc;
        }, {} as Record<string, number>);
    }
    
    try {
        const tickers = await exchange.fetchTickers(symbols.map(s => `${s}/USDT`));
        
        const prices: Record<string, number> = {};
        for (const symbol in tickers) {
            const originalSymbol = symbol.replace('/USDT', '');
            if (tickers[symbol]?.last) {
                prices[originalSymbol] = tickers[symbol]!.last!;
            }
        }

        // Fill any missing prices with static data as a fallback
        symbols.forEach(s => {
            if (!prices[s]) {
                const staticCoin = marketCoins.find(c => c.symbol === s);
                if (staticCoin) {
                    prices[s] = staticCoin.priceUSD;
                }
            }
        });

        return prices;
    } catch (error) {
        console.error('Error fetching live crypto prices with ccxt:', error);
        // On critical error, fall back entirely to static data
        return symbols.reduce((acc, symbol) => {
            const coin = marketCoins.find(c => c.symbol === symbol);
            if (coin) {
                acc[symbol] = coin.priceUSD;
            } else {
                acc[symbol] = 0; // Default to 0 if not found
            }
            return acc;
        }, {} as Record<string, number>);
    }
}
