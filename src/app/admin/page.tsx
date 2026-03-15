
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowRight, DollarSign, Wallet, Activity, Server, Database, Globe } from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { useEffect, useState } from 'react';
import { getLedgerSyncStatus } from '@/services/ledger-sync-service';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardPage() {
  const { user } = useWallet();
  const firestore = useFirestore();
  const [syncStatus, setSyncStatus] = useState<any>(null);

  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 'Not Set';

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);
  const adminBalance = ethWallet?.balance ?? 0;

  useEffect(() => {
    getLedgerSyncStatus().then(setSyncStatus);
  }, []);

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Orchestration Terminal</h1>
                <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-[0.2em] text-blue-400">System Governance & Liquidity Control</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-module border-primary/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" /> System Pulse
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-white">{syncStatus?.status || 'Active'}</span>
                        <Badge className="bg-green-500/20 text-green-400 border-none h-5 px-1.5 uppercase text-[8px] font-black">99.9% Up</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono uppercase">Last Sync: {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleTimeString() : '---'}</p>
                </CardContent>
            </Card>

            <Card className="glass-module border-accent/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Database className="h-4 w-4 text-accent" /> Bridge Liquidity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">{syncStatus?.bridgeLiquidity || '1.2M USDC'}</div>
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold">Stables Reserved on Public Rail</p>
                </CardContent>
            </Card>

            <Card className="glass-module border-blue-400/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-400" /> Active Nodes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">14</div>
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold">Decentralized Validators Online</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 glass-module overflow-hidden">
                <CardHeader>
                    <CardTitle>Governance Console</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3 rounded-2xl border border-dashed border-primary/50 p-6 bg-primary/5">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                        <div>
                            <h3 className="font-bold uppercase tracking-tight text-sm">Configured Admin Identity</h3>
                            <p className="text-[10px] text-muted-foreground font-mono break-all mt-1">{adminAddress}</p>
                        </div>
                    </div>
                     <div className="flex items-center space-x-3 rounded-2xl border border-white/5 p-6 bg-white/5">
                        <Wallet className="h-8 w-8 text-blue-400" />
                        <div>
                            <h3 className="font-bold uppercase tracking-tight text-sm">System Reserve (ETH)</h3>
                            <p className="text-xl font-black italic mt-1 text-accent">
                                {adminBalance.toFixed(6)} ETH
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Card className="glass-module">
                <CardHeader>
                    <CardTitle>Control Rails</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Link href="/admin/direct-send">
                        <Button className="w-full justify-between h-14 rounded-xl bg-white/5 border-white/10 hover:bg-white/10" variant="ghost">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg"><DollarSign className="h-4 w-4" /></div>
                                <span className="text-xs font-black uppercase tracking-widest">Manual Funding</span>
                            </div>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
