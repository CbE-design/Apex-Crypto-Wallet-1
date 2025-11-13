
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ethers } from 'ethers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const sendSchema = z.object({
  recipientAddress: z.string().refine(ethers.isAddress, {
    message: "Please enter a valid Ethereum wallet address.",
  }),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
});

type SendFormValues = z.infer<typeof sendSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function DirectSendPage() {
    const { toast } = useToast();
    const { user: adminUser, wallet: adminWallet } = useWallet();
    const firestore = useFirestore();

    const [status, setStatus] = useState<SendStatus>('idle');
    const [lastTransaction, setLastTransaction] = useState<{amount: string, recipient: string} | null>(null);

    const { 
        register, 
        handleSubmit, 
        formState: { errors, isValid },
        watch,
        reset
    } = useForm<SendFormValues>({
        resolver: zodResolver(sendSchema),
        defaultValues: { recipientAddress: '', amount: '' },
        mode: 'onChange',
    });

    const formValues = watch();

    const handleConfirmSend: SubmitHandler<SendFormValues> = async (data) => {
        if (!adminUser || !adminWallet || !firestore) {
            toast({ title: "Cannot process transaction", description: "Admin wallet is not properly configured.", variant: "destructive"});
            return;
        }

        setStatus('sending');
        const amount = parseFloat(data.amount);

        try {
            await runTransaction(firestore, async (transaction) => {
                // Find the recipient user by wallet address
                const usersRef = collection(firestore, 'users');
                const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
                const recipientSnapshot = await getDocs(recipientQuery);

                if (recipientSnapshot.empty) {
                    throw new Error("Recipient address not found in the Apex Wallet system.");
                }
                const recipientUserDoc = recipientSnapshot.docs[0];
                const recipientUserId = recipientUserDoc.id;

                // 1. Get admin's ETH wallet
                const adminWalletRef = doc(firestore, 'users', adminUser.uid, 'wallets', 'ETH');
                const adminWalletDoc = await transaction.get(adminWalletRef);

                if (!adminWalletDoc.exists() || adminWalletDoc.data().balance < amount) {
                    throw new Error(`Insufficient admin balance of ETH.`);
                }

                // 2. Debit admin's wallet
                const newAdminBalance = adminWalletDoc.data().balance - amount;
                transaction.update(adminWalletRef, { balance: newAdminBalance });

                // 3. Log admin's 'send' transaction
                const adminTxRef = doc(collection(adminWalletRef, 'transactions'));
                transaction.set(adminTxRef, {
                    userId: adminUser.uid,
                    type: 'Sell',
                    amount: amount,
                    price: 0, 
                    timestamp: serverTimestamp(),
                    notes: `Sent to user ${recipientUserId}`
                });

                // 4. Get recipient's ETH wallet
                const recipientWalletRef = doc(firestore, 'users', recipientUserId, 'wallets', 'ETH');
                const recipientWalletDoc = await transaction.get(recipientWalletRef);
                const recipientCurrentBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
                
                // 5. Credit recipient's wallet
                const newRecipientBalance = recipientCurrentBalance + amount;
                transaction.set(recipientWalletRef, { 
                    balance: newRecipientBalance, 
                    currency: 'ETH',
                    id: 'ETH',
                    userId: recipientUserId
                }, { merge: true });

                // 6. Log recipient's 'receive' transaction
                const recipientTxRef = doc(collection(recipientWalletRef, 'transactions'));
                transaction.set(recipientTxRef, {
                    userId: recipientUserId,
                    type: 'Buy',
                    amount: amount,
                    price: 0,
                    timestamp: serverTimestamp(),
                    notes: `Received from admin`
                });
            });

            setLastTransaction({ amount: data.amount, recipient: data.recipientAddress });
            setStatus('success');
            reset();
        } catch (error: any) {
            console.error("Admin direct send failed:", error);
            setStatus('error');
            toast({
                title: 'Transaction Failed',
                description: error.message || 'Could not complete the transaction.',
                variant: 'destructive',
            });
        }
    };
    
    const isLoading = status === 'sending';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Direct Send</h1>
            <p className="text-muted-foreground">Send ETH directly to any user by their wallet address.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Fund User Wallet</CardTitle>
                    <CardDescription>The amount will be debited from your admin wallet and sent to the recipient.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(handleConfirmSend)}>
                        {status !== 'sending' && status !== 'success' && status !== 'error' && (
                             <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="recipientAddress">Recipient Wallet Address</Label>
                                    <Input 
                                        id="recipientAddress" 
                                        placeholder="0x..."
                                        {...register('recipientAddress')}
                                    />
                                    {errors.recipientAddress && <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount (ETH)</Label>
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
                                            <Send className="mr-2" /> Review & Send
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You are about to send {formValues.amount || '0.00'} ETH. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-4 py-4 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Asset</span>
                                                <span className="font-medium flex items-center gap-2">
                                                    <CryptoIcon name="Ethereum" />
                                                    {formValues.amount || '0.00'} ETH
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Recipient</span>
                                                <span className="font-mono break-all text-right ml-4">{formValues.recipientAddress || '0x...'}</span>
                                            </div>
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction type="submit">
                                                <Send className="mr-2" />
                                                Confirm & Send
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                    </form>
                    
                    {status === 'sending' && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <h3 className="text-lg font-semibold">Processing Transaction...</h3>
                            <p className="text-muted-foreground">Please wait.</p>
                        </div>
                    )}
                    {status === 'success' && lastTransaction && (
                        <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <h3 className="text-lg font-semibold">Transaction Successful!</h3>
                            <p className="text-muted-foreground">
                                Sent {lastTransaction.amount} ETH to <span className="font-mono text-primary break-all">{lastTransaction.recipient}</span>.
                            </p>
                            <Button onClick={() => setStatus('idle')}>Send Another Transaction</Button>
                        </div>
                    )}
                    {status === 'error' && (
                         <div className="flex flex-col items-center justify-center text-center space-y-4 h-48">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <h3 className="text-lg font-semibold">Transaction Failed</h3>
                            <p className="text-muted-foreground">An error occurred. Please check the details and try again.</p>
                             <Button variant="outline" onClick={() => setStatus('idle')}>Try Again</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
    