'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useKycVerification } from '@/hooks/use-kyc-verification';

export function KycVerificationModal() {
  const { isKycRequired, isKycModalOpen, setKycModalOpen } = useKycVerification();

  const handleContinue = () => {
    // TODO: Implement navigation to the KYC verification flow
    console.log('Redirecting to KYC flow...');
    setKycModalOpen(false);
  };

  // Only render the modal if KYC is required and the modal is set to be open
  if (!isKycRequired) {
    return null;
  }

  return (
    <Dialog open={isKycModalOpen} onOpenChange={setKycModalOpen}>
      <DialogContent
        className="sm:max-w-sm rounded-2xl border-border/60 bg-card"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-[11px] uppercase tracking-widest font-semibold text-primary">
              Identity Verification
            </span>
          </div>
          <DialogTitle className="text-[17px] font-semibold">
            Let's get you verified
          </DialogTitle>
          <DialogDescription>
            To comply with regulations and ensure the security of your account, we need to verify your identity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            The process is quick and easy, and it helps us keep your assets safe. You'll be guided through a few simple steps.
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Have a valid government-issued ID ready</li>
            <li>Be prepared to take a selfie</li>
          </ul>
        </div>

        <Button
          className="w-full h-11 rounded-xl font-semibold btn-premium text-white"
          onClick={handleContinue}
        >
          Continue to Verification
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
