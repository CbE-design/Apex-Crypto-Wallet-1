'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { PinPad } from '@/components/pin-pad';
import { cn } from '@/lib/utils';

type Step = 'create' | 'confirm' | 'passkey';

interface PinSetupDialogProps {
  open: boolean;
  passkeySupported: boolean;
  onPinConfirmed: (pin: string) => Promise<void>;
  onPasskeySetup: () => Promise<void>;
  onSkipPasskey: () => void;
}

export function PinSetupDialog({
  open,
  passkeySupported,
  onPinConfirmed,
  onPasskeySetup,
  onSkipPasskey,
}: PinSetupDialogProps) {
  const [step,        setStep]        = useState<Step>('create');
  const [pin,         setPin]         = useState('');
  const [confirmPin,  setConfirmPin]  = useState('');
  const [error,       setError]       = useState('');
  const [shake,       setShake]       = useState(false);
  const [busy,        setBusy]        = useState(false);

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handlePinComplete = () => {
    if (pin.length < 6) return;
    setConfirmPin('');
    setError('');
    setStep('confirm');
  };

  const handleConfirmComplete = async () => {
    if (confirmPin.length < 6) return;
    if (confirmPin !== pin) {
      triggerShake('PINs do not match — try again');
      setConfirmPin('');
      return;
    }
    setBusy(true);
    try {
      await onPinConfirmed(pin);
      if (passkeySupported) {
        setStep('passkey');
      } else {
        onSkipPasskey();
      }
    } catch {
      triggerShake('Could not save PIN — try again');
    } finally {
      setBusy(false);
    }
  };

  const handlePasskey = async () => {
    setBusy(true);
    try {
      await onPasskeySetup();
    } catch (e: any) {
      triggerShake(e?.message?.includes('cancel') ? 'Passkey cancelled' : 'Passkey setup failed');
    } finally {
      setBusy(false);
      onSkipPasskey(); // done
    }
  };

  // auto-advance when 6 digits filled
  React.useEffect(() => {
    if (step === 'create' && pin.length === 6) handlePinComplete();
  }, [pin, step]);

  React.useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 6) handleConfirmComplete();
  }, [confirmPin, step]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm rounded-2xl border-border/60 bg-card [&>button:first-of-type]:hidden"
        onInteractOutside={e => e.preventDefault()}
      >
        {step === 'create' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-primary">Security Setup</span>
              </div>
              <DialogTitle className="text-[17px] font-semibold">Create your PIN</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Choose a 6-digit PIN to lock your wallet. You will need this to access Apex on each device.
              </DialogDescription>
            </DialogHeader>
            <div className={cn('mt-2 transition-all', shake && 'animate-shake')}>
              <PinPad value={pin} onChange={setPin} error={!!error} disabled={busy} />
              {error && <p className="text-center text-[12px] text-destructive mt-3">{error}</p>}
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-primary">Confirm PIN</span>
              </div>
              <DialogTitle className="text-[17px] font-semibold">Confirm your PIN</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Re-enter the same 6-digit PIN to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className={cn('mt-2 transition-all', shake && 'animate-shake')}>
              <PinPad value={confirmPin} onChange={setConfirmPin} error={!!error} disabled={busy} />
              {error && <p className="text-center text-[12px] text-destructive mt-3">{error}</p>}
              {busy && (
                <div className="flex justify-center mt-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground mt-1"
              onClick={() => { setStep('create'); setPin(''); setConfirmPin(''); setError(''); }}
              disabled={busy}
            >
              Back
            </Button>
          </>
        )}

        {step === 'passkey' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint className="h-4 w-4 text-accent" />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-accent">Optional</span>
              </div>
              <DialogTitle className="text-[17px] font-semibold">Enable Biometric Unlock</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Register your face or fingerprint to unlock your wallet instantly — no PIN typing needed on this device.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center justify-center py-6">
                <div className="h-20 w-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Fingerprint className="h-10 w-10 text-accent" />
                </div>
              </div>
              {error && <p className="text-center text-[12px] text-destructive">{error}</p>}
              <Button
                className="w-full h-11 rounded-xl font-semibold btn-premium text-white"
                onClick={handlePasskey}
                disabled={busy}
              >
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Fingerprint className="h-4 w-4 mr-2" />Enable Passkey</>
                }
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={onSkipPasskey}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Skip for now
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
