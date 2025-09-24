
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { portfolioAssets } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, QrCode, Copy } from 'lucide-react';

export default function SendReceivePage() {
  const { toast } = useToast();
  const [sendAsset, setSendAsset] = useState(portfolioAssets[0].symbol);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  
  const userAddress = '0x1234...AbCdEfgH5678'; // Example user address

  const handleSend = () => {
    if (!sendAsset || !sendAmount || !recipientAddress || parseFloat(sendAmount) <= 0) {
      toast({
        title: 'Invalid Input',
        description: 'Please fill out all fields correctly.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Transaction Sent',
      description: `You have successfully sent ${sendAmount} ${sendAsset} to ${recipientAddress}.`,
    });
    setSendAmount('');
    setRecipientAddress('');
  };
  
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(userAddress);
    toast({
      title: 'Address Copied',
      description: 'Your wallet address has been copied to the clipboard.',
    });
  };

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
            <Select value={sendAsset} onValueChange={setSendAsset}>
              <SelectTrigger id="send-asset">
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent>
                {portfolioAssets.map(asset => (
                  <SelectItem key={asset.symbol} value={asset.symbol}>
                    {asset.name} ({asset.symbol})
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
          </div>
          <Button className="w-full" onClick={handleSend}>
            Send {sendAsset} <ArrowRight className="ml-2" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receive Crypto</CardTitle>
          <CardDescription>Share your address to get paid.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 pt-8">
            <div className="p-4 bg-white rounded-lg">
                <QrCode className="h-40 w-40 text-black" />
            </div>
            <p className="text-sm text-center text-muted-foreground">Your primary wallet address:</p>
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted w-full justify-center">
                <code className="text-sm break-all text-center">{userAddress}</code>
                <Button variant="ghost" size="icon" onClick={handleCopyAddress}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy address</span>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
