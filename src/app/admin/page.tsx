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
    Bell, 
    Mail, 
    RefreshCw, 
    Loader2, 
    CheckCircle, 
    Power,
    AlertCircle,
    Copy,
    ExternalLink,
    ClipboardCheck,
    ArrowDownRight,
    UserCheck,
    Users,
} from 'lucide-react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, runTransaction, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getLedgerSyncStatus } from '@/services/ledger-sync-service';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { marketCoins } from '@/lib/data';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { 
  SendEmailInputSchema, 
  SendNotificationInputSchema,
  type ProtocolStatus
} from '@/lib/types';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient identity is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Injection volume must exceed zero.",
  }),
  asset: z.string().min(1, "Asset protocol selection is required."),
});

type SendFormValues = z.infer<typeof sendSchema>;
type NotificationFormValues = z.infer<typeof SendNotificationInputSchema>;
type EmailFormValues = z.infer<typeof SendEmailInputSchema>;

type OperationStatus = 'idle' | 'processing' | 'success' | 'error';

export default function AdminDashboardPage() {
  const { user, wallet: adminWallet } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Real-time task counts for orchestration
  const pendingWithdrawalsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'withdrawal_requests'), where('status', '==', 'PENDING'));
  }, [firestore]);

  const pendingKycRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'kyc_submissions'), where('status', '==', 'PENDING'));
  }, [firestore]);

  const { data: pendingWithdrawals } = useCollection(pendingWithdrawalsRef);
  const { data: pendingKyc } = useCollection(pendingKycRef);

  const allUsersRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const processedWithdrawalsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'withdrawal_requests'), where('status', 'in', ['APPROVED', 'COMPLETED']));
  }, [firestore]);

  const unreadNotificationsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'admin_notifications'), where('read', '==', false));
  }, [firestore]);

  const { data: allUsers, error: usersError } = useCollection(allUsersRef);
  const { data: processedWithdrawals } = useCollection(processedWithdrawalsRef);
  const { data: unreadNotifications } = useCollection(unreadNotificationsRef);

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore]);

  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolSettingsRef);
  const isNetworkActive = protocolStatus?.isActive ?? true;

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

  const handleToggleGate = async (active: boolean) => {
      if (!firestore) return;
      try {
          await setDoc(doc(firestore, 'protocol_settings', 'status'), { 
            isActive: active,
            maintenanceMode: !active,
            version: "5.0.1",
            lastUpdated: Date.now(),
          }, { merge: true });

          toast({ 
              title: `Protocol ${active ? 'ACTIVE' : 'HALTED'}`, 
              description: active ? "Resuming verified ledger traffic..." : "Suspending all synchronization services.",
              variant: active ? "default" : "destructive"
          });
      } catch (e) {
          toast({ title: "Operation Denied", description: "Insufficient administrative permissions.", variant: "destructive" });
      }
  };

  const fundingForm = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { recipientAddress: '', amount: '', asset: 'ETH' },
    mode: 'onChange',
  });

  const handleExecuteFunding: SubmitHandler<SendFormValues> = async (data) => {
    if (!isNetworkActive) {
        toast({ title: "Operation Inhibited", description: "Ledger is currently halted. Resume network pulse to continue.", variant: "destructive" });
        return;
    }
    if (!user || !firestore) return;
    setFundingStatus('processing');
    try {
        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
            const recipientSnapshot = await getDocs(recipientQuery);

            if (recipientSnapshot.empty) throw new Error("Recipient identity not verified.");
            
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
                status: 'Completed',
                notes: `Authorized System Orchestration Injection`
            });
        });
        setFundingStatus('success');
        fundingForm.reset();
        toast({ title: "Injection Finalized", description: `Dispatched ${data.amount} ${data.asset} to verified identity.` });
    } catch (e: any) {
        setFundingStatus('error');
        toast({ title: "Injection Failed", description: e.message, variant: "destructive" });
    }
  };

  const broadcastForm = useForm<NotificationFormValues>({
    resolver: zodResolver(SendNotificationInputSchema),
    defaultValues: { title: '', body: '' },
  });

  const handleBroadcast: SubmitHandler<NotificationFormValues> = async (data) => {
    setBroadcastStatus('processing');
    try {
        const result = await sendNotification(data);
        setBroadcastStatus('success');
        broadcastForm.reset();
        toast({ title: "Broadcast Dispatched", description: `${result.successCount} nodes notified.` });
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
            toast({ title: "Emails Finalized", description: result.message });
        } else {
            throw new Error(result.message);
        }
    } catch (e: any) {
        setEmailStatus('error');
        toast({ title: "Dispatch Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCopyAdminAddress = () => {
    if (adminWallet?.address) {
      navigator.clipboard.writeText(adminWallet.address);
      toast({ title: "Identity Copied", description: "Admin identity rail copied to clipboard." });
    }
  };

  return (
    <div className="space-y-6 pb-20">
        {usersError && (
          <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-xs font-black uppercase tracking-widest text-amber-500">Firestore Rules Update Required</AlertTitle>
            <AlertDescription className="text-[11px] text-muted-foreground mt-1">
              The admin user registry is blocked by Firestore security rules. Please update your rules in the{' '}
              <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-400 hover:text-amber-300">
                Firebase Console
              </a>{' '}
              → Firestore → Rules, then publish the new rules provided by the assistant.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Orchestration Terminal</h1>
                <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">High-Integrity Governance v5.0</p>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-xl"
                onClick={handleForceSync}
                disabled={isReconciling}
            >
                {isReconciling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Reconcile Ledger Roots
            </Button>
        </div>

        {/* System Action Required Card */}
        {(pendingWithdrawals?.length || 0) + (pendingKyc?.length || 0) > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                  <ClipboardCheck className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">System Tasks Pending</h3>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">High-Priority Reconciliation Queue</p>
                </div>
              </div>
              <div className="flex gap-2">
                {pendingWithdrawals && pendingWithdrawals.length > 0 && (
                  <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase" asChild>
                    <Link href="/admin/withdrawals">
                      <ArrowDownRight className="h-3.5 w-3.5" />
                      {pendingWithdrawals.length} Withdrawals
                    </Link>
                  </Button>
                )}
                {pendingKyc && pendingKyc.length > 0 && (
                  <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase" asChild>
                    <Link href="/admin/kyc">
                      <UserCheck className="h-3.5 w-3.5" />
                      {pendingKyc.length} KYC Requests
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/admin/users">
            <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{allUsers?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/withdrawals">
            <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{(pendingWithdrawals?.length || 0) + (pendingKyc?.length || 0)}</p>
                    <p className="text-xs text-muted-foreground">Pending Actions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/withdrawals">
            <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{processedWithdrawals?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/notifications">
            <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{unreadNotifications?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Unread Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {syncStatus?.isOffline && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 rounded-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs font-black uppercase tracking-widest">Admin Authorization Inhibited</AlertTitle>
                <AlertDescription className="text-[10px] uppercase font-bold text-muted-foreground flex flex-col gap-2 mt-1">
                    <p>Verified liquidity dispatch and global notification protocols are restricted. Provide an authorized configuration to restore full administrative integrity.</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-[9px] uppercase font-black px-3 rounded-lg border-destructive/20 hover:bg-destructive/20" asChild>
                            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-3 w-3" /> Restore Auth
                            </a>
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
                            <Activity className={cn("h-4 w-4", !isNetworkActive ? "text-destructive" : "text-primary")} /> 
                            Network Pulse
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-[8px] font-bold text-muted-foreground">PROTOCOL GATE</Label>
                            <Switch 
                                checked={isNetworkActive} 
                                onCheckedChange={handleToggleGate}
                                className="scale-75 data-[state=checked]:bg-primary data-[state=unchecked]:bg-destructive"
                            />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <span className={cn("text-2xl font-black uppercase italic", !isNetworkActive ? "text-destructive" : "text-white")}>
                            {isNetworkActive ? 'Active' : 'Halted'}
                        </span>
                        <Badge className={cn("border-none h-5 px-1.5 uppercase text-[8px] font-black", !isNetworkActive ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400")}>
                            {isNetworkActive ? 'Online' : 'Restricted'}
                        </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono truncate">
                        STATE_ROOT: {syncStatus?.stateRoot?.substring(0, 32)}...
                    </p>
                </CardContent>
            </Card>

            <Card className="glass-module border-blue-400/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-400" /> System Vault
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-2xl font-black text-white italic">{adminBalance.toFixed(4)} ETH</div>
                            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest">Authorized Liquidity Pool</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className="text-[8px] border-blue-400/30 text-blue-400 font-black uppercase tracking-tighter">Verified Admin Identity</Badge>
                            <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-lg border border-white/10 group/id cursor-pointer" onClick={handleCopyAdminAddress}>
                                <code className="text-[9px] font-mono text-muted-foreground group-hover/id:text-blue-400 transition-colors">
                                    {adminWallet?.address ? `${adminWallet.address.slice(0, 12)}...${adminWallet.address.slice(-8)}` : '0x9858...7e819f'}
                                </code>
                                <Copy className="h-2.5 w-2.5 text-muted-foreground/40 group-hover/id:text-blue-400" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="ledger" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/5 rounded-2xl p-1 h-14">
                <TabsTrigger value="ledger" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                    <DollarSign className="h-3 w-3" /> Liquidity Dispatch
                </TabsTrigger>
                <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                    <Bell className="h-3 w-3" /> Multi-Cast Alert
                </TabsTrigger>
                <TabsTrigger value="marketing" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                    <Mail className="h-3 w-3" /> Network Comms
                </TabsTrigger>
            </TabsList>

            <TabsContent value="ledger" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle className="italic uppercase tracking-tighter">Authorized Asset Injection</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Credit verified identities on the Apex Private Ledger through secure orchestration.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!isNetworkActive ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <Power className="h-12 w-12 text-destructive animate-pulse" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-destructive">Network State: Halted</h3>
                                <p className="text-xs text-muted-foreground max-w-xs">Asset injection protocols are suspended while the Protocol Gate is closed. Restore the network pulse to authorize new transactions.</p>
                            </div>
                        ) : fundingStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Finalizing Ledger State...</p>
                            </div>
                        ) : fundingStatus === 'success' ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <CheckCircle className="h-12 w-12 text-accent" />
                                <p className="text-xs font-black uppercase tracking-widest">Transaction Finalized</p>
                                <Button onClick={() => setFundingStatus('idle')} variant="outline" className="rounded-xl">Authorize New Dispatch</Button>
                            </div>
                        ) : (
                            <form onSubmit={fundingForm.handleSubmit(handleExecuteFunding)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Identity Rail ID</Label>
                                        <Input className="bg-white/5 rounded-xl font-mono text-xs border-white/10" placeholder="0x..." {...fundingForm.register('recipientAddress')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Asset Protocol</Label>
                                        <Select onValueChange={(val) => fundingForm.setValue('asset', val, { shouldValidate: true })}>
                                            <SelectTrigger className="bg-white/5 rounded-xl border-white/10">
                                                <SelectValue placeholder="Select Protocol" />
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
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Injection Volume</Label>
                                    <Input type="number" step="any" className="bg-white/5 rounded-xl text-lg font-black border-white/10" placeholder="0.00" {...fundingForm.register('amount')} />
                                </div>
                                <Button type="submit" className="w-full btn-premium py-7 rounded-2xl font-black uppercase italic tracking-widest" disabled={!fundingForm.formState.isValid}>
                                    Authorize Liquidity Dispatch
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="broadcast" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle className="italic uppercase tracking-tighter">Global Broadcast Protocol</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Dispatch high-integrity push notifications across all active network nodes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {syncStatus?.isOffline ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <AlertCircle className="h-12 w-12 text-destructive" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-destructive">Broadcast Rails Inhibited</h3>
                                <p className="text-xs text-muted-foreground max-w-xs">Global broadcast functionality requires verified administrative configuration.</p>
                            </div>
                        ) : broadcastStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Relaying to Network Nodes...</p>
                            </div>
                        ) : (
                            <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Alert Headline</Label>
                                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Verified System Update" {...broadcastForm.register('title')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Payload Content</Label>
                                    <Textarea className="bg-white/5 rounded-xl border-white/10" rows={4} placeholder="Enter robust broadcast details..." {...broadcastForm.register('body')} />
                                </div>
                                <Button type="submit" className="w-full bg-accent text-accent-foreground py-7 rounded-2xl font-black uppercase italic hover:bg-accent/80 tracking-widest">
                                    Authorize Multi-Cast Dispatch
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="marketing" className="mt-6">
                <Card className="glass-module">
                    <CardHeader>
                        <CardTitle className="italic uppercase tracking-tighter">Enterprise Comms Suite</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Deploy high-integrity system updates to the entire registry via secure SMTP rails.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {syncStatus?.isOffline ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-center">
                                <AlertCircle className="h-12 w-12 text-destructive" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-destructive">Comms Rails Inhibited</h3>
                                <p className="text-xs text-muted-foreground max-w-xs">Bulk communication dispatching requires verified administrative configuration.</p>
                            </div>
                        ) : emailStatus === 'processing' ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-xs font-black uppercase tracking-widest">Routing SMTP Traffic...</p>
                            </div>
                        ) : (
                            <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Comms Subject Line</Label>
                                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Apex Security Protocol Implementation" {...emailForm.register('subject')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">HTML Content Payload</Label>
                                    <Textarea className="bg-white/5 rounded-xl font-mono text-[10px] border-white/10" rows={10} placeholder="<h1>System Protocol Finalized</h1>..." {...emailForm.register('body')} />
                                </div>
                                <Button type="submit" className="w-full bg-blue-600 text-white py-7 rounded-2xl font-black uppercase italic hover:bg-blue-500 tracking-widest">
                                    Authorize Comms Dispatch
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
