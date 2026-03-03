
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { Copy, RefreshCw, CheckCircle2, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrivateRoute } from '@/components/private-route';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface WalletDoc {
    id: string;
    currency: string;
    balance: number;
    address: string;
    lastSynced?: any;
}

export default function MyWalletsPage() {
    const { user, syncWalletBalance } = useWallet();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const walletsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Query user's individual wallets
        return query(collection(firestore, 'users', user.uid, 'wallets'), orderBy('currency', 'asc'));
    }, [user, firestore]);

    const { data: wallets, isLoading } = useCollection<WalletDoc>(walletsQuery);

    const handleCopy = (address: string) => {
        navigator.clipboard.writeText(address);
        toast({ title: "Address Copied", description: "The wallet address has been copied to your clipboard." });
    };

    const handleSync = async (currency: string) => {
        setSyncingId(currency);
        try {
            await syncWalletBalance(currency);
        } catch (error: any) {
            console.error("Sync error:", error);
            toast({ title: "Sync Failed", description: "Could not connect to the blockchain explorer node.", variant: "destructive" });
        } finally {
            setSyncingId(null);
        }
    };

    const getChainType = (currency: string) => {
        if (['ETH', 'LINK', 'BNB', 'USDT'].includes(currency)) return 'Ethereum';
        if (currency === 'SOL') return 'Solana';
        if (currency === 'DOGE') return 'Dogecoin';
        if (currency === 'BTC') return 'Bitcoin';
        if (currency === 'ADA') return 'Cardano';
        if (currency === 'XRP') return 'Ripple';
        return 'Native Chain';
    }

    return (
        <PrivateRoute>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">My Wallets</h1>
                        <p className="text-muted-foreground">Manage your individual blockchain addresses and verify real-time balances.</p>
                    </div>
                    <Badge variant="secondary" className="w-fit h-fit px-3 py-1">
                        Total Assets: {wallets?.length || 0}
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        [...Array(6)].map((_, i) => (
                            <Card key={i} className="animate-pulse">
                                <CardHeader className="pb-2">
                                    <Skeleton className="h-6 w-32" />
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-4 w-2/3" />
                                </CardContent>
                            </Card>
                        ))
                    ) : wallets?.map((w) => (
                        <Card key={w.id} className="group hover:ring-1 hover:ring-primary/30 transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-2">
                                    <CryptoIcon name={w.currency} className="h-6 w-6" />
                                    <CardTitle className="text-lg font-bold">{w.currency}</CardTitle>
                                </div>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                    {getChainType(w.currency)}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">Deposit Address</p>
                                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md font-mono text-[11px] break-all relative border border-transparent group-hover:border-primary/20">
                                        <span className="truncate pr-8">{w.address}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 absolute right-1"
                                            onClick={() => handleCopy(w.address)}
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">Verified Balance</p>
                                    <p className="text-2xl font-bold font-headline">{w.balance.toFixed(6)} {w.currency}</p>
                                    {w.lastSynced && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Last synced: {w.lastSynced.toDate().toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="flex gap-2">
                                <Button 
                                    className="flex-1" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleSync(w.currency)}
                                    disabled={syncingId === w.currency}
                                >
                                    {syncingId === w.currency ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                                    ) : (
                                        <><RefreshCw className="mr-2 h-4 w-4" /> Sync with Blockchain</>
                                    )}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 border opacity-50 hover:opacity-100">
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                <Card className="bg-primary/5 border-primary/20 shadow-inner">
                    <CardContent className="flex items-start gap-4 p-6">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold">Institutional Grade Security</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Your multi-chain wallet infrastructure is non-custodial. Every address is derived directly from your encrypted local mnemonic using BIP-44 standards. 
                                The <span className="text-primary font-semibold">Sync</span> function performs a stateless verification against decentralized blockchain RPC nodes to ensure your local interface matches the global ledger.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PrivateRoute>
    );
}
