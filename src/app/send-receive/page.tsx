
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { portfolioAssets } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, QrCode, Copy, Loader2 } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet } = useWallet();
  const [sendAsset, setSendAsset] = useState(portfolioAssets[0].symbol);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const userAddress = wallet?.address || '0x... (address not available)';
  const networkFee = 0.001; // Example network fee in ETH

  const selectedAssetData = portfolioAssets.find(a => a.symbol === sendAsset);

  const handleSend = () => {
    setIsSending(true);

    // Simulate transaction time
    setTimeout(() => {
        setIsSending(false);
        toast({
          title: 'Transaction Sent',
          description: `You have successfully sent ${sendAmount} ${sendAsset} to ${recipientAddress}.`,
        });
        setSendAmount('');
        setRecipientAddress('');
    }, 2500);
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
  
  const isSendButtonDisabled = !sendAsset || !sendAmount || !recipientAddress || parseFloat(sendAmount) <= 0 || isSending;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Send Crypto</CardTitle>
          <CardDescription>Transfer assets to another wallet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="send-asset">Asset</Label>
            <Select value={sendAsset} onValueChange={setSendAsset} disabled={isSending}>
              <SelectTrigger id="send-asset">
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent>
                {portfolioAssets.map(asset => (
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
              disabled={isSending}
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
              disabled={isSending}
            />
             <p className="text-xs text-muted-foreground mt-1 h-4">
                  {`Balance: ${selectedAssetData?.amount.toFixed(4) ?? '0.00'}`}
              </p>
          </div>
          
           <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={isSendButtonDisabled}>
                    {isSending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                           Send {sendAsset} <ArrowRight className="ml-2" />
                        </>
                    )}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
                <AlertDialogDescription>
                    Please review the details below before confirming the transaction. This action cannot be undone.
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
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Recipient</span>
                        <span className="font-mono break-all text-right">{recipientAddress}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Network Fee</span>
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

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receive Crypto</CardTitle>
          <CardDescription>Share your address to get paid.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 pt-8">
            <div className="p-4 bg-white rounded-lg">
                {/* This is a placeholder for a real QR code generator */}
                <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
                  <path fillRule="evenodd" clipRule="evenodd" d="M0 0H60V60H0V0ZM10 10V50H50V10H10Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M20 20H40V40H20V20Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M100 0H160V60H100V0ZM110 10V50H150V10H110Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M120 20H140V40H120V20Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M0 100H60V160H0V100ZM10 110V150H50V110H10Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M20 120H40V140H20V120Z" fill="currentColor"/>
                  <path d="M70 10H80V20H70V10Z" fill="currentColor"/>
                  <path d="M90 10H100V20H90V10Z" fill="currentColor"/>
                  <path d="M70 30H80V40H70V30Z" fill="currentColor"/>
                  <path d="M90 30H100V40H90V30Z" fill="currentColor"/>
                  <path d="M70 50H80V60H70V50Z" fill="currentColor"/>
                  <path d="M90 50H100V60H90V50Z" fill="currentColor"/>
                  <path d="M10 70H20V80H10V70Z" fill="currentColor"/>
                  <path d="M30 70H40V80H30V70Z" fill="currentColor"/>
                  <path d="M50 70H60V80H50V70Z" fill="currentColor"/>
                  <path d="M70 70H80V70V70Z" fill="currentColor"/>
                  <path d="M90 70H100V80H90V70Z" fill="currentColor"/>
                  <path d="M110 70H120V80H110V70Z" fill="currentColor"/>
                  <path d="M130 70H140V80H130V70Z" fill="currentColor"/>
                  <path d="M150 70H160V80H150V70Z" fill="currentColor"/>
                  <path d="M10 90H20V100H10V90Z" fill="currentColor"/>
                  <path d="M30 90H40V100H30V90Z" fill="currentColor"/>
                  <path d="M50 90H60V100H50V90Z" fill="currentColor"/>
                  <path d="M70 90H80V100H70V90Z" fill="currentColor"/>
                  <path d="M90 90H100V90V90Z" fill="currentColor"/>
                  <path d="M110 90H120V100H110V90Z" fill="currentColor"/>
                  <path d="M130 90H140V100H130V90Z" fill="currentColor"/>
                  <path d="M150 90H160V100H150V90Z" fill="currentColor"/>
                  <path d="M70 110H80V120H70V110Z" fill="currentColor"/>
                  <path d="M90 110H100V120H90V110Z" fill="currentColor"/>
                  <path d="M110 110H120V120H110V110Z" fill="currentColor"/>
                  <path d="M130 110H140V120H130V110Z" fill="currentColor"/>
                  <path d="M70 130H80V140H70V130Z" fill="currentColor"/>
                  <path d="M90 130H100V140H90V130Z" fill="currentColor"/>
                  <path d="M110 130H120V140H110V130Z" fill="currentColor"/>
                  <path d="M130 130H140V140H130V130Z" fill="currentColor"/>
                  <path d="M70 150H80V160H70V150Z" fill="currentColor"/>
                  <path d="M90 150H100V160H90V150Z" fill="currentColor"/>
                  <path d="M110 150H120V160H110V150Z" fill="currentColor"/>
                  <path d="M130 150H140V160H130V150Z" fill="currentColor"/>
                </svg>
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
  );
}
