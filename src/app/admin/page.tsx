'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ShieldCheck, Activity, Bell, Mail,
  Loader2, CheckCircle, AlertCircle,
  ClipboardCheck, ArrowDownRight, UserCheck, Users,
} from 'lucide-react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  SendEmailInputSchema,
  SendNotificationInputSchema,
  type ProtocolStatus,
} from '@/lib/types';
import { useDoc } from '@/firebase';

type NotificationFormValues = { title: string; body: string };
type EmailFormValues = { subject: string; body: string };
type OperationStatus = 'idle' | 'processing' | 'success' | 'error';

export default function AdminDashboardPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const pendingWithdrawalsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'withdrawal_requests'), where('status', '==', 'PENDING'));
  }, [firestore]);

  const pendingKycRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'kyc_submissions'), where('status', '==', 'PENDING'));
  }, [firestore]);

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

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore]);

  const { data: pendingWithdrawals } = useCollection(pendingWithdrawalsRef);
  const { data: pendingKyc } = useCollection(pendingKycRef);
  const { data: allUsers, error: usersError } = useCollection(allUsersRef);
  const { data: processedWithdrawals } = useCollection(processedWithdrawalsRef);
  const { data: unreadNotifications } = useCollection(unreadNotificationsRef);
  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolSettingsRef);

  const isNetworkActive = protocolStatus?.isActive ?? true;

  const [broadcastStatus, setBroadcastStatus] = useState<OperationStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<OperationStatus>('idle');

  const broadcastForm = useForm<NotificationFormValues>({
    resolver: zodResolver(SendNotificationInputSchema),
    defaultValues: { title: '', body: '' },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(SendEmailInputSchema),
    defaultValues: { subject: '', body: '' },
  });

  const handleToggleGate = async (active: boolean) => {
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, 'protocol_settings', 'status'), {
        isActive: active,
        maintenanceMode: !active,
        version: '5.0.1',
        lastUpdated: Date.now(),
      }, { merge: true });
      toast({
        title: `Protocol ${active ? 'ACTIVE' : 'HALTED'}`,
        description: active ? 'Platform is now live for all users.' : 'Platform suspended — users cannot transact.',
        variant: active ? 'default' : 'destructive',
      });
    } catch {
      toast({ title: 'Error', description: 'Could not update protocol status.', variant: 'destructive' });
    }
  };

  const handleBroadcast: SubmitHandler<NotificationFormValues> = async (data) => {
    setBroadcastStatus('processing');
    try {
      const result = await sendNotification(data);
      setBroadcastStatus('success');
      broadcastForm.reset();
      toast({ title: 'Notification Sent', description: `${result.successCount} users notified.` });
    } catch (e: any) {
      setBroadcastStatus('error');
      toast({ title: 'Broadcast Failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleSendEmail: SubmitHandler<EmailFormValues> = async (data) => {
    setEmailStatus('processing');
    try {
      const result = await sendEmail(data);
      setEmailStatus(result.success ? 'success' : 'error');
      if (result.success) {
        emailForm.reset();
        toast({ title: 'Emails Sent', description: result.message });
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      setEmailStatus('error');
      toast({ title: 'Email Failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Firestore rules warning */}
      {usersError && (
        <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-xs font-black uppercase tracking-widest text-amber-500">Firestore Rules Update Required</AlertTitle>
          <AlertDescription className="text-[11px] text-muted-foreground mt-1">
            Admin data is blocked by Firestore security rules. Update your rules in the{' '}
            <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-400 hover:text-amber-300">
              Firebase Console
            </a>{' '}
            → Firestore → Rules.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Admin Dashboard</h1>
        <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">Apex Wallet Control Centre</p>
      </div>

      {/* Pending actions banner */}
      {(pendingWithdrawals?.length || 0) + (pendingKyc?.length || 0) > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <ClipboardCheck className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Action Required</h3>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Items pending your review</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!!pendingWithdrawals?.length && (
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase" asChild>
                  <Link href="/admin/withdrawals">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    {pendingWithdrawals.length} Withdrawals
                  </Link>
                </Button>
              )}
              {!!pendingKyc?.length && (
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase" asChild>
                  <Link href="/admin/kyc">
                    <UserCheck className="h-3.5 w-3.5" />
                    {pendingKyc.length} KYC
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/admin/users">
          <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allUsers?.length ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/kyc">
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

      {/* Protocol Gate */}
      <Card className="glass-module border-primary/20 relative overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className={cn('h-4 w-4', !isNetworkActive ? 'text-destructive' : 'text-primary')} />
              Platform Status
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
            <span className={cn('text-2xl font-black uppercase italic', !isNetworkActive ? 'text-destructive' : 'text-white')}>
              {isNetworkActive ? 'Live' : 'Suspended'}
            </span>
            <Badge className={cn('border-none h-5 px-1.5 uppercase text-[8px] font-black', !isNetworkActive ? 'bg-destructive/20 text-destructive' : 'bg-green-500/20 text-green-400')}>
              {isNetworkActive ? 'Online' : 'Maintenance'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {isNetworkActive
              ? 'Platform is live. Users can create wallets, deposit, withdraw and trade.'
              : 'Platform suspended. All user transactions are blocked until you restore the protocol.'}
          </p>
        </CardContent>
      </Card>

      {/* Comms tools */}
      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 rounded-2xl p-1 h-14">
          <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
            <Bell className="h-3 w-3" /> Push Notification
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
            <Mail className="h-3 w-3" /> Email All Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="mt-6">
          <Card className="glass-module">
            <CardHeader>
              <CardTitle className="italic uppercase tracking-tighter">Push Notification</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Send an in-app push notification to all users.</CardDescription>
            </CardHeader>
            <CardContent>
              {broadcastStatus === 'processing' ? (
                <div className="py-16 flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-xs font-black uppercase tracking-widest">Sending to all users...</p>
                </div>
              ) : broadcastStatus === 'success' ? (
                <div className="py-16 flex flex-col items-center gap-4 text-center">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-green-400">Notification Sent</p>
                  <Button onClick={() => setBroadcastStatus('idle')} variant="outline" className="rounded-xl">Send Another</Button>
                </div>
              ) : (
                <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Title</Label>
                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Important Security Update" {...broadcastForm.register('title')} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Message</Label>
                    <Textarea className="bg-white/5 rounded-xl border-white/10" rows={4} placeholder="Enter your notification message..." {...broadcastForm.register('body')} />
                  </div>
                  <Button type="submit" className="w-full btn-premium py-6 rounded-2xl font-black uppercase italic tracking-widest" disabled={!broadcastForm.formState.isValid}>
                    Send Notification
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <Card className="glass-module">
            <CardHeader>
              <CardTitle className="italic uppercase tracking-tighter">Email All Users</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Send an email to all registered users via the system mailer.</CardDescription>
            </CardHeader>
            <CardContent>
              {emailStatus === 'processing' ? (
                <div className="py-16 flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-xs font-black uppercase tracking-widest">Sending emails...</p>
                </div>
              ) : emailStatus === 'success' ? (
                <div className="py-16 flex flex-col items-center gap-4 text-center">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-green-400">Emails Sent Successfully</p>
                  <Button onClick={() => setEmailStatus('idle')} variant="outline" className="rounded-xl">Send Another</Button>
                </div>
              ) : (
                <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Subject</Label>
                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Apex Wallet — Security Update" {...emailForm.register('subject')} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">HTML Body</Label>
                    <Textarea className="bg-white/5 rounded-xl font-mono text-[11px] border-white/10" rows={10} placeholder="<h1>Hello from Apex Wallet</h1>..." {...emailForm.register('body')} />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black uppercase italic hover:bg-blue-500 tracking-widest" disabled={!emailForm.formState.isValid}>
                    Send Email
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
