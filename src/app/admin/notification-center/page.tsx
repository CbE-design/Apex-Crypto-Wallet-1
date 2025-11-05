
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
  title: z.string().min(1, { message: "Title is required." }),
  body: z.string().min(1, { message: "Body is required." }),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function NotificationCenterPage() {
    const { toast } = useToast();
    const [status, setStatus] = useState<SendStatus>('idle');
    const { 
        register, 
        handleSubmit, 
        formState: { errors },
        reset
    } = useForm<NotificationFormValues>({
        resolver: zodResolver(notificationSchema),
    });

    const onSubmit: SubmitHandler<NotificationFormValues> = async (data) => {
        setStatus('sending');
        try {
            const result = await sendNotification(data);
            if (result.successCount > 0) {
                setStatus('success');
                toast({
                    title: 'Notifications Sent!',
                    description: `Successfully sent notification to ${result.successCount} users.`,
                });
            } else {
                 setStatus('error');
                 toast({
                    title: 'No Notifications Sent',
                    description: 'No subscribed users found to send notifications to.',
                    variant: 'destructive',
                });
            }
            reset();
        } catch (error) {
            console.error(error);
            setStatus('error');
            toast({
                title: 'Sending Failed',
                description: 'Could not send notifications. Please try again.',
                variant: 'destructive',
            });
        }
    };
    
    const isLoading = status === 'sending';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground">Send push notifications to all subscribed users.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Compose Notification</CardTitle>
                    <CardDescription>This message will be sent to all users who have enabled notifications.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input 
                                id="title" 
                                placeholder="e.g., System Maintenance Alert"
                                {...register('title')}
                                disabled={isLoading}
                            />
                            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea 
                                id="body" 
                                placeholder="e.g., We will be undergoing scheduled maintenance..."
                                {...register('body')}
                                rows={4}
                                disabled={isLoading}
                            />
                            {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 animate-spin" /> Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2" /> Send Notification
                                </>
                            )}
                        </Button>
                    </form>
                    {status === 'success' && (
                        <div className="mt-4 flex items-center justify-center text-green-500">
                            <CheckCircle className="mr-2" />
                            <p>Notifications sent successfully!</p>
                        </div>
                    )}
                    {status === 'error' && (
                         <div className="mt-4 flex items-center justify-center text-destructive">
                            <XCircle className="mr-2" />
                            <p>An error occurred.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
