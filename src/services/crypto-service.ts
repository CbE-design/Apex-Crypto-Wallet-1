
'use server';

import * as ccxt from 'ccxt';
import { marketCoins } from '@/lib/data';

/**
 * @fileOverview A service for fetching cryptocurrency data using the ccxt library.
 *
 * - getLivePrices - Fetches the current prices for a list of cryptocurrencies against a target fiat currency.
 */

function getExchangeInstance() {
    const exchangeId = process.env.EXCHANGE_ID as keyof typeof ccxt.exchanges;
    if (!exchangeId || !(exchangeId in ccxt.exchanges)) {
        console.warn(`Exchange ID "${process.env.EXCHANGE_ID}" is not valid or not set. Falling back to static data.`);
        return null;
    }

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
 * @param symbols - An array of cryptocurrency symbols (e.g., ['BTC', 'ETH']).
 * @param targetCurrency - The fiat currency to get the price in (e.g., 'USD', 'ZAR'). Defaults to 'USD'.
 * @returns A promise that resolves to a record mapping symbols to their prices in the target currency.
 */
export async function getLivePrices(symbols: string[], targetCurrency: string = 'USD'): Promise<Record<string, number>> {
    const exchange = getExchangeInstance();
    const isUsd = targetCurrency.toUpperCase() === 'USD';

    // If the exchange isn't configured, or if we need USD (which is in our static data), use static as a fallback.
    if (!exchange) {
        console.warn("CCXT exchange not initialized, falling back to static data.");
        return getStaticPrices(symbols, targetCurrency);
    }
    
    try {
        const pairs = symbols.map(s => `${s}/${targetCurrency.toUpperCase()}`);
        const tickers = await exchange.fetchTickers(pairs);
        
        const prices: Record<string, number> = {};
        for (const symbol in tickers) {
            const originalSymbol = symbol.split('/')[0];
            if (tickers[symbol]?.last) {
                prices[originalSymbol] = tickers[symbol]!.last!;
            }
        }

        // Fill any missing prices with static data as a fallback
        symbols.forEach(s => {
            if (!prices[s]) {
                const staticCoin = marketCoins.find(c => c.symbol === s);
                if (staticCoin) {
                     // If we couldn't get a direct pair, calculate from USD static price
                    prices[s] = isUsd ? staticCoin.priceUSD : 0; // Cannot calculate for non-USD without a USD rate for the target
                }
            }
        });

        return prices;
    } catch (error) {
        console.error(`Error fetching live crypto prices for ${targetCurrency} with ccxt:`, error);
        // On critical error, fall back entirely to static data
        return getStaticPrices(symbols, targetCurrency);
    }
}


/**
 * A fallback function to get prices from the static data file.
 * NOTE: This only works accurately for USD. For other currencies, it would need a USD-to-Target rate.
 * For this implementation, we will assume non-USD fallbacks result in 0.
 */
function getStaticPrices(symbols: string[], targetCurrency: string = 'USD'): Record<string, number> {
    const isUsd = targetCurrency.toUpperCase() === 'USD';

    return symbols.reduce((acc, symbol) => {
        const coin = marketCoins.find(c => c.symbol === symbol);
        if (coin) {
            // Only return a price if the target is USD, as we can't do static conversion.
            acc[symbol] = isUsd ? coin.priceUSD : 0; 
        } else {
            acc[symbol] = 0; // Default to 0 if not found
        }
        return acc;
    }, {} as Record<string, number>);
}
