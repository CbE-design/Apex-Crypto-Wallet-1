'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint, LogOut } from 'lucide-react';
import { PinPad } from '@/components/pin-pad';
import { EyeWatermark } from '@/components/eye-watermark';
import { cn } from '@/lib/utils';

interface PinUnlockScreenProps {
  addressHint: string;
  hasPasskey: boolean;
  passkeySupported: boolean;
  onUnlockWithPin: (pin: string) => Promise<void>;
  onUnlockWithPasskey: () => Promise<void>;
  onDisconnect: () => void;
}

const MAX_ATTEMPTS = 5;

export function PinUnlockScreen({
  addressHint,
  hasPasskey,
  passkeySupported,
  onUnlockWithPin,
  onUnlockWithPasskey,
  onDisconnect,
}: PinUnlockScreenProps) {
  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState('');
  const [shake,    setShake]    = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [attempts, setAttempts] = useState(0);

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setPin('');
  };

  const handleUnlock = async (p: string) => {
    if (p.length < 6) return;
    if (attempts >= MAX_ATTEMPTS) return;
    setBusy(true);
    setError('');
    try {
      await onUnlockWithPin(p);
    } catch {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        triggerShake('Too many attempts — please restore your wallet');
      } else {
        triggerShake(`Incorrect PIN (${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining)`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasskey = async () => {
    setBusy(true);
    setError('');
    try {
      await onUnlockWithPasskey();
    } catch (e: any) {
      triggerShake(e?.message?.includes('cancel') ? 'Passkey cancelled' : 'Biometric authentication failed');
    } finally {
      setBusy(false);
    }
  };

  // Auto-unlock when 6 digits entered
  React.useEffect(() => {
    if (pin.length === 6) handleUnlock(pin);
  }, [pin]);

  const locked = attempts >= MAX_ATTEMPTS;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
      <EyeWatermark className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] text-primary pointer-events-none" opacity={0.04} />

      {/* Logo */}
      <div className="flex flex-col items-center mb-10 relative z-10">
        <img src="/apex-icon.png" alt="Apex Wallet" className="h-16 w-16 rounded-2xl shadow-xl shadow-primary/30 mb-4" />
        <h1 className="text-2xl font-bold tracking-tight text-white">Apex Wallet</h1>
        {addressHint && (
          <p className="text-[12px] text-muted-foreground mt-1 font-mono">{addressHint}</p>
        )}
      </div>

      {/* Card */}
      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-border/40">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest font-semibold text-accent">Locked</span>
            </div>
            <h2 className="text-[17px] font-semibold text-foreground">Enter your PIN</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {locked ? 'Too many failed attempts.' : 'Enter your 6-digit PIN to access your wallet.'}
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {!locked && (
              <div className={cn('transition-all', shake && 'animate-shake')}>
                <PinPad
                  value={pin}
                  onChange={setPin}
                  error={!!error}
                  disabled={busy || locked}
                />
              </div>
            )}

            {error && (
              <p className="text-center text-[12px] text-destructive">{error}</p>
            )}

            {busy && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            {hasPasskey && passkeySupported && !locked && (
              <>
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl border-border/60 hover:border-accent/40 hover:bg-accent/5 font-semibold"
                  onClick={handlePasskey}
                  disabled={busy}
                >
                  <Fingerprint className="h-4 w-4 mr-2 text-accent" />
                  Use Passkey
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground/60 hover:text-muted-foreground text-[12px] mt-1"
              onClick={onDisconnect}
              disabled={busy}
            >
              <LogOut className="h-3 w-3 mr-1.5" />
              {locked ? 'Restore Wallet' : 'Sign out'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
