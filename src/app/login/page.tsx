
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { Loader2, Copy, Eye, EyeOff } from 'lucide-react';

export default function ConnectWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createWallet, importWallet, loading } = useWallet();
  const [activeTab, setActiveTab] = useState('create');
  const [newMnemonic, setNewMnemonic] = useState('');
  const [importMnemonic, setImportMnemonic] = useState('');
  const [mnemonicVisible, setMnemonicVisible] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const handleCreateWallet = async () => {
    try {
      const mnemonic = await createWallet();
      setNewMnemonic(mnemonic);
      toast({ title: 'Wallet Created!', description: 'Please securely back up your seed phrase.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not create a new wallet. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleImportWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importMnemonic.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your seed phrase.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const success = await importWallet(importMnemonic);
      if (success) {
        toast({ title: 'Wallet Imported', description: 'Successfully imported your wallet.' });
        router.push('/');
      } else {
        throw new Error('Invalid seed phrase');
      }
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: 'The seed phrase you entered is invalid. Please check and try again.',
        variant: 'destructive',
      });
    }
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(newMnemonic);
    setHasCopied(true);
    toast({ title: 'Copied!', description: 'Seed phrase copied to clipboard.' });
  };
  
  const proceedToDashboard = () => {
     router.push('/');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Apex Crypto Wallet</CardTitle>
          <CardDescription>Your gateway to the decentralized web.</CardDescription>
        </CardHeader>
        <CardContent>
          {!newMnemonic ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create New Wallet</TabsTrigger>
                <TabsTrigger value="import">Import Wallet</TabsTrigger>
              </TabsList>
              <TabsContent value="create">
                <div className="space-y-4 pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Create a new secure, non-custodial wallet to start your journey.</p>
                    <Button onClick={handleCreateWallet} className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'Create Wallet'}
                    </Button>
                </div>
              </TabsContent>
              <TabsContent value="import">
                <form onSubmit={handleImportWallet} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="mnemonic-import">Seed Phrase</Label>
                    <Input id="mnemonic-import" type="text" placeholder="Enter your 12-word seed phrase" value={importMnemonic} onChange={(e) => setImportMnemonic(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                     {loading ? <Loader2 className="animate-spin" /> : 'Import Wallet'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4 pt-4 text-center">
                <h3 className="font-semibold text-lg">Your Secure Seed Phrase</h3>
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                    Write this down and store it somewhere safe. Do NOT share it with anyone.
                </p>
                <div className="relative p-4 border rounded-md bg-muted font-mono text-lg tracking-wider space-x-2">
                    <span className={!mnemonicVisible ? 'blur-sm select-none' : ''}>
                        {newMnemonic}
                    </span>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => setMnemonicVisible(!mnemonicVisible)}>
                        {mnemonicVisible ? <EyeOff /> : <Eye />}
                    </Button>
                </div>
                <Button variant="outline" onClick={copyMnemonic} className="w-full">
                    <Copy className="mr-2"/> Copy to Clipboard
                </Button>
                <div className="pt-4">
                     <p className="text-sm text-muted-foreground pb-4">Once you have backed up your phrase, proceed to your wallet.</p>
                     <Button onClick={proceedToDashboard} className="w-full" disabled={!hasCopied}>
                        {hasCopied ? "Proceed to Dashboard" : "Copy Phrase to Proceed"}
                    </Button>
                </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
