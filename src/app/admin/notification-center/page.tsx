
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendNotification } from '@/ai/flows/send-notification-flow';

const notificationSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  body: z.string().min(1, 'Body is required.'),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function NotificationCenterPage() {
    const { toast } = useToast();
    const [status, setStatus] = useState<SendStatus>('idle');
    const [lastResult, setLastResult] = useState<{success: number, failed: number} | null>(null);

    const { 
        register, 
        handleSubmit, 
        formState: { errors, isValid },
        reset
    } = useForm<NotificationFormValues>({
        resolver: zodResolver(notificationSchema),
        defaultValues: { title: '', body: '' },
        mode: 'onChange',
    });

    const handleSendNotification: SubmitHandler<NotificationFormValues> = async (data) => {
        setStatus('sending');
        try {
            const result = await sendNotification(data);
            setLastResult({ success: result.successCount, failed: result.failureCount });
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
                    <CardTitle>Compose Message</CardTitle>
                    <CardDescription>This message will be sent as a push notification to all users who have enabled them.</CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'idle' && (
                         <form onSubmit={handleSubmit(handleSendNotification)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input 
                                    id="title" 
                                    placeholder="e.g., Market Update"
                                    {...register('title')}
                                />
                                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="body">Body</Label>
                                <Textarea
                                    id="body"
                                    placeholder="e.g., Bitcoin has reached a new all-time high!"
                                    {...register('body')}
                                    rows={4}
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
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <h3 className="text-lg font-semibold">Broadcast Complete</h3>
                            <p className="text-muted-foreground">
                                Sent: {lastResult.success} | Failed: {lastResult.failed}
                            </p>
                            <Button onClick={() => setStatus('idle')}>Send Another</Button>
                        </div>
                    )}
                    {status === 'error' && (
                         <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <h3 className="text-lg font-semibold">Sending Failed</h3>
                            <p className="text-muted-foreground">An error occurred. Please check the logs and try again.</p>
                             <Button variant="outline" onClick={() => setStatus('idle')}>Try Again</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
