
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, CheckCircle, XCircle, Bell, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { NotificationCategorySchema, NotificationPrioritySchema } from '@/lib/types';

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

export default function NotificationCenterPage() {
    const { toast } = useToast();
    const [status, setStatus] = useState<SendStatus>('idle');
    const [lastResult, setLastResult] = useState<{ success: number, failed: number, broadcastId?: string } | null>(null);

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

    const handleSendNotification: SubmitHandler<NotificationFormValues> = async (data) => {
        setStatus('sending');
        try {
            const result = await sendNotification(data);
            setLastResult({ success: result.successCount, failed: result.failureCount, broadcastId: result.broadcastId });
            setStatus('success');
            reset();
            toast({
                title: 'Notifications Sent',
                description: `${result.successCount} sent, ${result.failureCount} failed.`,
            });
        } catch (error: any) {
            console.error("Failed to send notifications:", error);
            setStatus('error');
            toast({
                title: 'Sending Failed',
                description: error.message || 'Could not send notifications.',
                variant: 'destructive',
            });
        }
    };
    
    const isLoading = status === 'sending';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground">Send a push notification to all subscribed users.</p>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Compose Broadcast
                    </CardTitle>
                    <CardDescription>
                        Send an in-app announcement to all users and attempt a native push notification to users with a registered FCM token.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'idle' && (
                         <form onSubmit={handleSubmit(handleSendNotification)} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input 
                                    id="title" 
                                    placeholder="e.g., Market Update"
                                    {...register('title')}
                                />
                                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Controller
                                        name="category"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger id="category">
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
                                    <Label htmlFor="priority">Priority</Label>
                                    <Controller
                                        name="priority"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger id="priority">
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
                                <Label htmlFor="sender">Sender</Label>
                                <Input 
                                    id="sender" 
                                    placeholder="e.g., Apex Admin"
                                    {...register('sender')}
                                />
                                {errors.sender && <p className="text-sm text-destructive">{errors.sender.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="body">Body</Label>
                                <Textarea
                                    id="body"
                                    placeholder="e.g., Bitcoin has reached a new all-time high! This is the full message users will see in-app and in the push notification."
                                    {...register('body')}
                                    rows={5}
                                />
                                {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}
                            </div>

                            <Button className="w-full" type="submit" disabled={!isValid || isLoading}>
                                {isLoading ? (
                                    <><Loader2 className="mr-2 animate-spin" /> Sending...</>
                                ) : (
                                    <><Send className="mr-2" /> Send to All Users</>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                                This will create an in-app broadcast and attempt to send a push notification to every user with a registered FCM token.
                            </p>
                        </form>
                    )}
                    
                    {status === 'sending' && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <h3 className="text-lg font-semibold">Sending Notifications...</h3>
                            <p className="text-muted-foreground">Please wait.</p>
                        </div>
                    )}
                    {status === 'success' && lastResult && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-56">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <div>
                                <h3 className="text-lg font-semibold">Broadcast Complete</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    In-app broadcast saved to Firestore.
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                                    <p className="text-2xl font-bold text-white">{lastResult.success}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Push Sent</p>
                                </div>
                                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                                    <p className="text-2xl font-bold text-white">{lastResult.failed}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Push Failed</p>
                                </div>
                                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                                    <p className="text-2xl font-bold text-white">{lastResult.success + lastResult.failed}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Tokens</p>
                                </div>
                            </div>
                            <Button onClick={() => setStatus('idle')}>Send Another</Button>
                        </div>
                    )}
                    {status === 'error' && (
                         <div className="flex flex-col items-center justify-center text-center space-y-4 h-56">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <h3 className="text-lg font-semibold">Sending Failed</h3>
                            <p className="text-muted-foreground max-w-sm">
                                An error occurred. Check the server logs and ensure the Firebase Admin SDK is initialized.
                            </p>
                             <Button variant="outline" onClick={() => setStatus('idle')}>Try Again</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
