
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { Loader2 } from 'lucide-react';
import React from 'react';

export default function ConnectWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { connectWallet, loading, user } = useWallet();

  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleConnect = async () => {
    try {
      connectWallet();
      toast({ title: 'Connecting...', description: 'Please wait while we connect your wallet.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not connect wallet. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Apex Crypto Wallet</CardTitle>
          <CardDescription>Your gateway to the decentralized web.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4 pt-4 text-center">
                <p className="text-sm text-muted-foreground">Connect your wallet to get started. A new secure wallet will be created for you if you don't have one.</p>
                <Button onClick={handleConnect} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : 'Connect Wallet'}
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
