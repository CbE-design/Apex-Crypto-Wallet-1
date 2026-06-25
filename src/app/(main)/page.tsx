
import { PortfolioOverview } from '@/components/dashboard/portfolio-overview';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { TransactionHistory } from '@/components/dashboard/transaction-history';
import { PriceAlerts } from '@/components/dashboard/price-alerts';
import { KpiStrip } from '@/components/dashboard/kpi-strip';
import { PrivateRoute } from '@/components/private-route';

export default function DashboardPage() {
  return (
    <PrivateRoute>
      <div className="space-y-4">
        {/* KPI strip */}
        <KpiStrip />

        {/* Main 2-column grid */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-7">
            <PortfolioOverview />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <MarketOverview />
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8">
            <TransactionHistory />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <PriceAlerts />
          </div>
        </div>
      </div>
    </PrivateRoute>
  );
}
