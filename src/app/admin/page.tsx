
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
    ShieldCheck, 
    DollarSign, 
    Wallet, 
    Activity, 
    Database, 
    Bell, 
    Mail, 
    RefreshCw, 
    Loader2, 
    CheckCircle, 
    Power,
    AlertCircle,
    Info,
    ExternalLink
} from 'lucide-react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, runTransaction, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getLedgerSyncStatus } from '@/services/ledger-sync-service';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { marketCoins } from '@/lib/data';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { cn } from '@/lib/utils';
import { 
  SendEmailInputSchema, 
  SendNotificationInputSchema,
  type ProtocolStatus
} from '@/lib/types';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient address is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
  asset: z.string().min(1, "Asset is required."),
});

type SendFormValues = z.infer<typeof sendSchema>;
type NotificationFormValues = z.infer<typeof SendNotificationInputSchema>;
type EmailFormValues = z.infer<typeof SendEmailInputSchema>;

type OperationStatus = 'idle' | 'processing' | 'success' | 'error';

export default function AdminDashboardPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore]);

  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolSettingsRef);
  const isProtocolHalted = protocolStatus ? (protocolStatus.maintenanceMode || !protocolStatus.isActive || protocolStatus.isHalted) : false;

  const [fundingStatus, setFundingStatus] = useState<OperationStatus>('idle');
  const [broadcastStatus, setBroadcastStatus] = useState<OperationStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<OperationStatus>('idle');

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);
  const adminBalance = ethWallet?.balance ?? 0;

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
        await fetchStatus();
        toast({ title: "Ledger Synchronized", description: "State roots reconciled successfully." });
    } finally {
        setIsReconciling(false);
    }
  };

  const handleToggleGate = async (checked: boolean) => {
      if (!firestore) return;
      const isActive = checked;
      try {
          await setDoc(doc(firestore, 'protocol_settings', 'status'), { 
            isActive: isActive,
            isHalted: !isActive,
            maintenanceMode: !isActive,
            version: "5.0.1",
            lastUpdated: serverTimestamp(),
            updatedBy: user?.uid,
            timestamp: serverTimestamp()
          }, { merge: true });

          const action = checked ? "OPENED" : "HALTED";
          toast({ 
              title: `Protocol ${action}`, 
              description: checked ? "Resuming inbound RPC traffic..." : "Suspending all synchronization services.",
              variant: checked ? "default" : "destructive"
          });
      } catch (e) {
          toast({ title: "Update Failed", description: "Insufficient permissions for global protocol change.", variant: "destructive" });
      }
  };

  const fundingForm = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { recipientAddress: '', amount: '', asset: 'ETH' },
    mode: 'onChange',
  });

  const handleExecuteFunding: SubmitHandler<SendFormValues> = async (data) => {
    if (isProtocolHalted) {
        toast({ title: "Operation Denied", description: "Ledger is currently halted. Re-open the Protocol Gate.", variant: "destructive" });
        return;
    }
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

  const broadcastForm = useForm<NotificationFormValues>({
    resolver: zodResolver(SendNotificationInputSchema),
    defaultValues: { title: '', body: '' },
  });

  const handleBroadcast: SubmitHandler<NotificationFormValues> = async (data) => {
    setBroadcastStatus('processing');
    try {
        const successCount = await sendNotification(data);
        setBroadcastStatus('success');
        broadcastForm.reset();
        toast({ title: "Broadcast Sent", description: `${successCount} users notified.` });
    } catch (e: any) {
        setBroadcastStatus('error');
        toast({ title: "Broadcast Failed", description: e.message, variant: "destructive" });
    }
  };

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(SendEmailInputSchema),
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
                <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Orchestration Terminal</h1>
                <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">Governance Controller v5.0</p>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-xl"
                onClick={handleForceSync}
                disabled={isReconciling}
            >
                {isReconciling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Force State Sync
            </Button>
        </div>

        {syncStatus?.isOffline && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 rounded-2xl animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs font-black uppercase tracking-widest">Admin SDK Disconnected</AlertTitle>
                <AlertDescription className="text-[10px] uppercase font-bold text-muted-foreground flex flex-col gap-2 mt-1">
                    <p>Global broadcast protocols and system synchronization are currently inhibited. Please provide the Firebase Admin SDK configuration in your .env file.</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-[9px] uppercase font-black px-3 rounded-lg border-destructive/20 hover:bg-destructive/20" asChild>
                            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-3 w-3" /> Get SDK Key
                            </a>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[9px] uppercase font-black px-3 rounded-lg" onClick={() => toast({ title: "Check README", description: "Instructions for Admin SDK are in the root README.md file." })}>
                            <Info className="mr-1 h-3 w-3" /> View Setup Guide
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-module border-primary/20 relative overflow-hidden group">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className={cn("h-4 w-4", isProtocolHalted ? "text-destructive" : "text-primary")} /> 
                            Network Pulse
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-[8px] font-bold text-muted-foreground">GATE</Label>
                            <Switch 
                                checked={!isProtocolHalted} 
                                onCheckedChange={handleToggleGate}
                                className="scale-75 data-[state=checked]:bg-primary data-[state=unchecked]:bg-destructive"
                            />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <span className={cn("text-2xl font-black uppercase italic", isProtocolHalted ? "text-destructive" : "text-white")}>
                            {isProtocolHalted ? 'Halted' : 'Active'}
                        </span>
                        <Badge className={cn("border-none h-5 px-1.5 uppercase text-[8px] font-black", isProtocolHalted ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400")}>
                            {isProtocolHalted ? 'Offline' : 'Online'}
                        </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono truncate">
                        ROOT: {syncStatus?.stateRoot?.substring(0, 32)}...
                    </p>
                </CardContent>
            </Card>

            <Card className="glass-module border-blue-400/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-400" /> Admin Liquidity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white italic">{adminBalance.toFixed(4)} ETH</div>
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

            <TabsContent value="ledger" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle className="italic">Manual Asset Injection</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Directly credit a user's wallet on the Apex Private Ledger.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isProtocolHalted ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <Power className="h-12 w-12 text-destructive animate-pulse" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-destructive">Ledger Halted</h3>
                                <p className="text-xs text-muted-foreground max-w-xs">Manual asset injection is inhibited while the Protocol Gate is closed. Re-open the gate to resume.</p>
                            </div>
                        ) : fundingStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Updating Ledger State...</p>
                            </div>
                        ) : fundingStatus === 'success' ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <CheckCircle className="h-12 w-12 text-accent" />
                                <p className="text-xs font-black uppercase tracking-widest">Ledger State Finalized</p>
                                <Button onClick={() => setFundingStatus('idle')} variant="outline" className="rounded-xl">New Operation</Button>
                            </div>
                        ) : (
                            <form onSubmit={fundingForm.handleSubmit(handleExecuteFunding)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Recipient Rail ID</Label>
                                        <Input className="bg-white/5 rounded-xl font-mono text-xs border-white/10" placeholder="0x..." {...fundingForm.register('recipientAddress')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Asset Protocol</Label>
                                        <Select onValueChange={(val) => fundingForm.setValue('asset', val, { shouldValidate: true })}>
                                            <SelectTrigger className="bg-white/5 rounded-xl border-white/10">
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
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Amount to Inject</Label>
                                    <Input type="number" step="any" className="bg-white/5 rounded-xl text-lg font-black border-white/10" placeholder="0.00" {...fundingForm.register('amount')} />
                                </div>
                                <Button type="submit" className="w-full btn-premium py-7 rounded-2xl font-black uppercase italic tracking-widest" disabled={!fundingForm.formState.isValid}>
                                    Execute Ledger Injection
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="broadcast" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle className="italic">Global Push Broadcast</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Dispatch a high-priority push notification to all active devices.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {syncStatus?.isOffline ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <AlertCircle className="h-12 w-12 text-destructive" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-destructive">Broadcast Rails Disabled</h3>
                                <p className="text-xs text-muted-foreground max-w-xs">Global push broadcast requires a valid Firebase Admin SDK configuration.</p>
                            </div>
                        ) : broadcastStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Broadcasting to Nodes...</p>
                            </div>
                        ) : (
                            <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Alert Headline</Label>
                                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Market Volatility Warning" {...broadcastForm.register('title')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Message Payload</Label>
                                    <Textarea className="bg-white/5 rounded-xl border-white/10" rows={4} placeholder="Enter broadcast details..." {...broadcastForm.register('body')} />
                                </div>
                                <Button type="submit" className="w-full bg-accent text-accent-foreground py-7 rounded-2xl font-black uppercase italic hover:bg-accent/80 tracking-widest">
                                    Dispatch Multi-Cast Alert
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="marketing" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle className="italic">Enterprise Email Suite</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Deploy HTML-enriched system updates to the entire registry.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {syncStatus?.isOffline ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <AlertCircle className="h-12 w-12 text-destructive" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-destructive">SMTP Rails Disabled</h3>
                                <p className="text-xs text-muted-foreground max-w-xs">Bulk email dispatching requires a valid Firebase Admin SDK configuration.</p>
                            </div>
                        ) : emailStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Routing SMTP Traffic...</p>
                            </div>
                        ) : (
                            <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Email Subject Line</Label>
                                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Apex Security Protocol Update" {...emailForm.register('subject')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">HTML Body Content</Label>
                                    <Textarea className="bg-white/5 rounded-xl font-mono text-[10px] border-white/10" rows={10} placeholder="<h1>Welcome to the Future</h1>..." {...emailForm.register('body')} />
                                </div>
                                <Button type="submit" className="w-full bg-blue-600 text-white py-7 rounded-2xl font-black uppercase italic hover:bg-blue-500 tracking-widest">
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
