'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, CheckCircle, XCircle, Bell, Radio, Megaphone, Clock, Users, Smartphone, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { NotificationCategorySchema, NotificationPrioritySchema } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const notificationSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  body: z.string().min(1, 'Body is required.'),
  category: NotificationCategorySchema.default('general'),
  priority: NotificationPrioritySchema.default('normal'),
  sender: z.string().min(1, 'Sender is required.'),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

const categoryOptions = NotificationCategorySchema.options.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));
const priorityOptions = NotificationPrioritySchema.options.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }));

const priorityMeta: Record<string, { color: string; label: string; icon: typeof AlertTriangle }> = {
  low: { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: 'Low', icon: AlertTriangle },
  normal: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Normal', icon: AlertTriangle },
  high: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'High', icon: AlertTriangle },
  urgent: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Urgent', icon: AlertTriangle },
};

const categoryMeta: Record<string, { color: string; icon: typeof Megaphone }> = {
  general: { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Megaphone },
  market: { color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Radio },
  security: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertTriangle },
  system: { color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: Bell },
  promotion: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Megaphone },
};

function formatTimestamp(ts: any): string {
  if (!ts) return 'N/A';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationCenterPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [status, setStatus] = useState<SendStatus>('idle');
  const [lastResult, setLastResult] = useState<{ success: number, failed: number, broadcastId?: string } | null>(null);
  const [activeTab, setActiveTab] = useState('compose');

  const broadcastsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'broadcasts'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  const { data: broadcasts, isLoading: historyLoading } = useCollection<any>(broadcastsRef);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
    reset,
    watch,
  } = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { title: '', body: '', category: 'general', priority: 'normal', sender: 'Apex Admin' },
    mode: 'onChange',
  });

  const selectedCategory = watch('category');
  const selectedPriority = watch('priority');
  const title = watch('title');
  const body = watch('body');
  const sender = watch('sender');

  const handleSendNotification: SubmitHandler<NotificationFormValues> = async (data) => {
    setStatus('sending');
    try {
      const result = await sendNotification(data);
      setLastResult({ success: result.successCount, failed: result.failureCount, broadcastId: result.broadcastId });
      setStatus('success');
      reset();
      toast({ title: 'Notifications Sent', description: `${result.successCount} sent, ${result.failureCount} failed.` });
    } catch (error: any) {
      console.error("Failed to send notifications:", error);
      setStatus('error');
      toast({ title: 'Sending Failed', description: error.message || 'Could not send notifications.', variant: 'destructive' });
    }
  };

  const isLoading = status === 'sending';
  const CategoryIcon = categoryMeta[selectedCategory]?.icon || Megaphone;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 border border-violet-500/20">
              <Bell className="h-5 w-5 text-violet-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Notification Center</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">Broadcast · Push · In-App</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] rounded-2xl p-1 h-12 border border-white/[0.06]">
          <TabsTrigger value="compose" className="rounded-xl font-bold uppercase tracking-[0.12em] text-[10px] gap-2 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-violet-500/20">
            <Megaphone className="h-3 w-3" /> Compose
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl font-bold uppercase tracking-[0.12em] text-[10px] gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-500/20">
            <Clock className="h-3 w-3" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4 space-y-5">
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{broadcasts?.length ?? 0}</p>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Broadcasts</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Smartphone className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{lastResult ? lastResult.success + lastResult.failed : '—'}</p>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Last Reach</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{lastResult ? lastResult.success : '—'}</p>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Pushes Sent</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Compose form */}
            <Card className="lg:col-span-3 border-white/[0.07] bg-[#0A0C12]/80 rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Megaphone className="h-5 w-5 text-violet-400" />
                  Compose Broadcast
                </CardTitle>
                <CardDescription className="text-white/30 text-xs">
                  Build an in-app broadcast and push notification for all users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {status === 'idle' && (
                  <form onSubmit={handleSubmit(handleSendNotification)} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-[11px] font-bold uppercase tracking-wider text-white/40">Title</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Market Update"
                        className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
                        {...register('title')}
                      />
                      {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-[11px] font-bold uppercase tracking-wider text-white/40">Category</Label>
                        <Controller
                          name="category"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger id="category" className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08]">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority" className="text-[11px] font-bold uppercase tracking-wider text-white/40">Priority</Label>
                        <Controller
                          name="priority"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger id="priority" className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08]">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                {priorityOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.priority && <p className="text-sm text-destructive">{errors.priority.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sender" className="text-[11px] font-bold uppercase tracking-wider text-white/40">Sender</Label>
                      <Input
                        id="sender"
                        placeholder="e.g., Apex Admin"
                        className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
                        {...register('sender')}
                      />
                      {errors.sender && <p className="text-sm text-destructive">{errors.sender.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="body" className="text-[11px] font-bold uppercase tracking-wider text-white/40">Body</Label>
                      <Textarea
                        id="body"
                        placeholder="e.g., Bitcoin has reached a new all-time high! This is the full message users will see in-app and in the push notification."
                        className="min-h-[120px] rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
                        {...register('body')}
                      />
                      {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}
                    </div>

                    <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold" type="submit" disabled={!isValid || isLoading}>
                      <Send className="mr-2 h-4 w-4" /> Send to All Users
                    </Button>
                    <p className="text-xs text-white/20 text-center">
                      This will create an in-app broadcast and attempt to push to every user with a registered FCM token.
                    </p>
                  </form>
                )}

                {status === 'sending' && (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
                    <h3 className="text-lg font-semibold text-white">Sending Notifications...</h3>
                    <p className="text-white/30">Broadcasting to all users.</p>
                  </div>
                )}
                {status === 'success' && lastResult && (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                    <CheckCircle className="h-12 w-12 text-emerald-400" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">Broadcast Complete</h3>
                      <p className="text-sm text-white/30 mt-1">In-app broadcast saved to Firestore.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="text-2xl font-bold text-white">{lastResult.success}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-wider">Push Sent</p>
                      </div>
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                        <p className="text-2xl font-bold text-white">{lastResult.failed}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-wider">Push Failed</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <p className="text-2xl font-bold text-white">{lastResult.success + lastResult.failed}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-wider">Total Tokens</p>
                      </div>
                    </div>
                    <Button variant="outline" className="rounded-xl border-white/10 text-white/60 hover:text-white" onClick={() => setStatus('idle')}>Send Another</Button>
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                    <XCircle className="h-12 w-12 text-red-400" />
                    <h3 className="text-lg font-semibold text-white">Sending Failed</h3>
                    <p className="text-white/30 max-w-sm">An error occurred. Check the server logs and ensure the Firebase Admin SDK is initialized.</p>
                    <Button variant="outline" className="rounded-xl border-white/10 text-white/60 hover:text-white" onClick={() => setStatus('idle')}>Try Again</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live preview */}
            <div className="lg:col-span-2 space-y-5">
              <Card className="border-white/[0.07] bg-[#0A0C12]/80 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white/60 font-semibold uppercase tracking-wider">Live Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border", categoryMeta[selectedCategory]?.color || categoryMeta.general.color)}>
                        <CategoryIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{title || 'Notification Title'}</p>
                        <p className="text-[10px] text-white/30 truncate">{sender || 'Apex Admin'} · now</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] uppercase", priorityMeta[selectedPriority]?.color || priorityMeta.normal.color)}>
                        {priorityMeta[selectedPriority]?.label || 'Normal'}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed">{body || 'Your notification body will appear here.'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/[0.07] bg-[#0A0C12]/80 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white/60 font-semibold uppercase tracking-wider">Delivery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <Bell className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">In-App Broadcast</p>
                      <p className="text-[10px] text-white/30">Appears in every user's notification bell.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <Smartphone className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Push Notification</p>
                      <p className="text-[10px] text-white/30">Sent to devices with a registered FCM token.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-white/[0.07] bg-[#0A0C12]/80 rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan-400" />
                Broadcast History
              </CardTitle>
              <CardDescription className="text-white/30 text-xs">
                Previous broadcasts and their push delivery stats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Loading History...</p>
                </div>
              ) : broadcasts && broadcasts.length > 0 ? (
                <div className="space-y-2">
                  {broadcasts.map((b) => (
                    <div key={b.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border", categoryMeta[b.category]?.color || categoryMeta.general.color)}>
                            <Bell className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{b.title}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">{b.sender} · {formatTimestamp(b.createdAt)}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] uppercase", priorityMeta[b.priority]?.color || priorityMeta.normal.color)}>
                          {b.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-white/50 mt-3 leading-relaxed">{b.body}</p>
                      <div className="flex items-center gap-4 mt-3 text-[10px] text-white/30">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400" /> {b.successCount ?? 0} sent</span>
                        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-400" /> {b.failureCount ?? 0} failed</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3 text-violet-400" /> {(b.successCount ?? 0) + (b.failureCount ?? 0)} tokens</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center rounded-2xl border border-white/[0.05]">
                  <Bell className="h-10 w-10 mx-auto mb-4 text-white/[0.06]" />
                  <p className="text-sm font-semibold text-white/20 uppercase tracking-widest">No Broadcasts Yet</p>
                  <p className="text-xs text-white/15 mt-1">Send your first broadcast to see it here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
