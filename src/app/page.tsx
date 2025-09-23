import { Suspense } from 'react';
import { Header } from '@/components/header';
import { PortfolioOverview } from '@/components/dashboard/portfolio-overview';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { BuySellCard } from '@/components/dashboard/buy-sell-card';
import { TransactionHistory } from '@/components/dashboard/transaction-history';
import { PriceAlerts } from '@/components/dashboard/price-alerts';
import { NewsSummary } from '@/components/dashboard/news-summary';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <PortfolioOverview />
            <BuySellCard />
            <TransactionHistory />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <MarketOverview />
            <PriceAlerts />
            <Suspense fallback={<Skeleton className="h-64" />}>
              <NewsSummary />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
