import type { PortfolioAsset, MarketCoin, Transaction, PriceAlert } from '@/lib/types';

export const portfolioAssets: PortfolioAsset[] = [
  { symbol: 'ETH', name: 'Ethereum', amount: 10, valueUSD: 35000.00, priceUSD: 3500.00, change24h: -1.2, icon: 'Ethereum' },
  { symbol: 'LINK', name: 'Chainlink', amount: 1500, valueUSD: 27000.00, priceUSD: 18.00, change24h: 3.8, icon: 'Chainlink' },
  { symbol: 'SOL', name: 'Solana', amount: 150, valueUSD: 24000.00, priceUSD: 160.00, change24h: 5.1, icon: 'Solana' },
  { symbol: 'DOGE', name: 'Dogecoin', amount: 100000, valueUSD: 15000.00, priceUSD: 0.15, change24h: 0.5, icon: 'Dogecoin' },
];

export const marketCoins: MarketCoin[] = [
  { symbol: 'ETH', name: 'Ethereum', priceUSD: 3500.00, change24h: -1.2, marketCap: 420e9, icon: 'Ethereum' },
  { symbol: 'LINK', name: 'Chainlink', priceUSD: 18.00, change24h: 3.8, marketCap: 10.5e9, icon: 'Chainlink' },
  { symbol: 'SOL', name: 'Solana', priceUSD: 160.00, change24h: 5.1, marketCap: 73e9, icon: 'Solana' },
  { symbol: 'BNB', name: 'BNB', priceUSD: 600.00, change24h: 1.8, marketCap: 88e9, icon: 'Bnb' },
  { symbol: 'XRP', name: 'XRP', priceUSD: 0.52, change24h: -0.8, marketCap: 28e9, icon: 'Xrp' },
  { symbol: 'ADA', name: 'Cardano', priceUSD: 0.45, change24h: 3.2, marketCap: 16e9, icon: 'Cardano' },
];

export const transactions: Transaction[] = [
  { id: '1', type: 'Buy', asset: 'LINK', amount: 100, valueUSD: 1800, date: '2024-05-20', status: 'Completed' },
  { id: '2', type: 'Sell', asset: 'ETH', amount: 2, valueUSD: 7000, date: '2024-05-18', status: 'Completed' },
  { id: '3', type: 'Buy', asset: 'SOL', amount: 50, valueUSD: 8000, date: '2024-05-15', status: 'Completed' },
  { id: '4', type: 'Buy', asset: 'DOGE', amount: 20000, valueUSD: 3000, date: '2024-05-12', status: 'Pending' },
];

export const priceAlerts: PriceAlert[] = [
  { id: '1', asset: 'ETH', targetPrice: 4000, type: 'Above', status: 'Active', icon: 'Ethereum' },
  { id: '2', asset: 'LINK', targetPrice: 15, type: 'Below', status: 'Triggered', icon: 'Chainlink' },
];
