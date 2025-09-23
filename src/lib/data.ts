import type { PortfolioAsset, MarketCoin, Transaction, PriceAlert } from '@/lib/types';

export const portfolioAssets: PortfolioAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', amount: 0.5, valueUSD: 34500.00, priceUSD: 69000.00, change24h: 2.5, icon: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', amount: 10, valueUSD: 35000.00, priceUSD: 3500.00, change24h: -1.2, icon: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana', amount: 150, valueUSD: 24000.00, priceUSD: 160.00, change24h: 5.1, icon: 'Solana' },
  { symbol: 'DOGE', name: 'Dogecoin', amount: 100000, valueUSD: 15000.00, priceUSD: 0.15, change24h: 0.5, icon: 'Dogecoin' },
];

export const marketCoins: MarketCoin[] = [
  { symbol: 'BTC', name: 'Bitcoin', priceUSD: 69000.00, change24h: 2.5, marketCap: 1.3e12, icon: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', priceUSD: 3500.00, change24h: -1.2, marketCap: 420e9, icon: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana', priceUSD: 160.00, change24h: 5.1, marketCap: 73e9, icon: 'Solana' },
  { symbol: 'BNB', name: 'BNB', priceUSD: 600.00, change24h: 1.8, marketCap: 88e9, icon: 'Bnb' },
  { symbol: 'XRP', name: 'XRP', priceUSD: 0.52, change24h: -0.8, marketCap: 28e9, icon: 'Xrp' },
  { symbol: 'ADA', name: 'Cardano', priceUSD: 0.45, change24h: 3.2, marketCap: 16e9, icon: 'Cardano' },
];

export const transactions: Transaction[] = [
  { id: '1', type: 'Buy', asset: 'BTC', amount: 0.1, valueUSD: 6900, date: '2024-05-20', status: 'Completed' },
  { id: '2', type: 'Sell', asset: 'ETH', amount: 2, valueUSD: 7000, date: '2024-05-18', status: 'Completed' },
  { id: '3', type: 'Buy', asset: 'SOL', amount: 50, valueUSD: 8000, date: '2024-05-15', status: 'Completed' },
  { id: '4', type: 'Buy', asset: 'DOGE', amount: 20000, valueUSD: 3000, date: '2024-05-12', status: 'Pending' },
];

export const priceAlerts: PriceAlert[] = [
  { id: '1', asset: 'BTC', targetPrice: 70000, type: 'Above', status: 'Active', icon: 'Bitcoin' },
  { id: '2', asset: 'ETH', targetPrice: 3000, type: 'Below', status: 'Triggered', icon: 'Ethereum' },
];
