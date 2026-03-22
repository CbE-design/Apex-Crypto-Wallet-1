
'use client';

import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Activity, Database, Server, Clock, Box, Hash, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CryptoIcon } from '@/components/crypto-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ExplorerPage() {
    const { address } = useParams();
    const firestore = useFirestore();
    const [wallets, setWallets] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [blockRef, setBlockRef] = useState('--------');

    useEffect(() => {
        setBlockRef(Math.floor(Date.now() / 15000).toString().slice(-8));
    }, []);

    useEffect(() => {
        async function fetchExplorerData() {
            if (!firestore || !address) return;
            setIsLoading(true);
            try {
                // Use Collection Group query to find the wallet document across all users
                // This requires /{path=**}/wallets/{walletId} permission in firestore.rules
                const walletsQuery = query(collectionGroup(firestore, 'wallets'), where('address', '==', address));
                const walletSnap = await getDocs(walletsQuery);
                
                if (walletSnap.empty) {
                    setWallets([]);
                    setTransactions([]);
                    setIsLoading(false);
                    return;
                }

                const foundWallets = walletSnap.docs.map(doc => ({ 
                    ...doc.data(), 
                    id: doc.id, 
                    refPath: doc.ref.path 
                }));
                setWallets(foundWallets);

                // Fetch transactions from the subcollection of the found wallet
                const allTxs: any[] = [];
                for (const w of foundWallets) {
                    const txSnap = await getDocs(collection(firestore, w.refPath, 'transactions'));
                    txSnap.forEach(doc => allTxs.push({ ...doc.data(), id: doc.id }));
                }
                
                setTransactions(allTxs.sort((a, b) => {
                    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return timeB - timeA;
                }));

            } catch (error) {
                console.error("Explorer fetch error:", error);
                // Gracefully handle permission errors or missing data
                setWallets([]);
                setTransactions([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchExplorerData();
    }, [firestore, address]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isVerified = wallets.length > 0;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="text-primary h-6 w-6" />
                        Apex Block Explorer
                    </h1>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-muted-foreground break-all">{address}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(address as string)}>
                            <Hash className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
                <Badge variant={isVerified ? "default" : "destructive"} className="h-8 px-4 flex items-center gap-2 bg-primary/20 text-primary border-primary/50">
                    {isVerified ? (
                        <><ShieldCheck className="h-4 w-4" /> VERIFIED ON PRIVATE LEDGER</>
                    ) : (
                        "UNREGISTERED ADDRESS"
                    )}
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Box className="h-4 w-4" /> Ledger Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {wallets.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {wallets.map(w => (
                                    <div key={w.id} className="p-4 rounded-lg bg-muted/30 border border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CryptoIcon name={w.currency} className="h-5 w-5" />
                                            <span className="font-bold text-sm">{w.currency} Balance</span>
                                        </div>
                                        <div className="text-2xl font-black">{w.balance?.toFixed(6) || "0.000000"}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Status: Finalized</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-muted-foreground">
                                <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No registered assets found for this identity.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Private Node Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Network</span>
                            <span className="font-bold">Apex RPC Core</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Latency</span>
                            <span className="font-bold text-green-400">8ms</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Last Block</span>
                            <span className="font-mono text-primary">{blockRef}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-4 border-t border-white/5">
                            <span className="text-muted-foreground">Identity Age</span>
                            <span className="font-bold">{isVerified ? 'Synchronized' : 'N/A'}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Verified Ledger History
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 bg-muted/20">
                                <TableHead className="text-[10px] uppercase font-bold">Tx Hash</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Method</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Amount</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length > 0 ? transactions.map((tx) => (
                                <TableRow key={tx.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                    <TableCell className="font-mono text-[10px] text-primary">
                                        0x{tx.id.substring(0, 16)}...
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-5">
                                            {tx.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-bold text-xs">
                                        {tx.amount?.toFixed(4) || "0.0000"} ETH
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1 text-[10px] text-green-400 font-bold">
                                            <Server className="h-3 w-3" /> CONFIRMED
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-xs italic">
                                        No recent activity detected on the private ledger node.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="text-center">
                <Link href="/wallets">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Database className="h-4 w-4" /> Back to My Wallets
                    </Button>
                </Link>
            </div>
        </div>
    );
}
