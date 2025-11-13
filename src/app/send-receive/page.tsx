
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Copy, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDocs, where, limit } from 'firebase/firestore';

const sendSchema = z.object({
  recipientAddress: z.string().refine(ethers.isAddress, {
    message: "Please enter a valid Ethereum wallet address.",
  }),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
});

type SendFormValues = z.infer<typeof sendSchema>;
type SendStatus = 'idle' | 'confirming' | 'sending' | 'success' | 'error';

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, user } = useWallet();
  const firestore = useFirestore();
  const sendAsset = 'ETH';

  const [status, setStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const userAddress = wallet?.address || '...';
  
  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);
  const selectedAssetBalance = ethWallet?.balance ?? 0;

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

  const resetSendState = useCallback(() => {
    setStatus('idle');
    setErrorMessage('');
    reset({ recipientAddress: '', amount: '' });
  }, [reset]);

  useEffect(() => {
    if (wallet?.address) {
      QRCode.toDataURL(wallet.address, { errorCorrectionLevel: 'H', width: 160 })
        .then(setQrCodeDataUrl)
        .catch(err => console.error('Failed to generate QR code', err));
    }
  }, [wallet?.address]);

  const handleSendSubmit = (data: SendFormValues) => {
     if (data.recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
        toast({ title: "Invalid Recipient", description: "You cannot send assets to your own wallet.", variant: "destructive"});
        return;
    }
    if (parseFloat(data.amount) > selectedAssetBalance) {
        toast({ title: "Insufficient Funds", description: `Your balance of ${selectedAssetBalance.toFixed(4)} ETH is not enough.`, variant: "destructive"});
        return;
    }
    setStatus('confirming');
  };

  const executeSend = async () => {
    if (!wallet || !user || !firestore) return;
    setStatus('sending');
    
    try {
        const amount = parseFloat(formValues.amount);

        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", formValues.recipientAddress), limit(1));
            
            const senderWalletRef = doc(firestore, 'users', user.uid, 'wallets', sendAsset);
            const senderWalletDoc = await transaction.get(senderWalletRef);
            
            const recipientSnapshot = await getDocs(recipientQuery);
            if (recipientSnapshot.empty) {
                throw new Error("Recipient address not found in the Apex Wallet system.");
            }
            const recipientDoc = recipientSnapshot.docs[0];
            const recipientId = recipientDoc.id;
            const recipientWalletRef = doc(firestore, 'users', recipientId, 'wallets', sendAsset);
            
            const senderBalance = senderWalletDoc.exists() ? senderWalletDoc.data().balance : 0;
            if (senderBalance < amount) {
                throw new Error(`Insufficient balance. You only have ${senderBalance.toFixed(6)} ${sendAsset}.`);
            }
            
            const recipientWalletDoc = await transaction.get(recipientWalletRef);
            const newSenderBalance = senderBalance - amount;
            const recipientBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
            const newRecipientBalance = recipientBalance + amount;

            transaction.update(senderWalletRef, { balance: newSenderBalance });
            const senderTxLogRef = doc(collection(senderWalletRef, 'transactions'));
            transaction.set(senderTxLogRef, {
              userId: user.uid, type: 'Sell', amount: amount, price: 0, 
              timestamp: serverTimestamp(), status: 'Completed',
              recipient: formValues.recipientAddress, sender: userAddress,
            });

            transaction.set(recipientWalletRef, { 
                balance: newRecipientBalance, currency: sendAsset,
                id: sendAsset, userId: recipientId
             }, { merge: true });
            const recipientTxLogRef = doc(collection(recipientWalletRef, 'transactions'));
            transaction.set(recipientTxLogRef, {
              userId: recipientId, type: 'Buy', amount: amount, price: 0,
              timestamp: serverTimestamp(), status: 'Completed',
              sender: userAddress, recipient: formValues.recipientAddress,
            });
        });

        setStatus('success');
        toast({
          title: 'Transaction Successful',
          description: `Successfully sent ${formValues.amount} ${sendAsset}.`,
        });

    } catch (error: any) {
        console.error("Transaction failed:", error);
        setStatus('error');
        setErrorMessage(error.message || 'An unknown error occurred.');
        toast({
          title: 'Transaction Failed',
          description: error.message || 'Could not complete the transaction.',
          variant: 'destructive',
        });
    }
  };

  const handleCopyAddress = () => {
    if (wallet?.address) {
        navigator.clipboard.writeText(wallet.address);
        toast({
        title: 'Address Copied',
        description: 'Your wallet address has been copied to the clipboard.',
        });
    }
  };
  
  const renderStatus = () => {
      switch (status) {
          case 'sending':
              return (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <h3 className="text-lg font-semibold">Processing Transaction...</h3>
                      <p className="text-muted-foreground">Please wait.</p>
                  </div>
              );
          case 'success':
              return (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                      <CheckCircle className="h-12 w-12 text-green-500" />
                      <h3 className="text-lg font-semibold">Transaction Sent!</h3>
                      <p className="text-muted-foreground">You successfully sent {formValues.amount} {sendAsset}.</p>
                      <Button onClick={resetSendState}>Send Another Transaction</Button>
                  </div>
              );
          case 'error':
              return (
                   <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                      <XCircle className="h-12 w-12 text-destructive" />
                      <h3 className="text-lg font-semibold">Transaction Failed</h3>
                      <p className="text-muted-foreground text-xs break-all">{errorMessage}</p>
                      <Button variant="outline" onClick={resetSendState}>Try Again</Button>
                  </div>
              );
          default:
              return null;
      }
  };
  
  return (
    <PrivateRoute>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Send Crypto</CardTitle>
            <CardDescription>Send funds to another wallet on the network.</CardDescription>
          </CardHeader>
          <CardContent>
            {status !== 'idle' && status !== 'confirming' ? renderStatus() : (
              <form onSubmit={handleSubmit(handleSendSubmit)} className="space-y-4">
                  {selectedAssetBalance === 0 && (
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center space-y-2">
                          <h4 className="font-semibold">Your ETH balance is zero</h4>
                          <p className="text-sm text-muted-foreground">You can receive ETH from another user to get started.</p>
                      </div>
                  )}
                  <div className="space-y-2">
                      <Label htmlFor="send-asset">Asset</Label>
                       <div className="flex items-center gap-2 p-2 rounded-md bg-muted w-full">
                          <CryptoIcon name="Ethereum" />
                          <span className="font-semibold">Ethereum (ETH)</span>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="recipient-address">Recipient Address</Label>
                      <Input
                          id="recipient-address"
                          placeholder="0x..."
                          {...register('recipientAddress')}
                      />
                      {errors.recipientAddress && <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>}
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="send-amount">Amount</Label>
                      <Input
                          id="send-amount"
                          type="number"
                          placeholder="0.00"
                          step="any"
                          {...register('amount')}
                      />
                      {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1 h-4">
                          {`Balance: ${selectedAssetBalance.toFixed(6)} ${sendAsset}`}
                      </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={!isValid}>
                      Send {sendAsset} <ArrowRight className="ml-2" />
                  </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receive Crypto</CardTitle>
            <CardDescription>Share your address to get paid.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-8">
              <div className="p-4 bg-white rounded-lg">
                  {qrCodeDataUrl ? (
                      <Image src={qrCodeDataUrl} alt="Wallet QR Code" width={160} height={160} />
                  ) : (
                      <div className="w-[160px] h-[160px] bg-muted animate-pulse rounded-md" />
                  )}
              </div>
              <p className="text-sm text-center text-muted-foreground">Your primary wallet address:</p>
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted w-full justify-center">
                  <code className="text-sm break-all text-center">{userAddress}</code>
                  <Button variant="ghost" size="icon" onClick={handleCopyAddress} disabled={!wallet?.address}>
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">Copy address</span>
                  </Button>
              </div>
          </CardContent>
        </Card>
      </div>

       <AlertDialog open={status === 'confirming'} onOpenChange={(open) => !open && setStatus('idle')}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
                  <AlertDialogDescription>
                      You are about to send {formValues.amount} {sendAsset}. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Asset</span>
                      <span className="font-medium flex items-center gap-2">
                          <CryptoIcon name="Ethereum" />
                          {formValues.amount} {sendAsset}
                      </span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Recipient</span>
                      <span className="font-mono break-all text-right ml-4">{formValues.recipientAddress}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span>Total</span>
                      <span>{formValues.amount} {sendAsset}</span>
                  </div>
              </div>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setStatus('idle')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={executeSend}>Confirm & Send</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </PrivateRoute>
  );
}
