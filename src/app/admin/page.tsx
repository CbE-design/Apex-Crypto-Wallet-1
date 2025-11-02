
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

export default function AdminDashboardPage() {
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 'Not Set';

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12">
                <Card>
                    <CardHeader>
                        <CardTitle>Welcome, Admin!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">This is the central control panel for Apex Crypto Wallet. From here, you can manage users, monitor application health, and view system-wide analytics.</p>
                        
                        <div className="flex items-center space-x-3 rounded-lg border border-dashed border-primary/50 p-4">
                            <ShieldCheck className="h-8 w-8 text-primary" />
                            <div>
                                <h3 className="font-semibold">Configured Admin Wallet</h3>
                                <p className="text-sm text-muted-foreground font-mono">{adminAddress}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
