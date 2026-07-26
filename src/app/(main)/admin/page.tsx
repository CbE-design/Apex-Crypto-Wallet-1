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
    const result = await sendNotification({
      ...data,
      category: 'general',
      priority: 'normal',
    });
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
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Admin Dashboard</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">Apex Wallet Control Centre</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-xl" asChild>
          <Link href="/admin/settings"><Settings className="h-3.5 w-3.5" />Settings</Link>
        </Button>
      </div>

      {/* Pending actions banner */}
      {pendingTotal > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/20">
              <ClipboardCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-300">{pendingTotal} Item{pendingTotal !== 1 ? 's' : ''} Need Attention</h3>
              <p className="text-[10px] text-white/30">Pending approvals in queue</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {!!pendingWithdrawals?.length && (
              <Link href="/admin/withdrawals" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/15 transition-colors">
                <ArrowDownRight className="h-3 w-3" />{pendingWithdrawals.length} Withdrawals
              </Link>
            )}
            {!!pendingKyc?.length && (
              <Link href="/admin/kyc" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold hover:bg-violet-500/15 transition-colors">
                <UserCheck className="h-3 w-3" />{pendingKyc.length} KYC
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { href: '/admin/users', icon: Users, accent: 'violet', value: allUsers?.length ?? '—', label: 'Total Users', border: 'border-violet-500/15 bg-violet-500/5', iconBg: 'bg-violet-500/10 border-violet-500/20', iconColor: 'text-violet-400' },
          { href: '/admin/users', icon: Activity, accent: 'emerald', value: allUsers?.filter(u => u.isOnline === true || (u.lastSeen && (Date.now() - (u.lastSeen.toMillis ? u.lastSeen.toMillis() : new Date(u.lastSeen).getTime()) < 5 * 60 * 1000))).length || 0, label: 'Online Now', border: 'border-emerald-500/15 bg-emerald-500/5', iconBg: 'bg-emerald-500/10 border-emerald-500/20', iconColor: 'text-emerald-400' },
          { href: '/admin/kyc', icon: ClipboardCheck, accent: 'amber', value: pendingTotal, label: 'Pending Actions', border: pendingTotal > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.02]', iconBg: 'bg-amber-500/10 border-amber-500/20', iconColor: 'text-amber-400' },
          { href: '/admin/withdrawals', icon: ShieldCheck, accent: 'emerald', value: processedWithdrawals?.length || 0, label: 'Processed', border: 'border-white/[0.06] bg-white/[0.02]', iconBg: 'bg-emerald-500/10 border-emerald-500/20', iconColor: 'text-emerald-400' },
          { href: '/admin/notifications', icon: Bell, accent: 'cyan', value: unreadNotifications?.length || 0, label: 'Unread Alerts', border: 'border-cyan-500/15 bg-cyan-500/5', iconBg: 'bg-cyan-500/10 border-cyan-500/20', iconColor: 'text-cyan-400' },
        ].map(({ href, icon: Icon, value, label, border, iconBg, iconColor }) => (
          <Link href={href} key={label}>
            <div className={cn("rounded-2xl border p-4 hover:border-opacity-60 transition-all cursor-pointer", border)}>
              <div className="flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border shrink-0", iconBg)}>
                  <Icon className={cn("h-4 w-4", iconColor)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                  <p className="text-[10px] text-white/30">{label}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'KYC Overview',
            rows: [
              { label: 'Approved', value: approvedKyc?.length || 0, color: 'text-emerald-400 bg-emerald-500/10' },
              { label: 'Pending', value: pendingKyc?.length || 0, color: 'text-amber-400 bg-amber-500/10' },
              { label: 'Approval Rate', value: approvedKyc && (approvedKyc.length + (pendingKyc?.length || 0)) > 0 ? `${Math.round(approvedKyc.length / (approvedKyc.length + (pendingKyc?.length || 0)) * 100)}%` : '—', color: 'text-white/60 bg-white/5' },
            ],
          },
          {
            title: 'Withdrawal Overview',
            rows: [
              { label: 'Processed', value: processedWithdrawals?.length || 0, color: 'text-emerald-400 bg-emerald-500/10' },
              { label: 'Pending', value: pendingWithdrawals?.length || 0, color: 'text-amber-400 bg-amber-500/10' },
              { label: 'Rejected', value: rejectedWithdrawals?.length || 0, color: 'text-red-400 bg-red-500/10' },
            ],
          },
          {
            title: 'Platform Controls',
            rows: [
              { label: 'Trading', value: platformControls?.tradingEnabled ?? true ? 'On' : 'Off', color: (platformControls?.tradingEnabled ?? true) ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10' },
              { label: 'Withdrawals', value: platformControls?.withdrawalsEnabled ?? true ? 'On' : 'Off', color: (platformControls?.withdrawalsEnabled ?? true) ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10' },
              { label: 'Registrations', value: platformControls?.allowNewRegistrations ?? true ? 'On' : 'Off', color: (platformControls?.allowNewRegistrations ?? true) ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10' },
            ],
          },
        ].map(({ title, rows }) => (
          <div key={title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl bg-gradient-to-r from-violet-500/40 to-transparent" />
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">{title}</p>
            <div className="space-y-2">
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">{row.label}</span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg', row.color)}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Protocol Gate */}
      <div className={cn('relative overflow-hidden rounded-2xl border-2 transition-all p-5 flex flex-col md:flex-row items-center justify-between gap-4', isNetworkActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5')}>
        <div className="flex items-center gap-4">
          <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center border', isNetworkActive ? 'bg-emerald-500/15 border-emerald-500/25' : 'bg-red-500/15 border-red-500/25')}>
            <Power className={cn('h-6 w-6', isNetworkActive ? 'text-emerald-400' : 'text-red-400')} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn('text-base font-bold uppercase tracking-wide', isNetworkActive ? 'text-emerald-300' : 'text-red-300')}>
                Platform {isNetworkActive ? 'Live' : 'Suspended'}
              </h3>
              <div className={cn('h-2 w-2 rounded-full animate-pulse', isNetworkActive ? 'bg-emerald-400' : 'bg-red-400')} />
            </div>
            <p className="text-[11px] text-white/35">
              {isNetworkActive ? 'All systems operational — users can transact.' : 'Maintenance mode — all user transactions blocked.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Label className="text-[9px] font-bold uppercase tracking-widest text-white/25">
            {isNetworkActive ? 'TAKE OFFLINE' : 'BRING ONLINE'}
          </Label>
          <Switch
            checked={isNetworkActive}
            onCheckedChange={handleToggleGate}
            className="scale-110 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/admin/withdrawals', icon: ArrowDownRight, label: 'Withdrawals', badge: pendingWithdrawals?.length || 0 },
          { href: '/admin/kyc', icon: UserCheck, label: 'KYC Queue', badge: pendingKyc?.length || 0 },
          { href: '/admin/users', icon: Users, label: 'User Registry', badge: 0 },
          { href: '/admin/settings', icon: Settings, label: 'Settings', badge: 0 },
        ].map(({ href, icon: Icon, label, badge }) => (
          <Link href={href} key={label}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/15 hover:bg-violet-500/[0.03] transition-all cursor-pointer group p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-violet-500/8 group-hover:bg-violet-500/15 transition-colors border border-violet-500/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-violet-400/60 group-hover:text-violet-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white/60 group-hover:text-white/80 truncate transition-colors">{label}</p>
                {badge > 0 && <p className="text-[9px] text-amber-400 font-bold">{badge} pending</p>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Communications */}
      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] rounded-2xl p-1 h-12 border border-white/[0.06]">
          <TabsTrigger value="broadcast" className="rounded-xl font-bold uppercase tracking-[0.12em] text-[10px] gap-2 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-violet-500/20">
            <Bell className="h-3 w-3" /> Push
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-xl font-bold uppercase tracking-[0.12em] text-[10px] gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-500/20">
            <Mail className="h-3 w-3" /> Email All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="mt-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 p-5">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl bg-gradient-to-r from-violet-500 to-transparent" />
            <h3 className="text-sm font-bold text-white mb-1">Push Notification</h3>
            <p className="text-[10px] text-white/30 mb-4">Send an in-app notification to all users.</p>
            {broadcastStatus === 'processing' ? (
              <div className="py-14 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Sending to all users...</p>
              </div>
            ) : broadcastStatus === 'success' ? (
              <div className="py-14 flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Notification Sent</p>
                <Button onClick={() => setBroadcastStatus('idle')} variant="outline" className="rounded-xl border-white/10">Send Another</Button>
              </div>
            ) : (
              <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Title</Label>
                  <Input className="bg-white/5 rounded-xl border-white/8" placeholder="e.g. Important Security Update" {...broadcastForm.register('title')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Message</Label>
                  <Textarea className="bg-white/5 rounded-xl border-white/8" rows={4} placeholder="Enter your notification message..." {...broadcastForm.register('body')} />
                </div>
                <button type="submit" disabled={!broadcastForm.formState.isValid} className="w-full h-12 btn-premium rounded-2xl font-bold uppercase tracking-widest text-sm text-white disabled:opacity-40">
                  Send to All Users
                </button>
              </form>
            )}
          </div>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 p-5">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl bg-gradient-to-r from-cyan-500 to-transparent" />
            <h3 className="text-sm font-bold text-white mb-1">Email All Users</h3>
            <p className="text-[10px] text-white/30 mb-4">Send an email to all registered users via the system mailer.</p>
            {emailStatus === 'processing' ? (
              <div className="py-14 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Sending emails...</p>
              </div>
            ) : emailStatus === 'success' ? (
              <div className="py-14 flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Emails Sent Successfully</p>
                <Button onClick={() => setEmailStatus('idle')} variant="outline" className="rounded-xl border-white/10">Send Another</Button>
              </div>
            ) : (
              <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Subject</Label>
                  <Input className="bg-white/5 rounded-xl border-white/8" placeholder="e.g. Apex Wallet — Important Update" {...emailForm.register('subject')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">HTML Body</Label>
                  <Textarea className="bg-white/5 rounded-xl font-mono text-[11px] border-white/8" rows={8} placeholder="<h1>Hello from Apex Wallet</h1>..." {...emailForm.register('body')} />
                </div>
                <button type="submit" disabled={!emailForm.formState.isValid} className="w-full h-12 btn-cyan rounded-2xl font-bold uppercase tracking-widest text-sm text-white disabled:opacity-40">
                  Send Email to All Users
                </button>
              </form>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
