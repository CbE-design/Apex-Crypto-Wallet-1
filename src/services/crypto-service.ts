
'use server';

import * as ccxt from 'ccxt';
import { marketCoins } from '@/lib/data';

/**
 * @fileOverview A service for fetching cryptocurrency data using the ccxt library.
 *
 * - getLivePrices - Fetches the current prices for a list of cryptocurrencies against a target fiat currency.
 */

function getExchangeInstance() {
    const exchangeId = 'binance' as keyof typeof ccxt.exchanges; // Using a reliable default
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

    if (!exchange) {
        console.warn("CCXT exchange not initialized, falling back to static data.");
        return getStaticPrices(symbols, targetCurrency);
    }

    try {
        // 1. Fetch all crypto prices against USD first.
        const usdPairs = symbols.map(s => `${s}/USDT`);
        const usdTickers = await exchange.fetchTickers(usdPairs);
        const usdPrices: Record<string, number> = {};

        for (const symbol in usdTickers) {
            const originalSymbol = symbol.split('/')[0];
            if (usdTickers[symbol]?.last) {
                usdPrices[originalSymbol] = usdTickers[symbol]!.last!;
            }
        }
        
        // Fill any missing USD prices from static data.
        symbols.forEach(s => {
            if (!usdPrices[s]) {
                const staticCoin = marketCoins.find(c => c.symbol === s);
                if (staticCoin) {
                    usdPrices[s] = staticCoin.priceUSD;
                }
            }
        });

        // 2. If target is USD, we are done.
        if (isUsdTarget) {
            return usdPrices;
        }

        // 3. If target is not USD, get the conversion rate for the target currency.
        let usdToTargetRate = 1;
        try {
            // We need to find a pair that gives us the target currency's value in USD.
            // e.g., for EUR, we fetch EUR/USDT.
            const targetRateTicker = await exchange.fetchTicker(`${targetCurrency.toUpperCase()}/USDT`);
            if (targetRateTicker && targetRateTicker.last) {
                 usdToTargetRate = 1 / targetRateTicker.last; // If 1 EUR = 1.07 USDT, then 1 USDT = 1/1.07 EUR
            } else {
                 console.warn(`Could not fetch direct rate for ${targetCurrency}/USDT. Currency conversion may be inaccurate.`);
            }
        } catch (rateError) {
             console.error(`Could not fetch conversion rate for ${targetCurrency}. Falling back.`, rateError);
        }
        
        // 4. Convert all USD prices to the target currency.
        const targetPrices: Record<string, number> = {};
        for (const symbol in usdPrices) {
            targetPrices[symbol] = usdPrices[symbol] * usdToTargetRate;
        }

        return targetPrices;

    } catch (error) {
        console.error(`Error fetching live crypto prices with ccxt, falling back to static.`, error);
        return getStaticPrices(symbols, targetCurrency);
    }
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
