
'use server';

import { marketCoins } from '@/lib/data';

// A map to convert asset symbols to CoinGecko API IDs
const symbolToCoinGeckoId: { [key: string]: string } = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    DOGE: 'dogecoin',
    BNB: 'binancecoin',
    XRP: 'ripple',
    ADA: 'cardano',
};


/**
 * @fileOverview A service for fetching cryptocurrency data from external APIs.
 *
 * - getLivePrices - Fetches the current USD price for a list of cryptocurrencies.
 */

/**
 * Fetches the current USD price for a list of given cryptocurrency symbols.
 * @param symbols - An array of cryptocurrency symbols (e.g., ['BTC', 'ETH']).
 * @returns A promise that resolves to a record mapping symbols to their USD prices.
 */
export async function getLivePrices(symbols: string[]): Promise<Record<string, number>> {
    const coingeckoIds = symbols.map(symbol => symbolToCoinGeckoId[symbol]).filter(Boolean);

    if (coingeckoIds.length === 0) {
        console.warn('No valid CoinGecko IDs found for the given symbols.');
        return {};
    }

    const idsParam = coingeckoIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API request failed with status ${response.status}`);
        }
        const data = await response.json();
        
        // Map the response back from CoinGecko IDs to our symbols
        const prices: Record<string, number> = {};
        for (const symbol of symbols) {
            const coingeckoId = symbolToCoinGeckoId[symbol];
            if (coingeckoId && data[coingeckoId] && data[coingeckoId].usd) {
                prices[symbol] = data[coingeckoId].usd;
            }
        }
        return prices;
    } catch (error) {
        console.error('Error fetching live crypto prices:', error);
        // As a fallback, return static prices on error
        return symbols.reduce((acc, symbol) => {
            const coin = marketCoins.find(c => c.symbol === symbol);
            if (coin) {
                acc[symbol] = coin.priceUSD;
            }
            return acc;
        }, {} as Record<string, number>);
    }
}
