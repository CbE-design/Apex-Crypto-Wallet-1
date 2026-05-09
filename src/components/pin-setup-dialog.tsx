'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint, ShieldCheck, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { PinPad } from '@/components/pin-pad';
import { cn } from '@/lib/utils';

type Step = 'create' | 'confirm' | 'passkey' | 'done';

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
  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false);

  // Guard against the auto-advance effect re-firing while a confirm is in flight.
  const confirmInFlight = useRef(false);

  // Reset internal state whenever the dialog is freshly opened so a previous
  // session does not leave the component in 'done' or 'passkey' state.
  useEffect(() => {
    if (open) {
      setStep('create');
      setPin('');
      setConfirmPin('');
      setError('');
      setShake(false);
      setBusy(false);
      setPasskeyEnrolled(false);
      confirmInFlight.current = false;
    }
  }, [open]);

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
    if (confirmInFlight.current) return;
    if (confirmPin.length < 6) return;
    if (confirmPin !== pin) {
      triggerShake('PINs do not match — try again');
      setConfirmPin('');
      return;
    }
    confirmInFlight.current = true;
    setBusy(true);
    try {
      await onPinConfirmed(pin);
      // Always advance to the post-PIN choice step. The user must explicitly
      // pick "Enable Passkey" or "Skip for now" — we never auto-close.
      setStep('passkey');
    } catch {
      triggerShake('Could not save PIN — try again');
      confirmInFlight.current = false;
    } finally {
      setBusy(false);
    }
  };

  const handlePasskey = async () => {
    setBusy(true);
    setError('');
    try {
      await onPasskeySetup();
      setPasskeyEnrolled(true);
      setStep('done');
    } catch (e: any) {
      const msg = e?.message?.toLowerCase() || '';
      triggerShake(
        msg.includes('cancel') || msg.includes('aborted')
          ? 'Passkey cancelled — you can try again or skip.'
          : msg.includes('not allowed') || msg.includes('not supported')
            ? 'Passkey is not available on this device. You can continue with PIN only.'
            : 'Passkey setup failed — try again or skip.'
      );
    } finally {
      setBusy(false);
    }
  };

  // auto-advance when 6 digits filled
  useEffect(() => {
    if (step === 'create' && pin.length === 6) handlePinComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step]);

  useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 6) handleConfirmComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, step]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm rounded-2xl border-border/60 bg-card [&>button:first-of-type]:hidden"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
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
              onClick={() => { setStep('create'); setPin(''); setConfirmPin(''); setError(''); confirmInFlight.current = false; }}
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
                <span className="text-[11px] uppercase tracking-widest font-semibold text-accent">
                  {passkeySupported ? 'Optional' : 'PIN Set'}
                </span>
              </div>
              <DialogTitle className="text-[17px] font-semibold">
                {passkeySupported ? 'Enable Biometric Unlock' : 'Your PIN is Ready'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {passkeySupported
                  ? 'Register your face or fingerprint to unlock your wallet instantly — no PIN typing needed on this device.'
                  : 'Biometric unlock is not available on this device. You can always unlock Apex with your PIN.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center justify-center py-6">
                <div className={cn(
                  'h-20 w-20 rounded-full flex items-center justify-center border',
                  passkeySupported
                    ? 'bg-accent/10 border-accent/20'
                    : 'bg-primary/10 border-primary/20',
                )}>
                  {passkeySupported
                    ? <Fingerprint className="h-10 w-10 text-accent" />
                    : <ShieldCheck className="h-10 w-10 text-primary" />}
                </div>
              </div>
              {error && <p className="text-center text-[12px] text-destructive px-2">{error}</p>}
              {passkeySupported && (
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
              )}
              <Button
                variant={passkeySupported ? 'ghost' : 'default'}
                className={cn(
                  'w-full h-11 rounded-xl',
                  passkeySupported
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'btn-premium text-white font-semibold',
                )}
                onClick={onSkipPasskey}
                disabled={busy}
              >
                {passkeySupported ? (
                  <>
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Skip for now
                  </>
                ) : (
                  <>
                    Continue to Wallet
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-accent">All Set</span>
              </div>
              <DialogTitle className="text-[17px] font-semibold">
                {passkeyEnrolled ? 'Biometric Unlock Enabled' : 'Wallet Protected'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {passkeyEnrolled
                  ? 'You can now unlock Apex with your face or fingerprint on this device.'
                  : 'Your wallet is locked with your 6-digit PIN.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center justify-center py-6">
                <div className="h-20 w-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-accent" />
                </div>
              </div>
              <Button
                className="w-full h-11 rounded-xl font-semibold btn-premium text-white"
                onClick={onSkipPasskey}
              >
                Continue to Wallet
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
