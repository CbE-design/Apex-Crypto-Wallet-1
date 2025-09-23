export interface PortfolioAsset {
  symbol: string;
  name: string;
  amount: number;
  valueUSD: number;
  priceUSD: number;
  change24h: number;
  icon: string;
}

export interface MarketCoin {
  symbol: string;
  name: string;
  priceUSD: number;
  change24h: number;
  marketCap: number;
  icon: string;
}

export interface Transaction {
  id: string;
  type: 'Buy' | 'Sell';
  asset: string;
  amount: number;
  valueUSD: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Failed';
}

export interface PriceAlert {
  id: string;
  asset: string;
  targetPrice: number;
  type: 'Above' | 'Below';
  status: 'Active' | 'Triggered';
  icon: string;
}
