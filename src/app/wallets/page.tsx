
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
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
        return query(collection(firestore, 'users', user.uid, 'wallets'));
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
        } catch (error) {
            toast({ title: "Sync Failed", description: "Could not connect to the blockchain node.", variant: "destructive" });
        } finally {
            setSyncingId(null);
        }
    };

    return (
        <PrivateRoute>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">My Wallets</h1>
                    <p className="text-muted-foreground">Manage your individual blockchain addresses and verify balances.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        [...Array(3)].map((_, i) => (
                            <Card key={i} className="animate-pulse">
                                <CardHeader>
                                    <Skeleton className="h-6 w-32" />
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-4 w-2/3" />
                                </CardContent>
                            </Card>
                        ))
                    ) : wallets?.map((w) => (
                        <Card key={w.id} className="group hover:border-primary/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-2">
                                    <CryptoIcon name={w.currency} className="h-6 w-6" />
                                    <CardTitle className="text-lg font-bold">{w.currency}</CardTitle>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {['ETH', 'LINK', 'BNB'].includes(w.currency) ? 'ERC-20' : w.currency === 'SOL' ? 'SPL' : 'Native'}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Blockchain Address</p>
                                    <div className="flex items-center gap-2 bg-muted p-2 rounded-md font-mono text-xs break-all relative">
                                        {w.address}
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 flex-shrink-0 ml-auto"
                                            onClick={() => handleCopy(w.address)}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Balance</p>
                                    <p className="text-2xl font-bold">{w.balance.toFixed(6)} {w.currency}</p>
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
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="flex items-start gap-4 p-6">
                        <ShieldCheck className="h-6 w-6 text-primary mt-1" />
                        <div className="space-y-1">
                            <h3 className="font-bold">Verified Ownership</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                All wallet addresses shown here are generated locally on your device from your secure mnemonic. 
                                The "Sync" function verifies your balance directly against decentralized blockchain explorers. 
                                Your private keys never leave your device.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PrivateRoute>
    );
}
