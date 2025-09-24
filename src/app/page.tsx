import { PortfolioOverview } from '@/components/dashboard/portfolio-overview';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { BuySellCard } from '@/components/dashboard/buy-sell-card';
import { TransactionHistory } from '@/components/dashboard/transaction-history';
import { PriceAlerts } from '@/components/dashboard/price-alerts';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <PortfolioOverview />
        <BuySellCard />
        <TransactionHistory />
      </div>
      <div className="lg:col-span-1 space-y-6">
        <MarketOverview />
        <PriceAlerts />
      </div>
    </div>
  );
}
