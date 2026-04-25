'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  Loader2, Shield, Key, AlertTriangle, ArrowRight,
  Eye, EyeOff, Copy, CheckCircle2, Lock, Mail,
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

export default function ConnectWalletPage() {
  const router       = useRouter();
  const { toast }    = useToast();
  const auth         = useAuth();
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

  // Admin sign-in state
  const [showAdminLogin,  setShowAdminLogin]  = useState(false);
  const [adminEmail,      setAdminEmail]      = useState('');
  const [adminPassword,   setAdminPassword]   = useState('');
  const [adminPwVisible,  setAdminPwVisible]  = useState(false);
  const [adminLoading,    setAdminLoading]    = useState(false);

  // Open PIN setup dialog as soon as wallet is pending vault
  React.useEffect(() => {
    if (pendingVaultSetup) setPinSetupOpen(true);
  }, [pendingVaultSetup]);

  // Redirect once wallet is unlocked and ready, BUT not while the PIN setup
  // dialog is still open (passkey choice step would otherwise vanish in a flash).
  React.useEffect(() => {
    if (user && wallet && !vaultLocked && !pendingVaultSetup && !pinSetupOpen) {
      router.push('/');
    }
  }, [user, wallet, vaultLocked, pendingVaultSetup, pinSetupOpen, router]);

  // Redirect email-based admins straight to the admin panel (no wallet needed)
  React.useEffect(() => {
    if (user && isAdmin && !wallet) {
      router.push('/admin');
    }
  }, [user, isAdmin, wallet, router]);

  // ── handlers ─────────────────────────────────────────────────────────
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
    try {
      await importWallet(mnemonic);
      // PIN setup dialog opens automatically via pendingVaultSetup
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.message || 'Invalid seed phrase.', variant: 'destructive' });
    }
  };

  const handleConfirmNewWallet = async () => {
    if (!newMnemonic) return;
    try {
      await confirmAndCreateWallet(newMnemonic);
      setIsNewWalletDialogOpen(false);
      // PIN setup dialog opens automatically via pendingVaultSetup
    } catch {
      toast({ title: 'Creation failed', description: 'Could not finalise wallet.', variant: 'destructive' });
    }
  };

  const handleUnlockWithPin = async (pin: string) => {
    await unlockWithPin(pin); // throws on wrong PIN
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
      // redirect is handled by the useEffect above
    } catch (error: any) {
      const msg =
        error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password'
          ? 'Incorrect email or password.'
          : error.code === 'auth/user-not-found'
          ? 'No account found with that email.'
          : error.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a moment.'
          : 'Sign-in failed. Please try again.';
      toast({ title: 'Admin Sign-In Failed', description: msg, variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(newMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const words = newMnemonic.split(' ').filter(Boolean);

  // ── vault locked → show PIN screen ───────────────────────────────────
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

  // ── main login UI ─────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
        <EyeWatermark className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] text-primary pointer-events-none" opacity={0.04} />

        {/* Logo */}
        <div className="flex flex-col items-center mb-10 relative z-10">
          <div className="mb-4">
            <img src="/apex-icon.png" alt="Apex Wallet" className="h-16 w-16 rounded-2xl shadow-xl shadow-primary/30" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Apex Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">Institutional-grade crypto custody</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm relative z-10">
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-border/40">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-accent">Secure Connection</span>
              </div>
              <h2 className="text-[17px] font-semibold text-foreground">
                {isImporting ? 'Import Wallet' : 'Access Your Wallet'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isImporting
                  ? 'Enter your seed phrase to restore access'
                  : 'Create a new wallet or restore from seed phrase'}
              </p>
            </div>

            {/* Body */}
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
                      className="bg-muted/30 border-border/60 resize-none text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary/60 rounded-xl"
                    />
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
                    className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground"
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
                    className="w-full h-12 rounded-xl font-semibold border-border/60 hover:border-primary/40 hover:bg-primary/5 text-[14px]"
                    disabled={loading}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Import Existing Wallet
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Trust indicators */}
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

          {/* T&C acceptance notice */}
          <p className="text-center text-[10px] text-muted-foreground/40 mt-4 max-w-xs mx-auto leading-relaxed">
            By creating or importing a wallet you agree to our{' '}
            <a href="/legal/terms" className="underline hover:text-muted-foreground/60 transition-colors">Terms of Service</a>,{' '}
            <a href="/legal/privacy" className="underline hover:text-muted-foreground/60 transition-colors">Privacy Policy</a>, and{' '}
            <a href="/legal/risk-disclosure" className="underline hover:text-muted-foreground/60 transition-colors">Risk Disclosure</a>.
            Crypto assets are high-risk instruments — you may lose your entire investment.
          </p>

          {/* Regulatory footer */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5 text-[9px] text-muted-foreground/30 uppercase tracking-widest">
            <span>FICA Compliant</span>
            <span>·</span>
            <span>FSCA Regulated</span>
            <span>·</span>
            <span>POPIA Compliant</span>
            <span>·</span>
            <span>FATF Travel Rule</span>
          </div>

          {/* Admin portal toggle */}
          <div className="mt-8">
            {!showAdminLogin ? (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="w-full text-[10px] text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors py-2 flex items-center justify-center gap-1.5"
              >
                <Lock className="h-3 w-3" />
                Admin Portal
              </button>
            ) : (
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">Admin Portal</span>
                    </div>
                    <button
                      onClick={() => setShowAdminLogin(false)}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[12px] text-muted-foreground/60 mt-1.5">Sign in with your admin credentials</p>
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
                        className="pl-9 h-10 rounded-xl bg-muted/30 border-border/50 text-sm placeholder:text-muted-foreground/30 focus:border-primary/50"
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
                        className="pl-9 pr-10 h-10 rounded-xl bg-muted/30 border-border/50 text-sm placeholder:text-muted-foreground/30 focus:border-primary/50"
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
                      : <><Shield className="h-4 w-4 mr-2" />Sign In to Admin Panel</>}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seed phrase backup dialog */}
      <Dialog open={isNewWalletDialogOpen} onOpenChange={setIsNewWalletDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/60 bg-card">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[10px] uppercase tracking-widest">
                Critical Step
              </Badge>
            </div>
            <DialogTitle className="text-[17px] font-semibold">Save Your Seed Phrase</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Write these words down in order and store them somewhere safe and offline.{' '}
              <strong className="text-destructive">This is the only way to recover your wallet.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="my-2">
            <div
              className={cn(
                'relative rounded-xl border border-border/60 bg-muted/30 p-4 transition-all cursor-pointer',
                !mnemonicVisible && 'select-none',
              )}
              onClick={() => setMnemonicVisible(v => !v)}
            >
              {!mnemonicVisible && (
                <div className="absolute inset-0 rounded-xl bg-card/80 backdrop-blur-md flex flex-col items-center justify-center z-10 gap-2 pointer-events-none">
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                  <p className="text-[12px] text-muted-foreground">Click to reveal</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {words.map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-background/60 rounded-lg px-2 py-1.5 border border-border/40">
                    <span className="text-[10px] text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="text-[12px] font-mono font-medium text-foreground truncate">{word}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              variant="ghost" size="sm"
              className="w-full mt-2 h-8 text-[12px] text-muted-foreground hover:text-foreground rounded-lg"
              onClick={copyMnemonic}
            >
              {copied
                ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-accent" />Copied!</>
                : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy to clipboard</>}
            </Button>
          </div>

          <DialogFooter>
            <Button
              onClick={handleConfirmNewWallet}
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold btn-premium text-white"
            >
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "I've Saved My Seed Phrase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN vault setup dialog — shown after seed phrase is confirmed */}
      <PinSetupDialog
        open={pinSetupOpen}
        passkeySupported={passkeySupported}
        onPinConfirmed={async (pin) => {
          await setupVault(pin);
          toast({ title: 'PIN set', description: 'Your wallet is now protected.' });
          // dialog stays open for passkey step — handled inside PinSetupDialog
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
