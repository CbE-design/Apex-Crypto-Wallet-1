'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  Loader2, Shield, Key, AlertTriangle, ArrowRight,
  Eye, EyeOff, Copy, CheckCircle2, Lock, Mail, Code,
} from 'lucide-react';
import React, { useState } from 'react';
import { EyeWatermark } from '@/components/eye-watermark';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PinSetupDialog } from '@/components/pin-setup-dialog';
import { PinUnlockScreen } from '@/components/pin-unlock-screen';

export default function LoginClient({ initialAdminMode }: { initialAdminMode: boolean }) {
  const router                   = useRouter();
  const { toast }                = useToast();
  const auth                     = useAuth();
  const {
    createWallet, importWallet, loading, user, isAdmin, confirmAndCreateWallet,
    vaultLocked, pendingVaultSetup, hasPasskey, passkeySupported, addressHint,
    setupVault, unlockWithPin, setupPasskey, unlockWithPasskey, disconnectWallet, wallet,
  } = useWallet();

  const [isImporting,            setIsImporting]            = useState(false);
  const [mnemonic,               setMnemonic]               = useState('');
  const [newMnemonic,            setNewMnemonic]            = useState('');
  const [isNewWalletDialogOpen,  setIsNewWalletDialogOpen]  = useState(false);
  const [mnemonicVisible,        setMnemonicVisible]        = useState(false);
  const [copied,                 setCopied]                 = useState(false);
  const [pinSetupOpen,           setPinSetupOpen]           = useState(false);
  const [newWalletEmail,         setNewWalletEmail]         = useState('');
  const [importEmail,            setImportEmail]            = useState('');

  const [showAdminLogin,  setShowAdminLogin]  = useState(initialAdminMode);
  const [adminEmail,      setAdminEmail]      = useState('');
  const [adminPassword,   setAdminPassword]   = useState('');
  const [adminPwVisible,  setAdminPwVisible]  = useState(false);
  const [adminLoading,    setAdminLoading]    = useState(false);

  React.useEffect(() => {
    if (pendingVaultSetup) setPinSetupOpen(true);
  }, [pendingVaultSetup]);

  React.useEffect(() => {
    if (user && wallet && !vaultLocked && !pendingVaultSetup && !pinSetupOpen && !showAdminLogin) {
      router.push('/');
    }
  }, [user, wallet, vaultLocked, pendingVaultSetup, pinSetupOpen, showAdminLogin, router]);

  React.useEffect(() => {
    if (user && isAdmin && !wallet) {
      router.push('/admin');
    }
  }, [user, isAdmin, wallet, router]);

  const handleCreateWallet = async () => {
    try {
      const generated = await createWallet();
      setNewMnemonic(generated);
      setIsNewWalletDialogOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Could not create wallet. Try again.', variant: 'destructive' });
    }
  };

  const handleImportWallet = async () => {
    if (!mnemonic.trim()) {
      toast({ title: 'Seed phrase required', variant: 'destructive' });
      return;
    }
    if (importEmail.trim() && !importEmail.trim().includes('@')) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email or leave it blank.', variant: 'destructive' });
      return;
    }
try {
  await importWallet(mnemonic);
} catch (error: any) {
  toast({ title: 'Import failed', description: 'See console for details.', variant: 'destructive' });
}
};

  const handleConfirmNewWallet = async () => {
    if (!newMnemonic) return;
    if (newWalletEmail.trim() && !newWalletEmail.trim().includes('@')) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email or leave it blank.', variant: 'destructive' });
      return;
    }
    try {
    await confirmAndCreateWallet(newMnemonic);  
      setIsNewWalletDialogOpen(false);
    } catch {
      toast({ title: 'Creation failed', description: 'Could not finalise wallet.', variant: 'destructive' });
    }
  };

  const handleUnlockWithPin = async (pin: string) => {
    await unlockWithPin(pin);
  };

  const handleUnlockWithPasskey = async () => {
    await unlockWithPasskey();
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) return;
    setAdminLoading(true);
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
    } catch (error: any) {
      const msg =
        error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password'
          ? 'Incorrect email or password.'
          : error.code === 'auth/user-not-found'
          ? 'No account found with that email.'
          : error.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a moment.'
          : 'Sign-in failed. Please try again.';
      toast({ title: 'Developer Sign-In Failed', description: msg, variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const copyMnemonic = async () => {
    try {
      await navigator.clipboard.writeText(newMnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = newMnemonic;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error('Copy command failed');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        toast({
          title: 'Copy Failed',
          description: 'Could not copy to clipboard. Please copy the text manually.',
          variant: 'destructive',
        });
      }
    }
  };

  const words = newMnemonic.split(' ').filter(Boolean);

  if (vaultLocked) {
    return (
      <PinUnlockScreen
        addressHint={addressHint}
        hasPasskey={hasPasskey}
        passkeySupported={passkeySupported}
        onUnlockWithPin={handleUnlockWithPin}
        onUnlockWithPasskey={handleUnlockWithPasskey}
        onDisconnect={disconnectWallet}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
        <EyeWatermark className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] text-primary pointer-events-none" opacity={0.04} />

        <div className="flex flex-col items-center mb-10 relative z-10">
          <div className="mb-4">
            <img src="/apex-icon.png" alt="Apex Private Ledger" className="h-16 w-16 rounded-2xl shadow-xl shadow-primary/30" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Apex Private Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Private self-custody crypto ledger</p>
        </div>

        <div className="w-full max-w-sm relative z-10">
          {!showAdminLogin && (
            <>
              <div className="rounded-[28px] border border-white/[0.08] bg-[#0A0C12]/90 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-violet-500" />
                <div className="px-6 pt-7 pb-5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-cyan-400">Secure Connection</span>
                  </div>
                  <h2 className="text-[17px] font-semibold text-white">
                    {isImporting ? 'Import Wallet' : 'Access Your Wallet'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isImporting
                      ? 'Enter your seed phrase to restore access'
                      : 'Create a new wallet or restore from seed phrase'}
                  </p>
                </div>

                <div className="px-6 py-6">
                  {isImporting ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                          Seed Phrase
                        </label>
                        <Textarea
                          placeholder="Enter your 12 or 24 word seed phrase separated by spaces…"
                          value={mnemonic}
                          onChange={e => setMnemonic(e.target.value)}
                          rows={4}
                          disabled={loading}
                          className="bg-white/[0.04] border-white/[0.08] resize-none text-sm font-mono placeholder:text-white/20 focus:border-violet-500/40 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                          Email Address (optional)
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            value={importEmail}
                            onChange={e => setImportEmail(e.target.value)}
                            disabled={loading}
                            className="pl-9 h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm placeholder:text-white/20 focus:border-violet-500/40"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground/40">Used for withdrawal and deposit notifications.</p>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-amber-300/80 leading-relaxed">
                          Never share your seed phrase. Apex will never ask for it outside this setup screen.
                        </p>
                      </div>
                      <Button
                        onClick={handleImportWallet}
                        className="w-full h-11 rounded-xl font-semibold btn-premium text-white"
                        disabled={loading || !mnemonic.trim()}
                      >
                        {loading
                          ? <Loader2 className="animate-spin h-4 w-4" />
                          : <><Key className="h-4 w-4 mr-2" />Restore Wallet</>}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setIsImporting(false)}
                        className="w-full h-10 rounded-xl text-muted-foreground hover:text-white"
                        disabled={loading}
                      >
                        Back
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        onClick={handleCreateWallet}
                        className="w-full h-12 rounded-xl font-semibold btn-premium text-white text-[14px] group"
                        disabled={loading}
                      >
                        {loading
                          ? <Loader2 className="animate-spin h-4 w-4" />
                          : <>Create New Wallet <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" /></>}
                      </Button>
                      <div className="relative flex items-center gap-3">
                        <div className="flex-1 h-px bg-border/40" />
                        <span className="text-[11px] text-muted-foreground uppercase tracking-widest">or</span>
                        <div className="flex-1 h-px bg-border/40" />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setIsImporting(true)}
                        className="w-full h-12 rounded-xl font-semibold border-white/[0.08] bg-white/[0.03] hover:border-violet-500/30 hover:bg-violet-500/5 text-white/50 hover:text-white/80 text-[14px]"
                        disabled={loading}
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Import Existing Wallet
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-6 text-muted-foreground/50">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Shield className="h-3 w-3" />
                  <span>Non-custodial</span>
                </div>
                <div className="h-3 w-px bg-border/30" />
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Shield className="h-3 w-3" />
                  <span>End-to-end encrypted</span>
                </div>
              </div>

              <p className="text-center text-[10px] text-muted-foreground/40 mt-4 max-w-xs mx-auto leading-relaxed">
                By creating or importing a wallet you agree to our{' '}
                <a href="/legal/terms" className="underline hover:text-muted-foreground/60 transition-colors">Terms of Service</a>,{' '}
                <a href="/legal/privacy" className="underline hover:text-muted-foreground/60 transition-colors">Privacy Policy</a>, and{' '}
                <a href="/legal/risk-disclosure" className="underline hover:text-muted-foreground/60 transition-colors">Risk Disclosure</a>.
                Apex Private Ledger is self-custody software — you are solely responsible for your keys and assets.
              </p>
            </>
          )}

          <div className="mt-8">
            {!showAdminLogin ? (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="w-full text-[10px] text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors py-2 flex items-center justify-center gap-1.5"
              >
                <Code className="h-3 w-3" />
                Developer Portal
              </button>
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 backdrop-blur-xl overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-violet-400">Developer Portal</span>
                    </div>
                    <button
                      onClick={() => setShowAdminLogin(false)}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[12px] text-muted-foreground/60 mt-1.5">Sign in with your developer credentials</p>
                </div>
                <form onSubmit={handleAdminSignIn} className="px-5 py-5 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                      <Input
                        type="email"
                        placeholder="admin@apexwallet.io"
                        value={adminEmail}
                        onChange={e => setAdminEmail(e.target.value)}
                        disabled={adminLoading}
                        className="pl-9 h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm placeholder:text-white/20 focus:border-violet-500/40"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                      <Input
                        type={adminPwVisible ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        disabled={adminLoading}
                        className="pl-9 pr-10 h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm placeholder:text-white/20 focus:border-violet-500/40"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setAdminPwVisible(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                      >
                        {adminPwVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-10 rounded-xl font-semibold btn-premium text-white text-[13px] mt-1"
                    disabled={adminLoading || !adminEmail.trim() || !adminPassword.trim()}
                  >
                    {adminLoading
                      ? <Loader2 className="animate-spin h-4 w-4" />
                      : <><Shield className="h-4 w-4 mr-2" />Sign In to Developer Panel</>}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isNewWalletDialogOpen} onOpenChange={setIsNewWalletDialogOpen}>
        <DialogContent className="sm:max-w-md border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-violet-500" />
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-500/5 text-[10px] uppercase tracking-widest">
                Critical Step
              </Badge>
            </div>
            <DialogTitle className="text-[17px] font-semibold text-white">Save Your Seed Phrase</DialogTitle>
            <DialogDescription className="text-sm text-white/30 leading-relaxed">
              Write these words down in order and store them somewhere safe and offline.{' '}
              <strong className="text-red-400">This is the only way to recover your wallet.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="my-2">
            <div
              className={cn(
                'relative rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all cursor-pointer',
                !mnemonicVisible && 'select-none',
              )}
              onClick={() => setMnemonicVisible(v => !v)}
            >
              {!mnemonicVisible && (
                <div className="absolute inset-0 rounded-xl bg-[#07090F]/90 backdrop-blur-md flex flex-col items-center justify-center z-10 gap-2 pointer-events-none">
                  <EyeOff className="h-5 w-5 text-white/25" />
                  <p className="text-[12px] text-white/25">Click to reveal</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {words.map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2 py-1.5 border border-white/[0.06]">
                    <span className="text-[10px] text-white/20 w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="text-[12px] font-mono font-medium text-white/70 truncate">{word}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="w-full mt-2 h-8 text-[12px] text-white/20 hover:text-white/50 rounded-lg flex items-center justify-center gap-1.5 transition-all"
              onClick={copyMnemonic}
            >
              {copied
                ? <><CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />Copied!</>
                : <><Copy className="h-3.5 w-3.5" />Copy to clipboard</>}
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                Email Address (optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={newWalletEmail}
                  onChange={e => setNewWalletEmail(e.target.value)}
                  disabled={loading}
                  className="pl-9 h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:border-violet-500/40"
                />
              </div>
              <p className="text-[10px] text-white/25">Used for withdrawal and deposit notifications.</p>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={handleConfirmNewWallet}
              disabled={loading}
              className="w-full h-11 rounded-xl btn-premium font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "I've Saved My Seed Phrase"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinSetupDialog
        open={pinSetupOpen}
        passkeySupported={passkeySupported}
        onPinConfirmed={async (pin) => {
          await setupVault(pin);
          toast({ title: 'PIN set', description: 'Your wallet is now protected.' });
        }}
        onPasskeySetup={async () => {
          await setupPasskey();
          toast({ title: 'Passkey enabled', description: 'Biometric unlock is ready.' });
        }}
        onSkipPasskey={() => {
          setPinSetupOpen(false);
          router.push('/');
        }}
      />
    </>
  );
}
