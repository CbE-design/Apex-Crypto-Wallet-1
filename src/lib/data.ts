
import type { PortfolioAsset, MarketCoin, Transaction, PriceAlert } from '@/lib/types';

export const portfolioAssets: PortfolioAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin',   amount: 0, valueUSD: 0, priceUSD: 82000.00, change24h: 1.4,  icon: 'Bitcoin'   },
  { symbol: 'ETH', name: 'Ethereum',  amount: 0, valueUSD: 0, priceUSD: 2000.00,  change24h: -0.8, icon: 'Ethereum'  },
  { symbol: 'LINK', name: 'Chainlink',amount: 0, valueUSD: 0, priceUSD: 14.50,    change24h: 2.3,  icon: 'Chainlink' },
  { symbol: 'SOL', name: 'Solana',    amount: 0, valueUSD: 0, priceUSD: 130.00,   change24h: 3.7,  icon: 'Solana'    },
  { symbol: 'DOGE', name: 'Dogecoin', amount: 0, valueUSD: 0, priceUSD: 0.17,     change24h: 0.9,  icon: 'Dogecoin'  },
];

export const marketCoins: MarketCoin[] = [
  { symbol: 'BTC',  name: 'Bitcoin',  priceUSD: 82000.00, change24h: 1.4,  marketCap: 1620e9, icon: 'Bitcoin'   },
  { symbol: 'ETH',  name: 'Ethereum', priceUSD: 2000.00,  change24h: -0.8, marketCap: 240e9,  icon: 'Ethereum'  },
  { symbol: 'LINK', name: 'Chainlink',priceUSD: 14.50,    change24h: 2.3,  marketCap: 8.5e9,  icon: 'Chainlink' },
  { symbol: 'SOL',  name: 'Solana',   priceUSD: 130.00,   change24h: 3.7,  marketCap: 62e9,   icon: 'Solana'    },
  { symbol: 'BNB',  name: 'BNB',      priceUSD: 580.00,   change24h: 0.6,  marketCap: 84e9,   icon: 'Bnb'       },
  { symbol: 'XRP',  name: 'XRP',      priceUSD: 0.52,     change24h: -1.2, marketCap: 30e9,   icon: 'Xrp'       },
  { symbol: 'ADA',  name: 'Cardano',  priceUSD: 0.70,     change24h: 4.1,  marketCap: 25e9,   icon: 'Cardano'   },
  { symbol: 'USDT', name: 'Tether',   priceUSD: 1.00,     change24h: 0.01, marketCap: 118e9,  icon: 'Tether'    },
  { symbol: 'DOGE', name: 'Dogecoin', priceUSD: 0.17,     change24h: 0.9,  marketCap: 25e9,   icon: 'Dogecoin'  },
];

export const transactions: Transaction[] = [];

export const priceAlerts: PriceAlert[] = [];
