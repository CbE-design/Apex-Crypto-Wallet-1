import { PortfolioOverview } from '@/components/dashboard/portfolio-overview';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { BuySellCard } from '@/components/dashboard/buy-sell-card';
import { TransactionHistory } from '@/components/dashboard/transaction-history';
import { PriceAlerts } from '@/components/dashboard/price-alerts';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 xl:col-span-8 space-y-6">
        <PortfolioOverview />
        <TransactionHistory />
      </div>
      <div className="col-span-12 xl:col-span-4 space-y-6">
        <BuySellCard />
        <MarketOverview />
        <PriceAlerts />
      </div>
    </div>
  );
}
