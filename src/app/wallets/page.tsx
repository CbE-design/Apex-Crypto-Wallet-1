
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { Copy, RefreshCw, CheckCircle2, ShieldCheck, Loader2, QrCode, Search, Wallet, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrivateRoute } from '@/components/private-route';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import Image from 'next/image';

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
    const [selectedQrAddress, setSelectedQrAddress] = useState<{ address: string, currency: string } | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [isQrOpen, setIsQrOpen] = useState(false);

    const walletsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'users', user.uid, 'wallets'), orderBy('currency', 'asc'));
    }, [user, firestore]);

    const { data: wallets, isLoading } = useCollection<WalletDoc>(walletsQuery);

    useEffect(() => {
        if (selectedQrAddress && selectedQrAddress.address) {
            QRCode.toDataURL(selectedQrAddress.address, { 
                width: 300, 
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            })
                .then(setQrDataUrl)
                .catch(err => {
                    console.error('QR Generation Error:', err);
                    setQrDataUrl('');
                });
        } else {
            setQrDataUrl('');
        }
    }, [selectedQrAddress]);

    const handleCopy = (address: string) => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        toast({ title: "Address Copied", description: "The wallet address has been copied to your clipboard." });
    };

    const handleSync = async (currency: string) => {
        setSyncingId(currency);
        try {
            // Simulate a real RPC check delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            await syncWalletBalance(currency);
            toast({ 
                title: "Live On-Chain Check", 
                description: `Successfully verified ${currency} ledger against RPC node.` 
            });
        } catch (error: any) {
            console.error("Sync error:", error);
            toast({ title: "Sync Failed", description: "Could not connect to the blockchain explorer node.", variant: "destructive" });
        } finally {
            setSyncingId(null);
        }
    };

    const handleOpenExplorer = (currency: string, address: string) => {
        if (!address) return;
        
        const explorerMap: Record<string, string> = {
            'ETH': `https://etherscan.io/address/${address}`,
            'SOL': `https://solscan.io/account/${address}`,
            'BTC': `https://blockchain.com/btc/address/${address}`,
            'LINK': `https://etherscan.io/token/0x514910771af9ca656af840dff83e8264ecf986ca?a=${address}`,
            'USDT': `https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7?a=${address}`,
            'ADA': `https://cardanoscan.io/address/${address}`,
            'XRP': `https://xrpscan.com/account/${address}`,
        };
        
        const url = explorerMap[currency] || `https://blockchair.com/search?q=${address}`;
        window.open(url, '_blank');
        
        toast({
            title: "Explorer Launched",
            description: `Viewing ${currency} ledger on public block explorer.`,
        });
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
                        <p className="text-muted-foreground">Manage your multi-chain deposit addresses and verify real-time on-chain balances.</p>
                    </div>
                    <Badge variant="secondary" className="w-fit h-fit px-3 py-1 bg-primary/20 text-primary border-primary/30">
                        Active Ledgers: {wallets?.length || 0}
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
                    ) : wallets && wallets.length > 0 ? (
                        wallets.map((w) => (
                            <Card key={w.id} className="group hover:ring-1 hover:ring-primary/30 transition-all duration-300 relative overflow-hidden bg-card/50 backdrop-blur-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="flex items-center gap-2">
                                        <CryptoIcon name={w.currency} className="h-6 w-6" />
                                        <CardTitle className="text-lg font-bold">{w.currency}</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold">
                                        {getChainType(w.currency)}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Public Address</p>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 px-2 text-[10px] hover:text-primary" 
                                                onClick={() => {
                                                    setSelectedQrAddress({ address: w.address || '', currency: w.currency });
                                                    setIsQrOpen(true);
                                                }}
                                                disabled={!w.address}
                                            >
                                                <QrCode className="h-3 w-3 mr-1" /> View QR
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-md font-mono text-[11px] break-all relative border border-transparent group-hover:border-primary/20 transition-colors">
                                            <span className="truncate pr-8 text-muted-foreground">{w.address || 'Address pending...'}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 absolute right-1 hover:bg-primary/10 hover:text-primary"
                                                onClick={() => handleCopy(w.address)}
                                                disabled={!w.address}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">Current Balance</p>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-2xl font-bold font-headline">{w.balance.toFixed(6)}</p>
                                            <p className="text-sm font-bold text-muted-foreground">{w.currency}</p>
                                        </div>
                                        {w.lastSynced ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-green-500/20 text-green-400 border-none">LIVE</Badge>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    Verified: {w.lastSynced.toDate().toLocaleString()}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground mt-1">Not yet synced</p>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex gap-2">
                                    <Button 
                                        className="flex-1 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all" 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => handleSync(w.currency)}
                                        disabled={syncingId === w.currency}
                                    >
                                        {syncingId === w.currency ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                                        ) : (
                                            <><RefreshCw className="mr-2 h-4 w-4" /> Sync Node</>
                                        )}
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 border border-border opacity-50 hover:opacity-100 hover:text-primary"
                                        title="Verify on Blockchain Explorer"
                                        onClick={() => handleOpenExplorer(w.currency, w.address)}
                                        disabled={!w.address}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center space-y-4">
                            <div className="bg-muted p-4 rounded-full w-fit mx-auto">
                                <Wallet className="h-12 w-12 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-bold">No Wallets Found</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">
                                We couldn't find any wallet ledgers associated with your account. Try syncing your profile or contact support.
                            </p>
                            <Button variant="outline" onClick={() => window.location.reload()}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Dashboard
                            </Button>
                        </div>
                    )}
                </div>

                <Card className="bg-primary/5 border-primary/20 shadow-inner relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldCheck className="h-24 w-24 text-primary" />
                    </div>
                    <CardContent className="flex items-start gap-4 p-6 relative z-10">
                        <div className="bg-primary/10 p-2 rounded-full hidden sm:block">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-lg">Self-Custodial Protocol</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                These addresses are cryptographically derived from your private seed phrase. Apex Wallet does not store your private keys. Every <span className="text-primary font-semibold">Sync</span> request performs a stateless check against decentralized RPC endpoints to ensure your local dashboard remains in sync with the global truth of the blockchain.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
                    <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <CryptoIcon name={selectedQrAddress?.currency || ''} className="h-6 w-6" />
                                {selectedQrAddress?.currency} Identity
                            </DialogTitle>
                            <DialogDescription>
                                Scan to receive funds or share your verified identity address.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border-4 border-muted/50 my-4 shadow-inner">
                            {qrDataUrl ? (
                                <div className="relative group">
                                    <Image src={qrDataUrl} alt="Deposit QR Code" width={250} height={250} className="rounded-lg" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                        <QrCode className="h-12 w-12 text-primary/40" />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-[250px] h-[250px] bg-muted animate-pulse rounded-md flex items-center justify-center">
                                     <Loader2 className="animate-spin text-muted-foreground" />
                                </div>
                            )}
                            <div className="mt-6 p-4 bg-muted/80 rounded-lg w-full font-mono text-[10px] break-all text-center text-black border shadow-sm select-all">
                                {selectedQrAddress?.address}
                            </div>
                        </div>
                        <DialogFooter className="flex flex-col sm:flex-row gap-2">
                            <Button type="button" className="flex-1" onClick={() => handleCopy(selectedQrAddress?.address || '')}>
                                <Copy className="h-4 w-4 mr-2" /> Copy to Clipboard
                            </Button>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Dismiss</Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </PrivateRoute>
    );
}
