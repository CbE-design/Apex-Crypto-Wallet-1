
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { marketCoins } from '@/lib/data';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient address is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
  asset: z.string().min(1, "Asset is required."),
});

type SendFormValues = z.infer<typeof sendSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function DirectSendPage() {
    const { toast } = useToast();
    const { user: adminUser } = useWallet();
    const firestore = useFirestore();

    const [status, setStatus] = useState<SendStatus>('idle');
    const [lastTransaction, setLastTransaction] = useState<{amount: string, recipient: string, asset: string} | null>(null);

    const { 
        register, 
        handleSubmit, 
        formState: { errors, isValid },
        watch,
        reset,
        setValue
    } = useForm<SendFormValues>({
        resolver: zodResolver(sendSchema),
        defaultValues: { recipientAddress: '', amount: '', asset: 'ETH' },
        mode: 'onChange',
    });

    const formValues = watch();

    const handleConfirmSend: SubmitHandler<SendFormValues> = async (data) => {
        if (!adminUser || !firestore) {
            toast({ title: "Cannot process", description: "Admin context missing.", variant: "destructive"});
            return;
        }

        setStatus('sending');
        const amount = parseFloat(data.amount);

        try {
            await runTransaction(firestore, async (transaction) => {
                const usersRef = collection(firestore, 'users');
                const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
                const recipientSnapshot = await getDocs(recipientQuery);

                if (recipientSnapshot.empty) {
                    throw new Error("Recipient address not found in system.");
                }
                const recipientUserDoc = recipientSnapshot.docs[0];
                const recipientUserId = recipientUserDoc.id;

                const recipientWalletRef = doc(firestore, 'users', recipientUserId, 'wallets', data.asset);
                const recipientWalletDoc = await transaction.get(recipientWalletRef);
                const recipientCurrentBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
                
                const newRecipientBalance = recipientCurrentBalance + amount;
                transaction.set(recipientWalletRef, { 
                    balance: newRecipientBalance, 
                    currency: data.asset,
                    id: data.asset,
                    userId: recipientUserId
                }, { merge: true });

                const recipientTxRef = doc(collection(recipientWalletRef, 'transactions'));
                transaction.set(recipientTxRef, {
                    userId: recipientUserId,
                    type: 'Buy',
                    amount: amount,
                    price: 0,
                    timestamp: serverTimestamp(),
                    notes: `System funding from Admin`
                });
            });

            setLastTransaction({ amount: data.amount, recipient: data.recipientAddress, asset: data.asset });
            setStatus('success');
            reset({ asset: data.asset });
        } catch (error: any) {
            console.error("Direct send failed:", error);
            setStatus('error');
            toast({
                title: 'Transaction Failed',
                description: error.message || 'Could not complete the transaction.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Direct Send</h1>
            <p className="text-muted-foreground">Force fund any user wallet for testing purposes.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Fund User Wallet</CardTitle>
                    <CardDescription>Instantly credit a user's wallet with any supported asset.</CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'idle' && (
                        <form onSubmit={handleSubmit(handleConfirmSend)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Asset to Send</Label>
                                <Select defaultValue="ETH" onValueChange={(val) => setValue('asset', val, { shouldValidate: true })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select asset" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {marketCoins.map(coin => (
                                            <SelectItem key={coin.symbol} value={coin.symbol}>
                                                <div className="flex items-center gap-2">
                                                    <CryptoIcon name={coin.name} className="h-4 w-4" />
                                                    {coin.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="recipientAddress">Recipient Address (0x...)</Label>
                                <Input 
                                    id="recipientAddress" 
                                    placeholder="Paste user's primary address"
                                    {...register('recipientAddress')}
                                />
                                {errors.recipientAddress && <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0.00"
                                    {...register('amount')}
                                    step="any"
                                />
                                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                            </div>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button className="w-full" disabled={!isValid}>
                                        <Send className="mr-2" /> Fund Wallet
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Execute Admin Funding</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            You are about to credit {formValues.amount} {formValues.asset} to an account.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleSubmit(handleConfirmSend)}>
                                            Confirm & Execute
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </form>
                    )}
                    
                    {status === 'sending' && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <h3 className="text-lg font-semibold text-primary">Executing Ledger Update...</h3>
                        </div>
                    )}
                    {status === 'success' && lastTransaction && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <h3 className="text-lg font-semibold">Funds Delivered</h3>
                            <p className="text-sm text-muted-foreground">
                                Credited {lastTransaction.amount} {lastTransaction.asset} to user.
                            </p>
                            <Button onClick={() => setStatus('idle')}>Send More</Button>
                        </div>
                    )}
                    {status === 'error' && (
                         <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <h3 className="text-lg font-semibold">Update Failed</h3>
                             <Button variant="outline" onClick={() => setStatus('idle')}>Try Again</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
