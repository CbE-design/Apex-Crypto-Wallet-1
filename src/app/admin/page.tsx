
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Users, Bell, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 'Not Set';

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, Admin!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-muted-foreground">This is the central control panel for Apex Crypto Wallet. Use the links below to manage your application.</p>
                    
                    <div className="flex items-center space-x-3 rounded-lg border border-dashed border-primary/50 p-4">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                        <div>
                            <h3 className="font-semibold">Configured Admin Wallet</h3>
                            <p className="text-sm text-muted-foreground font-mono">{adminAddress}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Jump directly to key management areas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Link href="/admin/user-management" passHref>
                        <Button className="w-full justify-between" variant="outline" asChild>
                           <a>
                                <div className="flex items-center gap-2">
                                    <Users />
                                    Manage Users
                                </div>
                                <ArrowRight />
                           </a>
                        </Button>
                    </Link>
                    <Link href="/admin/notification-center" passHref>
                        <Button className="w-full justify-between" variant="outline" asChild>
                            <a>
                                <div className="flex items-center gap-2">
                                    <Bell />
                                    Send Notifications
                                </div>
                                <ArrowRight />
                            </a>
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
