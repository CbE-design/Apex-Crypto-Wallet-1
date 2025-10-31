
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboardPage() {
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
                        <p>This is the central control panel for Apex Crypto Wallet. From here, you can manage users, monitor application health, and view system-wide analytics.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
