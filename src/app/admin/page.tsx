
'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    ShieldCheck, 
    ArrowRight, 
    DollarSign, 
    Wallet, 
    Activity, 
    Database, 
    Globe, 
    Bell, 
    Mail, 
    RefreshCw, 
    Loader2, 
    Cpu, 
    Send, 
    CheckCircle, 
    XCircle 
} from 'lucide-react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { getLedgerSyncStatus } from '@/services/ledger-sync-service';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CryptoIcon } from '@/components/crypto-icon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { marketCoins } from '@/lib/data';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { sendEmail } from '@/ai/flows/send-email-flow';

// --- Schemas ---
const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient address is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
  asset: z.string().min(1, "Asset is required."),
});

const notificationSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  body: z.string().min(1, 'Body is required.'),
});

const emailSchema = z.object({
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
});

type SendFormValues = z.infer<typeof sendSchema>;
type NotificationFormValues = z.infer<typeof notificationSchema>;
type EmailFormValues = z.infer<typeof emailSchema>;

type OperationStatus = 'idle' | 'processing' | 'success' | 'error';

export default function AdminDashboardPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  // --- Global States ---
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [activeTab, setActiveTab] = useState('ledger');

  // --- Form States ---
  const [fundingStatus, setFundingStatus] = useState<OperationStatus>('idle');
  const [broadcastStatus, setBroadcastStatus] = useState<OperationStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<OperationStatus>('idle');

  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || '0x985864190c7E5c803B918B273f324220037e819f';

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);
  const adminBalance = ethWallet?.balance ?? 0;

  // --- Handlers ---
  const fetchStatus = async () => {
    const status = await getLedgerSyncStatus();
    setSyncStatus(status);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleForceSync = async () => {
    setIsReconciling(true);
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchStatus();
        toast({ title: "Ledger Synchronized", description: "State roots reconciled successfully." });
    } finally {
        setIsReconciling(false);
    }
  };

  // --- Ledger Funding Logic ---
  const fundingForm = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { recipientAddress: '', amount: '', asset: 'ETH' },
    mode: 'onChange',
  });

  const handleExecuteFunding: SubmitHandler<SendFormValues> = async (data) => {
    if (!user || !firestore) return;
    setFundingStatus('processing');
    try {
        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
            const recipientSnapshot = await getDocs(recipientQuery);

            if (recipientSnapshot.empty) throw new Error("Recipient identity not found.");
            
            const recipientUserId = recipientSnapshot.docs[0].id;
            const amount = parseFloat(data.amount);
            const walletRef = doc(firestore, 'users', recipientUserId, 'wallets', data.asset);
            const walletDoc = await transaction.get(walletRef);
            
            const newBalance = (walletDoc.exists() ? walletDoc.data().balance : 0) + amount;
            transaction.set(walletRef, { 
                balance: newBalance, 
                currency: data.asset,
                id: data.asset,
                userId: recipientUserId
            }, { merge: true });

            const txRef = doc(collection(walletRef, 'transactions'));
            transaction.set(txRef, {
                userId: recipientUserId,
                type: 'Buy',
                amount: amount,
                price: 0,
                timestamp: serverTimestamp(),
                notes: `System Orchestration Funding`
            });
        });
        setFundingStatus('success');
        fundingForm.reset();
        toast({ title: "Funding Success", description: `Dispatched ${data.amount} ${data.asset}.` });
    } catch (e: any) {
        setFundingStatus('error');
        toast({ title: "Funding Failed", description: e.message, variant: "destructive" });
    }
  };

  // --- Broadcast Logic ---
  const broadcastForm = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { title: '', body: '' },
  });

  const handleBroadcast: SubmitHandler<NotificationFormValues> = async (data) => {
    setBroadcastStatus('processing');
    try {
        const result = await sendNotification(data);
        setBroadcastStatus('success');
        broadcastForm.reset();
        toast({ title: "Broadcast Sent", description: `${result.successCount} users notified.` });
    } catch (e: any) {
        setBroadcastStatus('error');
        toast({ title: "Broadcast Failed", description: e.message, variant: "destructive" });
    }
  };

  // --- Email Logic ---
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { subject: '', body: '' },
  });

  const handleSendEmail: SubmitHandler<EmailFormValues> = async (data) => {
    setEmailStatus('processing');
    try {
        const result = await sendEmail(data);
        setEmailStatus(result.success ? 'success' : 'error');
        if (result.success) {
            emailForm.reset();
            toast({ title: "Emails Dispatched", description: result.message });
        } else {
            throw new Error(result.message);
        }
    } catch (e: any) {
        setEmailStatus('error');
        toast({ title: "Email Dispatch Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pb-20">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Orchestration Terminal</h1>
                <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-[0.2em] text-blue-400">Governance & Liquidity Controller</p>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10"
                onClick={handleForceSync}
                disabled={isReconciling}
            >
                {isReconciling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync State Roots
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-module border-primary/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" /> Network Pulse
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-white">{syncStatus?.status || 'Active'}</span>
                        <Badge className="bg-green-500/20 text-green-400 border-none h-5 px-1.5 uppercase text-[8px] font-black">Online</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono">ROOT: {syncStatus?.stateRoot?.substring(0, 16)}...</p>
                </CardContent>
            </Card>

            <Card className="glass-module border-accent/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Database className="h-4 w-4 text-accent" /> Bridge Reserves
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">{syncStatus?.bridgeLiquidity || '0.00M USDC'}</div>
                    <Badge variant="outline" className="mt-2 text-[8px] border-accent/30 text-accent uppercase font-bold tracking-widest">Public Rail Stables</Badge>
                </CardContent>
            </Card>

            <Card className="glass-module border-blue-400/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-400" /> Admin Liquidity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">{adminBalance.toFixed(4)} ETH</div>
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">System Vault Balance</p>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="ledger" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/5 rounded-2xl p-1 h-14">
                <TabsTrigger value="ledger" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                    <DollarSign className="h-3 w-3" /> Ledger Funding
                </TabsTrigger>
                <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                    <Bell className="h-3 w-3" /> Push Broadcast
                </TabsTrigger>
                <TabsTrigger value="marketing" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                    <Mail className="h-3 w-3" /> Email Suite
                </TabsTrigger>
            </TabsList>

            {/* --- Ledger Funding Tab --- */}
            <TabsContent value="ledger" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle>Manual Asset Injection</CardTitle>
                        <CardDescription>Directly credit a user's wallet on the Apex Private Ledger.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {fundingStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Updating Ledger...</p>
                            </div>
                        ) : fundingStatus === 'success' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <CheckCircle className="h-12 w-12 text-accent" />
                                <p className="text-xs font-black uppercase tracking-widest">Ledger State Finalized</p>
                                <Button onClick={() => setFundingStatus('idle')} variant="outline">New Operation</Button>
                            </div>
                        ) : (
                            <form onSubmit={fundingForm.handleSubmit(handleExecuteFunding)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest">Recipient Rail ID</Label>
                                        <Input className="bg-white/5 rounded-xl font-mono text-xs" placeholder="0x..." {...fundingForm.register('recipientAddress')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest">Asset Protocol</Label>
                                        <Select onValueChange={(val) => fundingForm.setValue('asset', val, { shouldValidate: true })}>
                                            <SelectTrigger className="bg-white/5 rounded-xl">
                                                <SelectValue placeholder="Select Asset" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {marketCoins.map(coin => (
                                                    <SelectItem key={coin.symbol} value={coin.symbol}>{coin.name} ({coin.symbol})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest">Amount to Inject</Label>
                                    <Input type="number" step="any" className="bg-white/5 rounded-xl text-lg font-black" placeholder="0.00" {...fundingForm.register('amount')} />
                                </div>
                                <Button type="submit" className="w-full btn-premium py-7 rounded-2xl font-black uppercase italic" disabled={!fundingForm.formState.isValid}>
                                    Execute Ledger Funding
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* --- Push Broadcast Tab --- */}
            <TabsContent value="broadcast" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle>Global Push Broadcast</CardTitle>
                        <CardDescription>Dispatch a high-priority push notification to all active devices.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {broadcastStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Broadcasting to Nodes...</p>
                            </div>
                        ) : (
                            <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest">Alert Headline</Label>
                                    <Input className="bg-white/5 rounded-xl" placeholder="e.g. Market Volatility Warning" {...broadcastForm.register('title')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest">Message Payload</Label>
                                    <Textarea className="bg-white/5 rounded-xl" rows={4} placeholder="Enter broadcast details..." {...broadcastForm.register('body')} />
                                </div>
                                <Button type="submit" className="w-full bg-accent text-accent-foreground py-7 rounded-2xl font-black uppercase italic hover:bg-accent/80">
                                    Dispatch Multi-Cast Alert
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* --- Email Suite Tab --- */}
            <TabsContent value="marketing" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle>Enterprise Email Suite</CardTitle>
                        <CardDescription>Deploy HTML-enriched system updates to the entire registry.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {emailStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Routing SMTP Traffic...</p>
                            </div>
                        ) : (
                            <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest">Email Subject Line</Label>
                                    <Input className="bg-white/5 rounded-xl" placeholder="e.g. Apex Security Protocol Update" {...emailForm.register('subject')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest">HTML Body Content</Label>
                                    <Textarea className="bg-white/5 rounded-xl font-mono text-[10px]" rows={10} placeholder="<h1>Welcome to the Future</h1>..." {...emailForm.register('body')} />
                                </div>
                                <Button type="submit" className="w-full bg-blue-600 text-white py-7 rounded-2xl font-black uppercase italic hover:bg-blue-500">
                                    Blast Email Campaign
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
