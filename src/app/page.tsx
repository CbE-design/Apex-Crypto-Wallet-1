import { Header } from '@/components/header';
import { PortfolioOverview } from '@/components/dashboard/portfolio-overview';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { BuySellCard } from '@/components/dashboard/buy-sell-card';
import { TransactionHistory } from '@/components/dashboard/transaction-history';
import { PriceAlerts } from '@/components/dashboard/price-alerts';
import { AppSidebar } from '@/components/sidebar';
import { Sidebar, SidebarInset } from '@/components/ui/sidebar';

export default function DashboardPage() {
  return (
    <div className="flex h-full bg-background">
      <Sidebar>
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col h-full">
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
              </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </div>
  );
}
