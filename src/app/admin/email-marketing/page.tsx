
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
import { Loader2, Send, CheckCircle, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/ai/flows/send-email-flow';

const emailSchema = z.object({
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function EmailMarketingPage() {
    const { toast } = useToast();
    const [status, setStatus] = useState<SendStatus>('idle');
    const [lastResult, setLastResult] = useState<{success: boolean, message: string} | null>(null);

    const { 
        register, 
        handleSubmit, 
        formState: { errors, isValid },
        reset
    } = useForm<EmailFormValues>({
        resolver: zodResolver(emailSchema),
        defaultValues: { subject: '', body: '' },
        mode: 'onChange',
    });

    const handleSendEmail: SubmitHandler<EmailFormValues> = async (data) => {
        setStatus('sending');
        try {
            const result = await sendEmail(data);
            setLastResult(result);
            setStatus(result.success ? 'success' : 'error');
            if (result.success) {
                toast({
                    title: 'Emails Sent',
                    description: result.message,
                });
                reset();
            } else {
                toast({
                    title: 'Sending Failed',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error("Failed to send email:", error);
            setStatus('error');
            setLastResult({ success: false, message: error.message || 'Could not send email campaign.' });
            toast({
                title: 'Sending Failed',
                description: error.message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        }
    };
    
    const isLoading = status === 'sending';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Email Marketing</h1>
            <p className="text-muted-foreground">Send an email campaign to all registered users.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Compose Email</CardTitle>
                    <CardDescription>This email will be sent to all users with a valid email address.</CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'idle' && (
                         <form onSubmit={handleSubmit(handleSendEmail)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Subject</Label>
                                <Input 
                                    id="subject" 
                                    placeholder="e.g., A Special Announcement"
                                    {...register('subject')}
                                />
                                {errors.subject && <p className="text-sm text-destructive">{errors.subject.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="body">Body (HTML is supported)</Label>
                                <Textarea
                                    id="body"
                                    placeholder="e.g., <h1>Hello!</h1><p>Here's our latest news...</p>"
                                    {...register('body')}
                                    rows={10}
                                />
                                {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}
                            </div>
                            <Button className="w-full" type="submit" disabled={!isValid || isLoading}>
                                {isLoading ? (
                                    <><Loader2 className="mr-2 animate-spin" /> Sending...</>
                                ) : (
                                    <><Mail className="mr-2" /> Send to All Users</>
                                )}
                            </Button>
                        </form>
                    )}
                    
                    {status === 'sending' && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-72">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <h3 className="text-lg font-semibold">Sending Email Campaign...</h3>
                            <p className="text-muted-foreground">Please wait.</p>
                        </div>
                    )}
                    {status === 'success' && lastResult && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-72">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <h3 className="text-lg font-semibold">Campaign Sent!</h3>
                            <p className="text-muted-foreground">
                                {lastResult.message}
                            </p>
                            <Button onClick={() => setStatus('idle')}>Send Another</Button>
                        </div>
                    )}
                    {status === 'error' && lastResult && (
                         <div className="flex flex-col items-center justify-center text-center space-y-4 h-72">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <h3 className="text-lg font-semibold">Sending Failed</h3>
                            <p className="text-muted-foreground max-w-sm">{lastResult.message}</p>
                             <Button variant="outline" onClick={() => setStatus('idle')}>Try Again</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
