
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
import { portfolioAssets } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Copy, Loader2, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';


type SendStatus = 'idle' | 'signing' | 'sending' | 'confirming' | 'success' | 'error';

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet } = useWallet();
  const [sendAsset, setSendAsset] = useState('ETH');
  const [sendAmount, setSendAmount = useState('');
  const [recipientAddress, setRecipientAddress = useState('');
  
  const [status, setStatus] = useState<SendStatus>('idle');
  const [txHash, setTxHash = useState('');
  const [errorMessage, setErrorMessage = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl = useState('');
  
  const userAddress = wallet?.address || '0x... (address not available)';
  const networkFee = 0.001; // Example network fee in ETH

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


  const selectedAssetData = portfolioAssets.find(a => a.symbol === sendAsset);

  const handleSend = async () => {
    if (!wallet || !selectedAssetData || sendAsset !== 'ETH') {
        toast({ title: "Transfer not supported", description: "Currently, only ETH transfers are supported.", variant: "destructive"});
        return;
    }

    if (!ethers.isAddress(recipientAddress)) {
      toast({ title: "Invalid Address", description: "The recipient address is not a valid Ethereum address.", variant: "destructive"});
      return;
    }

    setStatus('signing');
    
    try {
        const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_PROJECT_ID}`);
        const signer = new ethers.Wallet(wallet.privateKey, provider);

        const transaction = {
            to: recipientAddress,
            value: ethers.parseEther(sendAmount) 
        };

        setStatus('sending');
        const txResponse = await signer.sendTransaction(transaction);
        setTxHash(txResponse.hash);

        setStatus('confirming');
        await txResponse.wait();

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
          description: 'Could not complete the transaction. Please check the details and try again.',
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
  
  const isSendButtonDisabled = status !== 'idle' || !sendAsset || !sendAmount || !recipientAddress || parseFloat(sendAmount) <= 0;
  const isInputDisabled = status !== 'idle' && status !== 'error';

  const getStatusContent = () => {
    switch(status) {
        case 'signing':
        case 'sending':
        case 'confirming':
            return (
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h3 className="text-lg font-semibold">{status === 'confirming' ? "Confirming Transaction" : "Sending Transaction"}</h3>
                    <p className="text-muted-foreground">{status === 'confirming' ? "Waiting for blockchain confirmation..." : "Please wait while we broadcast your transaction."}</p>
                    {txHash && (
                        <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                            View on Etherscan <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            );
        case 'success':
            return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <h3 className="text-lg font-semibold">Transaction Successful!</h3>
                    <p className="text-muted-foreground">You have successfully sent {sendAmount} {sendAsset}.</p>
                    <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                        View on Etherscan <ExternalLink className="h-3 w-3" />
                    </a>
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

  return (
    <PrivateRoute>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Send Crypto</CardTitle>
            <CardDescription>Transfer assets to another wallet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'idle' || status === 'error' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="send-asset">Asset</Label>
                  <Select value={sendAsset} onValueChange={setSendAsset} disabled={isInputDisabled}>
                    <SelectTrigger id="send-asset">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {portfolioAssets.filter(a => a.symbol === 'ETH').map(asset => (
                        <SelectItem key={asset.symbol} value={asset.symbol}>
                          <div className="flex items-center gap-2">
                              <CryptoIcon name={asset.name} />
                              {asset.name} ({asset.symbol})
                          </div>
                        </SelectItem>
                      ))}
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
                        {`Balance: ${selectedAssetData?.amount.toFixed(4) ?? '0.00'}`}
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
                          You are about to send {sendAmount} {sendAsset}. This action is irreversible. 
                          Please double-check the recipient's address below. 
                          <strong className="text-destructive">Apex Wallet is not responsible for funds sent to the wrong address.</strong>
                      </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4 text-sm">
                          <div className="flex justify-between">
                              <span className="text-muted-foreground">Asset</span>
                              <span className="font-medium flex items-center gap-2">
                                  <CryptoIcon name={selectedAssetData?.name ?? ''} />
                                  {sendAmount} {sendAsset}
                              </span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Recipient</span>
                              <span className="font-mono break-all text-right ml-4">{recipientAddress}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-muted-foreground">Est. Network Fee</span>
                              <span className="font-mono">~{networkFee} ETH</span>
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

    