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
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Activity, Bell, Mail, Loader2, CheckCircle,
  AlertCircle, ClipboardCheck, ArrowDownRight, UserCheck, Users,
  TrendingUp, Clock, Settings, Eye, Power,
} from 'lucide-react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
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

  const rejectedWithdrawalsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'withdrawal_requests'), where('status', '==', 'REJECTED'));
  }, [firestore]);

  const approvedKycRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'kyc_submissions'), where('status', '==', 'APPROVED'));
  }, [firestore]);

  const unreadNotificationsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'admin_notifications'), where('read', '==', false));
  }, [firestore]);

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore]);

  const platformControlsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'platform_config', 'controls');
  }, [firestore]);

  const { data: pendingWithdrawals } = useCollection(pendingWithdrawalsRef);
  const { data: pendingKyc } = useCollection(pendingKycRef);
  const { data: allUsers, error: usersError } = useCollection(allUsersRef);
  const { data: processedWithdrawals } = useCollection(processedWithdrawalsRef);
  const { data: rejectedWithdrawals } = useCollection(rejectedWithdrawalsRef);
  const { data: approvedKyc } = useCollection(approvedKycRef);
  const { data: unreadNotifications } = useCollection(unreadNotificationsRef);
  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolSettingsRef);
  const { data: platformControls } = useDoc<any>(platformControlsRef);

  const isNetworkActive = protocolStatus?.isActive ?? true;
  const pendingTotal = (pendingWithdrawals?.length || 0) + (pendingKyc?.length || 0);

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
        title: `Platform ${active ? 'LIVE' : 'SUSPENDED'}`,
        description: active ? 'Platform is now live for all users.' : 'Platform suspended — all user transactions blocked.',
        variant: active ? 'default' : 'destructive',
      });
    } catch {
      toast({ title: 'Error', description: 'Could not update platform status.', variant: 'destructive' });
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
      } else throw new Error(result.message);
    } catch (e: any) {
      setEmailStatus('error');
      toast({ title: 'Email Failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-24">

      {/* Firestore error banner */}
      {usersError && (
        <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-xs font-black uppercase tracking-widest text-amber-500">Firestore Rules Update Required</AlertTitle>
          <AlertDescription className="text-[11px] text-muted-foreground mt-1">
            Admin data is blocked. Update rules in{' '}
            <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">Firebase Console</a>
            {' '}→ Firestore → Rules.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Admin Dashboard</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400 mt-1">Apex Wallet Control Centre</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-xl" asChild>
          <Link href="/admin/settings">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
        </Button>
      </div>

      {/* Pending actions banner */}
      {pendingTotal > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <ClipboardCheck className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">{pendingTotal} Item{pendingTotal !== 1 ? 's' : ''} Need Your Attention</h3>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Pending approvals in the queue</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {!!pendingWithdrawals?.length && (
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase" asChild>
                  <Link href="/admin/withdrawals"><ArrowDownRight className="h-3.5 w-3.5" />{pendingWithdrawals.length} Withdrawals</Link>
                </Button>
              )}
              {!!pendingKyc?.length && (
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase" asChild>
                  <Link href="/admin/kyc"><UserCheck className="h-3.5 w-3.5" />{pendingKyc.length} KYC</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: '/admin/users', icon: Users, color: 'primary', value: allUsers?.length ?? '—', label: 'Total Users' },
          { href: '/admin/kyc', icon: ClipboardCheck, color: 'amber-500', value: pendingTotal, label: 'Pending Actions' },
          { href: '/admin/withdrawals', icon: ShieldCheck, color: 'green-500', value: processedWithdrawals?.length || 0, label: 'Processed' },
          { href: '/admin/notifications', icon: Bell, color: 'blue-500', value: unreadNotifications?.length || 0, label: 'Unread Alerts' },
        ].map(({ href, icon: Icon, color, value, label }) => (
          <Link href={href} key={label}>
            <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-${color}/10 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 text-${color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Platform overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-module border-border/30">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">KYC Overview</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Approved</span>
                <Badge className="bg-green-500/20 text-green-400 border-none text-[10px]">{approvedKyc?.length || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pending Review</span>
                <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px]">{pendingKyc?.length || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Approval Rate</span>
                <span className="text-xs font-bold text-white">
                  {approvedKyc && (approvedKyc.length + (pendingKyc?.length || 0)) > 0
                    ? `${Math.round(approvedKyc.length / (approvedKyc.length + (pendingKyc?.length || 0)) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-module border-border/30">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Withdrawal Overview</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Processed</span>
                <Badge className="bg-green-500/20 text-green-400 border-none text-[10px]">{processedWithdrawals?.length || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pending</span>
                <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px]">{pendingWithdrawals?.length || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Rejected</span>
                <Badge className="bg-red-500/20 text-red-400 border-none text-[10px]">{rejectedWithdrawals?.length || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-module border-border/30">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Platform Controls</p>
            <div className="space-y-2">
              {[
                { label: 'Trading', value: platformControls?.tradingEnabled ?? true },
                { label: 'Withdrawals', value: platformControls?.withdrawalsEnabled ?? true },
                { label: 'Registrations', value: platformControls?.allowNewRegistrations ?? true },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Badge className={cn('border-none text-[10px]', value ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                    {value ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Protocol Gate */}
      <Card className={cn('relative overflow-hidden border-2 transition-colors', isNetworkActive ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/40 bg-destructive/5')}>
        <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center border', isNetworkActive ? 'bg-green-500/20 border-green-500/30' : 'bg-destructive/20 border-destructive/30')}>
              <Power className={cn('h-7 w-7', isNetworkActive ? 'text-green-400' : 'text-destructive')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn('text-lg font-black uppercase italic', isNetworkActive ? 'text-green-400' : 'text-destructive')}>
                  Platform {isNetworkActive ? 'Live' : 'Suspended'}
                </h3>
                <div className={cn('h-2 w-2 rounded-full animate-pulse', isNetworkActive ? 'bg-green-400' : 'bg-destructive')} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isNetworkActive
                  ? 'All systems operational. Users can register, trade, deposit, and withdraw.'
                  : 'Platform is in maintenance mode. All user transactions are blocked.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {isNetworkActive ? 'TAKE OFFLINE' : 'BRING ONLINE'}
            </Label>
            <Switch
              checked={isNetworkActive}
              onCheckedChange={handleToggleGate}
              className="scale-110 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-destructive"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/admin/withdrawals', icon: ArrowDownRight, label: 'Review Withdrawals', badge: pendingWithdrawals?.length || 0 },
          { href: '/admin/kyc', icon: UserCheck, label: 'KYC Queue', badge: pendingKyc?.length || 0 },
          { href: '/admin/users', icon: Users, label: 'User Registry', badge: 0 },
          { href: '/admin/settings', icon: Settings, label: 'Platform Settings', badge: 0 },
        ].map(({ href, icon: Icon, label, badge }) => (
          <Link href={href} key={label}>
            <Card className="border-border/30 bg-card/40 hover:bg-card/70 transition-all cursor-pointer group">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate">{label}</p>
                  {badge > 0 && <p className="text-[10px] text-amber-400 font-bold">{badge} pending</p>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Communications */}
      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 rounded-2xl p-1 h-14">
          <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
            <Bell className="h-3 w-3" /> Push Notification
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
            <Mail className="h-3 w-3" /> Email All Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="mt-4">
          <Card className="glass-module">
            <CardHeader>
              <CardTitle className="italic uppercase tracking-tighter text-base">Push Notification</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Send an in-app push notification to all users.</CardDescription>
            </CardHeader>
            <CardContent>
              {broadcastStatus === 'processing' ? (
                <div className="py-14 flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-xs font-black uppercase tracking-widest">Sending to all users...</p>
                </div>
              ) : broadcastStatus === 'success' ? (
                <div className="py-14 flex flex-col items-center gap-4 text-center">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-green-400">Notification Sent</p>
                  <Button onClick={() => setBroadcastStatus('idle')} variant="outline" className="rounded-xl">Send Another</Button>
                </div>
              ) : (
                <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Title</Label>
                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Important Security Update" {...broadcastForm.register('title')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Message</Label>
                    <Textarea className="bg-white/5 rounded-xl border-white/10" rows={4} placeholder="Enter your notification message..." {...broadcastForm.register('body')} />
                  </div>
                  <Button type="submit" className="w-full btn-premium py-6 rounded-2xl font-black uppercase italic tracking-widest" disabled={!broadcastForm.formState.isValid}>
                    Send Notification to All Users
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card className="glass-module">
            <CardHeader>
              <CardTitle className="italic uppercase tracking-tighter text-base">Email All Users</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Send an email to all registered users via the system mailer.</CardDescription>
            </CardHeader>
            <CardContent>
              {emailStatus === 'processing' ? (
                <div className="py-14 flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-xs font-black uppercase tracking-widest">Sending emails...</p>
                </div>
              ) : emailStatus === 'success' ? (
                <div className="py-14 flex flex-col items-center gap-4 text-center">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-green-400">Emails Sent Successfully</p>
                  <Button onClick={() => setEmailStatus('idle')} variant="outline" className="rounded-xl">Send Another</Button>
                </div>
              ) : (
                <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Subject</Label>
                    <Input className="bg-white/5 rounded-xl border-white/10" placeholder="e.g. Apex Wallet — Important Update" {...emailForm.register('subject')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">HTML Body</Label>
                    <Textarea className="bg-white/5 rounded-xl font-mono text-[11px] border-white/10" rows={8} placeholder="<h1>Hello from Apex Wallet</h1>..." {...emailForm.register('body')} />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black uppercase italic hover:bg-blue-500 tracking-widest" disabled={!emailForm.formState.isValid}>
                    Send Email to All Users
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
