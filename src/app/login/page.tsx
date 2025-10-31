
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

export default function ConnectWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createWallet, importWallet, loading, user } = useWallet();
  const [isImporting, setIsImporting] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [newMnemonic, setNewMnemonic] = useState('');
  const [isNewWalletDialogOpen, setIsNewWalletDialogOpen] = useState(false);

  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleCreateWallet = async () => {
    try {
      const generatedMnemonic = createWallet();
      setNewMnemonic(generatedMnemonic);
      setIsNewWalletDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not create a new wallet. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleImportWallet = async () => {
    if (!mnemonic.trim()) {
      toast({ title: "Mnemonic is required", variant: 'destructive' });
      return;
    }
    try {
      importWallet(mnemonic);
      toast({ title: 'Importing Wallet...', description: 'Please wait while we set up your wallet.' });
    } catch (error: any) {
       toast({
        title: 'Import Failed',
        description: error.message || 'Could not import wallet. Please check your seed phrase and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmNewWallet = () => {
    setIsNewWalletDialogOpen(false);
    toast({ title: 'Wallet Created!', description: 'Your new wallet has been successfully set up.' });
    router.push('/');
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Apex Crypto Wallet</CardTitle>
            <CardDescription>Your gateway to the decentralized web.</CardDescription>
          </CardHeader>
          <CardContent>
            {isImporting ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mnemonic">Seed Phrase (Mnemonic)</Label>
                  <Textarea
                    id="mnemonic"
                    placeholder="Enter your 12 or 24 word seed phrase"
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    rows={4}
                    disabled={loading}
                  />
                </div>
                <Button onClick={handleImportWallet} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Import Wallet'}
                </Button>
                <Button variant="link" onClick={() => setIsImporting(false)} className="w-full" disabled={loading}>
                  Back
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4 text-center">
                <p className="text-sm text-muted-foreground">Create a new wallet or import an existing one.</p>
                <Button onClick={handleCreateWallet} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Create a New Wallet'}
                </Button>
                <Button variant="secondary" onClick={() => setIsImporting(true)} className="w-full" disabled={loading}>
                  Import Existing Wallet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isNewWalletDialogOpen} onOpenChange={setIsNewWalletDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your New Wallet's Seed Phrase</DialogTitle>
            <DialogDescription>
              This is your seed phrase. Write it down and store it in a safe place.
              <strong className="text-destructive"> You will NOT be able to recover your wallet without it.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider">
            {newMnemonic}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button onClick={handleConfirmNewWallet}>I've Saved My Seed Phrase</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
