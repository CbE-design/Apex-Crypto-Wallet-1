
"use client";

import { useState, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Copy, Loader2, ExternalLink, CheckCircle, XCircle, ShieldCheck, Clock } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';


type SendStatus = 'idle' | 'signing' | 'sending' | 'confirming' | 'success' | 'error';

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, userProfile, requestVerification, fetchOnChainBalance } = useWallet();
  const { user } = useUser();
  const firestore = useFirestore();

  const [sendAsset] = useState('ETH');
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  
  const [status, setStatus] = useState<SendStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  
  const userAddress = wallet?.address || '0x... (address not available)';
  
  const ethWalletQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);
  
  const { data: walletData } = useCollection(ethWalletQuery);
  const ethBalance = useMemo(() => {
    if (!walletData) return 0;
    const ethWallet = walletData.find(w => w.currency === 'ETH');
    return ethWallet ? ethWallet.balance : 0;
  }, [walletData]);

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


  const handleSend = async () => {
    if (!wallet || !wallet.privateKey) {
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
    
    if (!process.env.NEXT_PUBLIC_INFURA_PROJECT_ID) {
        toast({ title: "Configuration Error", description: "Infura Project ID is not set. Cannot connect to Ethereum network.", variant: "destructive"});
        return;
    }

    if (userProfile?.verificationStatus !== 'Verified') {
        toast({ title: "Verification Required", description: "Your account must be verified to send funds.", variant: "destructive"});
        return;
    }

    setStatus('signing');
    
    try {
        const provider = new ethers.InfuraProvider("sepolia", process.env.NEXT_PUBLIC_INFURA_PROJECT_ID);
        const signer = new ethers.Wallet(wallet.privateKey, provider);
        
        const amount = ethers.parseEther(sendAmount);

        setStatus('sending');
        const tx = await signer.sendTransaction({
            to: recipientAddress,
            value: amount,
        });

        setTxHash(tx.hash);
        setStatus('confirming');
        
        await tx.wait(); // Wait for transaction to be mined

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
          description: error.reason || 'Could not complete the transaction.',
          variant: 'destructive',
        });
    }
  };
  
  const resetSendState = () => {
    setStatus('idle');
    setSendAmount('');
    setRecipientAddress('');
    setTxHash('');
    setErrorMessage('');
  }

  const handleCopyAddress = () => {
    if (wallet?.address) {
        navigator.clipboard.writeText(wallet.address);
        toast({
        title: 'Address Copied',
        description: 'Your wallet address has been copied to the clipboard.',
        });
    }
  };
  
  const handleVerificationRequest = () => {
    requestVerification();
    toast({
        title: 'Verification Request Submitted',
        description: 'Your verification is pending and may take up to 72 business hours to complete.',
    });
  }
  
  const isVerified = userProfile?.verificationStatus === 'Verified';
  const isPending = userProfile?.verificationStatus === 'Pending';
  const isSendButtonDisabled = status !== 'idle' || !sendAsset || !sendAmount || !recipientAddress || parseFloat(sendAmount) <= 0 || !isVerified;
  const isInputDisabled = status !== 'idle' && status !== 'error' || !isVerified;

  const getStatusContent = () => {
    switch(status) {
        case 'signing':
        case 'sending':
        case 'confirming':
            return (
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h3 className="text-lg font-semibold capitalize">{status}...</h3>
                    <p className="text-muted-foreground">Please wait while the transaction is processed.</p>
                    {txHash && (
                        <Button variant="link" asChild>
                             <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                                View on Etherscan <ExternalLink className="ml-2" />
                            </a>
                        </Button>
                    )}
                </div>
            );
        case 'success':
            return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <h3 className="text-lg font-semibold">Transaction Sent!</h3>
                    <p className="text-muted-foreground">You have successfully sent {sendAmount} {sendAsset}.</p>
                    {txHash && (
                         <Button variant="link" asChild>
                             <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                                View on Etherscan <ExternalLink className="ml-2" />
                            </a>
                        </Button>
                    )}
                     <Button onClick={resetSendState} className="w-full">Send Another</Button>
                </div>
            );
        case 'error':
             return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <XCircle className="h-12 w-12 text-destructive" />
                    <h3 className="text-lg font-semibold">Transaction Failed</h3>
                    <p className="text-muted-foreground text-xs break-all">{errorMessage}</p>
                    <Button onClick={resetSendState} variant="outline" className="w-full">Try Again</Button>
                </div>
            );
        default:
            return null;
    }
  }

  const renderVerificationStatus = () => {
    if (isVerified) {
        return (
             <Alert variant="default" className="bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <AlertTitle>Account Verified</AlertTitle>
                <AlertDescription>
                    You are fully verified and can now send funds.
                </AlertDescription>
            </Alert>
        )
    }
    if (isPending) {
        return (
             <Alert variant="default" className="bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-500">
                <Clock className="h-4 w-4 text-amber-500" />
                <AlertTitle>Verification Pending</AlertTitle>
                <AlertDescription>
                    Your verification is in review. This may take up to 72 business hours.
                </AlertDescription>
            </Alert>
        )
    }
    return (
        <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Verification Required</AlertTitle>
            <AlertDescription>
                <p className="mb-4">To send funds, you must verify your account. This is a one-time security process.</p>
                <Button onClick={handleVerificationRequest} size="sm">Start Verification</Button>
            </AlertDescription>
        </Alert>
    )
  }

  return (
    <PrivateRoute>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Send Crypto</CardTitle>
            <CardDescription>Send funds to another wallet on the network.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'idle' || status === 'error' ? (
              <>
                <div className="space-y-4">
                    {renderVerificationStatus()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="send-asset">Asset</Label>
                  <Select value={sendAsset} disabled>
                    <SelectTrigger id="send-asset">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ETH">
                          <div className="flex items-center gap-2">
                              <CryptoIcon name="Ethereum" />
                              Ethereum (ETH)
                          </div>
                        </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient-address">Recipient Address</Label>
                  <Input 
                    id="recipient-address" 
                    placeholder="0x..." 
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    disabled={isInputDisabled}
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
                    disabled={isInputDisabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1 h-4">
                        {`Balance: ${ethBalance.toFixed(6)} ETH`}
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
                          You are about to send {sendAmount} {sendAsset} on the Sepolia test network. This action is irreversible and will incur gas fees.
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
                           <div className="text-xs text-amber-500 text-center pt-2">
                              Network fees (gas) will be deducted from your wallet separately.
                          </div>
                      </div>
                      <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSend}>Confirm & Send</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              getStatusContent()
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
    </PrivateRoute>
  );
}

    