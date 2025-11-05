
import { PortfolioOverview } from '@/components/dashboard/portfolio-overview';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { TransactionHistory } from '@/components/dashboard/transaction-history';
import { PriceAlerts } from '@/components/dashboard/price-alerts';
import { PrivateRoute } from '@/components/private-route';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  return (
    <PrivateRoute>
      <div className="space-y-6">
        <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50 text-yellow-200 [&>svg]:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>System Maintenance</AlertTitle>
            <AlertDescription>
                The Apex Crypto Wallet App is currently undergoing maintenance. We apologize for any inconvenience caused during this time.
            </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-8 space-y-6">
            <PortfolioOverview />
            <TransactionHistory />
            </div>
            <div className="col-span-12 xl:col-span-4 space-y-6">
            <MarketOverview />
            <PriceAlerts />
            </div>
        </div>
      </div>
    </PrivateRoute>
  );
}
