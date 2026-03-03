
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { Copy, RefreshCw, CheckCircle2, ShieldCheck, ExternalLink, Loader2, QrCode, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrivateRoute } from '@/components/private-route';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
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
            QRCode.toDataURL(selectedQrAddress.address, { width: 300, margin: 2 })
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
            await syncWalletBalance(currency);
        } catch (error: any) {
            console.error("Sync error:", error);
            toast({ title: "Sync Failed", description: "Could not connect to the blockchain explorer node.", variant: "destructive" });
        } finally {
            setSyncingId(null);
        }
    };

    const handleOpenExplorer = (currency: string, address: string) => {
        if (!address) return;
        toast({
            title: "Simulating Explorer View",
            description: `Redirecting to verified ledger for ${currency} address...`,
        });
        const explorerMap: Record<string, string> = {
            'ETH': `https://etherscan.io/address/${address}`,
            'SOL': `https://solscan.io/account/${address}`,
            'BTC': `https://blockchain.com/btc/address/${address}`,
        };
        const url = explorerMap[currency] || `https://blockchair.com/search?q=${address}`;
        window.open(url, '_blank');
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
                        <Card key={w.id} className="group hover:ring-1 hover:ring-primary/30 transition-all duration-300 relative overflow-hidden">
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
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Deposit Address</p>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 px-2 text-[10px]" 
                                            onClick={() => {
                                                setSelectedQrAddress({ address: w.address || '', currency: w.currency });
                                                setIsQrOpen(true);
                                            }}
                                            disabled={!w.address}
                                        >
                                            <QrCode className="h-3 w-3 mr-1" /> View QR
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md font-mono text-[11px] break-all relative border border-transparent group-hover:border-primary/20">
                                        <span className="truncate pr-8">{w.address || 'Address not generated. Please sync.'}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 absolute right-1"
                                            onClick={() => handleCopy(w.address)}
                                            disabled={!w.address}
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
                                            Last verified: {w.lastSynced.toDate().toLocaleString()}
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
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>
                                    ) : (
                                        <><RefreshCw className="mr-2 h-4 w-4" /> Sync Balance</>
                                    )}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 border opacity-50 hover:opacity-100"
                                    title="Verify on Blockchain Explorer"
                                    onClick={() => handleOpenExplorer(w.currency, w.address)}
                                    disabled={!w.address}
                                >
                                    <Search className="h-4 w-4" />
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
                            <h3 className="font-bold">Protocol-Level Verification</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Every deposit address above is cryptographically derived from your seed phrase. To receive funds, simply copy the address or scan the QR code. The <span className="text-primary font-semibold">Sync Balance</span> function performs a stateless validation against public RPC nodes to ensure your dashboard reflects the absolute truth of the global ledger.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CryptoIcon name={selectedQrAddress?.currency || ''} className="h-6 w-6" />
                                {selectedQrAddress?.currency} Deposit Address
                            </DialogTitle>
                            <DialogDescription>
                                Scan this QR code to send {selectedQrAddress?.currency} directly to this wallet.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border my-4">
                            {qrDataUrl ? (
                                <Image src={qrDataUrl} alt="Deposit QR Code" width={250} height={250} />
                            ) : (
                                <div className="w-[250px] h-[250px] bg-muted animate-pulse rounded-md flex items-center justify-center">
                                     <Loader2 className="animate-spin text-muted-foreground" />
                                </div>
                            )}
                            <div className="mt-4 p-3 bg-muted rounded-md w-full font-mono text-xs break-all text-center text-black">
                                {selectedQrAddress?.address}
                            </div>
                        </div>
                        <DialogFooter className="sm:justify-start">
                            <Button type="button" variant="secondary" onClick={() => handleCopy(selectedQrAddress?.address || '')}>
                                <Copy className="h-4 w-4 mr-2" /> Copy Address
                            </Button>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Close</Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </PrivateRoute>
    );
}
