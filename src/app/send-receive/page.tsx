
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Copy, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDocs, where, limit } from 'firebase/firestore';

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, user } = useWallet();
  const firestore = useFirestore();

  const sendAsset = 'ETH'; 
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  
  const [status, setStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  
  const userAddress = wallet?.address || '0x... (address not available)';
  
  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);

  const selectedAssetBalance = ethWallet?.balance ?? 0;

  const resetSendState = useCallback(() => {
    setStatus('idle');
    setSendAmount('');
    setRecipientAddress('');
    setErrorMessage('');
  }, []);

  useEffect(() => {
    if (wallet?.address) {
      QRCode.toDataURL(wallet.address, { errorCorrectionLevel: 'H', width: 160 })
        .then(url => {
          setQrCodeDataUrl(url);
        })
        .catch(err => {
          console.error('Failed to generate QR code', err);
        });
    }
  }, [wallet?.address]);


  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(() => {
        resetSendState();
      }, 3000); // Reset after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [status, resetSendState]);


  const handleSend = async () => {
    if (!wallet || !user || !firestore) {
        toast({ title: "Cannot process transaction", description: "User wallet is not properly configured.", variant: "destructive"});
        return;
    }

    if (!ethers.isAddress(recipientAddress)) {
      toast({ title: "Invalid Address", description: "The recipient address is not a valid Ethereum address.", variant: "destructive"});
      return;
    }
    
    if (recipientAddress.toLowerCase() === wallet.address.toLowerCase()) {
        toast({ title: "Invalid Recipient", description: "You cannot send assets to your own wallet.", variant: "destructive"});
        return;
    }

    setStatus('sending');
    
    try {
        const amount = parseFloat(sendAmount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Invalid amount specified.");
        }

        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", recipientAddress), limit(1));
            const recipientSnapshot = await getDocs(recipientQuery);

            if (recipientSnapshot.empty) {
                throw new Error("Recipient address not found in the system.");
            }

            const recipientDoc = recipientSnapshot.docs[0];
            const recipientId = recipientDoc.id;

            const senderWalletRef = doc(firestore, 'users', user.uid, 'wallets', sendAsset);
            const senderWalletDoc = await transaction.get(senderWalletRef);

            const senderBalance = senderWalletDoc.exists() ? senderWalletDoc.data().balance : 0;
            if (senderBalance < amount) {
                throw new Error(`Insufficient balance. You only have ${senderBalance.toFixed(6)} ${sendAsset}.`);
            }

            // 1. Debit sender
            const newSenderBalance = senderBalance - amount;
            transaction.update(senderWalletRef, { balance: newSenderBalance });

            // 2. Create sender transaction log
            const senderTxLogRef = doc(collection(senderWalletRef, 'transactions'));
            transaction.set(senderTxLogRef, {
              userId: user.uid,
              type: 'Sell',
              amount: amount,
              price: 0, 
              timestamp: serverTimestamp(),
              status: 'Completed',
              recipient: recipientAddress,
              sender: userAddress,
            });

            // 3. Credit recipient
            const recipientWalletRef = doc(firestore, 'users', recipientId, 'wallets', sendAsset);
            const recipientWalletDoc = await transaction.get(recipientWalletRef);
            const recipientBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
            const newRecipientBalance = recipientBalance + amount;
            
            transaction.set(recipientWalletRef, { 
                balance: newRecipientBalance,
                currency: sendAsset,
                id: sendAsset,
                userId: recipientId
             }, { merge: true });

            // 4. Create recipient transaction log
            const recipientTxLogRef = doc(collection(recipientWalletRef, 'transactions'));
            transaction.set(recipientTxLogRef, {
              userId: recipientId,
              type: 'Buy',
              amount: amount,
              price: 0,
              timestamp: serverTimestamp(),
              status: 'Completed',
              sender: userAddress,
              recipient: recipientAddress,
            });
        });

        setStatus('success');
        toast({
          title: 'Transaction Successful',
          description: `Successfully sent ${sendAmount} ${sendAsset}.`,
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
  
  const isSendButtonDisabled = status !== 'idle' || !sendAmount || !recipientAddress || parseFloat(sendAmount) <= 0 || parseFloat(sendAmount) > selectedAssetBalance;

  return (
    <PrivateRoute>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Send Crypto</CardTitle>
            <CardDescription>Send funds to another wallet on the network.</CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'idle' ? (
                <div className="space-y-4">
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
                            value={recipientAddress}
                            onChange={(e) => setRecipientAddress(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="send-amount">Amount</Label>
                        <Input
                            id="send-amount"
                            type="number"
                            placeholder="0.00"
                            value={sendAmount}
                            onChange={(e) => setSendAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1 h-4">
                            {`Balance: ${selectedAssetBalance.toFixed(6)} ${sendAsset}`}
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button className="w-full" disabled={isSendButtonDisabled}>
                                Send {sendAsset} <ArrowRight className="ml-2" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to send {sendAmount} {sendAsset}. This action is for simulation purposes.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-4 py-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Asset</span>
                                    <span className="font-medium flex items-center gap-2">
                                        <CryptoIcon name="Ethereum" />
                                        {sendAmount} {sendAsset}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Recipient</span>
                                    <span className="font-mono break-all text-right ml-4">{recipientAddress}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base pt-2 border-t">
                                    <span>Total</span>
                                    <span>{sendAmount} {sendAsset}</span>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSend}>Confirm & Send</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            ) : status === 'sending' ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h3 className="text-lg font-semibold capitalize">Processing...</h3>
                    <p className="text-muted-foreground">Please wait while the virtual transaction is processed.</p>
                </div>
            ) : status === 'success' ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <h3 className="text-lg font-semibold">Transaction Sent!</h3>
                    <p className="text-muted-foreground">You have successfully sent {sendAmount} {sendAsset}.</p>
                </div>
            ) : status === 'error' ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 h-64">
                    <XCircle className="h-12 w-12 text-destructive" />
                    <h3 className="text-lg font-semibold">Transaction Failed</h3>
                    <p className="text-muted-foreground text-xs break-all">{errorMessage}</p>
                </div>
            ) : null}
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
    </PrivateRoute>
  );
}
