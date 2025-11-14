
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Users, Bell, ArrowRight, DollarSign, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';

export default function AdminDashboardPage() {
  const { user } = useWallet();
  const firestore = useFirestore();

  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 'Not Set';

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);
  const adminBalance = ethWallet?.balance ?? 0;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground">Central control panel for Apex Crypto Wallet.</p>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Welcome, Admin!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">Use the tools below to manage users and system settings.</p>
                    <div className="flex items-center space-x-3 rounded-lg border border-dashed border-primary/50 p-4">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                        <div>
                            <h3 className="font-semibold">Configured Admin Wallet</h3>
                            <p className="text-sm text-muted-foreground font-mono break-all">{adminAddress}</p>
                        </div>
                    </div>
                     <div className="flex items-center space-x-3 rounded-lg border border-dashed p-4">
                        <Wallet className="h-8 w-8 text-blue-400" />
                        <div>
                            <h3 className="font-semibold">Your Current Balance</h3>
                            <p className="text-sm flex items-center gap-2">
                                <CryptoIcon name="Ethereum" className="h-4 w-4" /> 
                                <span className="font-mono">{adminBalance.toFixed(6)} ETH</span>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Jump directly to key areas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Link href="/admin/direct-send">
                        <Button className="w-full justify-between" variant="outline">
                            <div className="flex items-center gap-2">
                                <DollarSign />
                                Direct Send
                            </div>
                            <ArrowRight />
                        </Button>
                    </Link>
                     <Link href="/admin/notification-center">
                        <Button className="w-full justify-between" variant="outline">
                            <div className="flex items-center gap-2">
                                <Bell />
                                Notification Center
                            </div>
                            <ArrowRight />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
