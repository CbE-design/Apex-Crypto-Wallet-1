
import type { PortfolioAsset, MarketCoin, Transaction, PriceAlert } from '@/lib/types';

export const portfolioAssets: PortfolioAsset[] = [
  { symbol: 'ETH', name: 'Ethereum', amount: 0, valueUSD: 0, priceUSD: 3500.00, change24h: -1.2, icon: 'Ethereum' },
  { symbol: 'LINK', name: 'Chainlink', amount: 0, valueUSD: 0, priceUSD: 18.00, change24h: 3.8, icon: 'Chainlink' },
  { symbol: 'SOL', name: 'Solana', amount: 0, valueUSD: 0, priceUSD: 160.00, change24h: 5.1, icon: 'Solana' },
  { symbol: 'DOGE', name: 'Dogecoin', amount: 0, valueUSD: 0, priceUSD: 0.15, change24h: 0.5, icon: 'Dogecoin' },
];

export const marketCoins: MarketCoin[] = [
  { symbol: 'ETH', name: 'Ethereum', priceUSD: 3500.00, change24h: -1.2, marketCap: 420e9, icon: 'Ethereum' },
  { symbol: 'LINK', name: 'Chainlink', priceUSD: 18.00, change24h: 3.8, marketCap: 10.5e9, icon: 'Chainlink' },
  { symbol: 'SOL', name: 'Solana', priceUSD: 160.00, change24h: 5.1, marketCap: 73e9, icon: 'Solana' },
  { symbol: 'BNB', name: 'BNB', priceUSD: 600.00, change24h: 1.8, marketCap: 88e9, icon: 'Bnb' },
  { symbol: 'XRP', name: 'XRP', priceUSD: 0.52, change24h: -0.8, marketCap: 28e9, icon: 'Xrp' },
  { symbol: 'ADA', name: 'Cardano', priceUSD: 0.45, change24h: 3.2, marketCap: 16e9, icon: 'Cardano' },
];

export const transactions: Transaction[] = [];

export const priceAlerts: PriceAlert[] = [];
