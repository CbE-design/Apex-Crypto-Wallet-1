'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useKycVerification } from '@/hooks/use-kyc-verification';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { WithdrawalHistory } from '@/components/withdrawal-history';
import { KycStatusAlert } from '@/components/kyc-status-alert';
import { Loader2, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';

const FakeWithdrawalForm = () => (
  <div className="md:col-span-1">
    <div className="rounded-2xl border border-white/[0.07] bg-card/60 p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Initiate Withdrawal</h3>
        <p className="text-xs text-muted-foreground">Transfer funds to an external wallet</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Select Asset</Label>
          <div className="h-10 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between px-3">
            <span className="text-sm text-muted-foreground/50">Select a currency</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Amount</Label>
          <div className="relative">
            <div className="h-10 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center px-3">
              <span className="text-sm text-muted-foreground/50">0.00</span>
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground/50">USD</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Destination Address</Label>
          <div className="h-10 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center px-3">
            <span className="text-sm text-muted-foreground/50">Enter wallet address</span>
          </div>
        </div>
      </div>
      <div className="h-10 w-full rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary/50">
        Withdraw
      </div>
    </div>
  </div>
);

const FakeWithdrawalHistory = () => (
  <div className="md:col-span-2">
    <div className="rounded-2xl border border-white/[0.07] bg-card/60 p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Recent Withdrawals</h3>
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/5" />
              <div className="space-y-1">
                <div className="h-3 w-20 rounded-md bg-white/5" />
                <div className="h-2 w-24 rounded-md bg-white/5" />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="h-3 w-16 rounded-md bg-white/5" />
              <div className="h-2 w-12 rounded-md bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export function WithdrawalContent() {
  const { kycStatus } = useKycVerification();
  const [bannerReady, setBannerReady] = useState(false);

  useEffect(() => {
    if (kycStatus === 'APPROVED') {
      setBannerReady(false);
      return;
    }
    const timer = setTimeout(() => setBannerReady(true), 1500);
    return () => clearTimeout(timer);
  }, [kycStatus]);

  if (kycStatus === 'APPROVED') {
    return (
      <div className="container max-w-6xl py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <WithdrawalForm />
          </div>
          <div className="md:col-span-2">
            <WithdrawalHistory />
          </div>
        </div>
      </div>
    );
  }

  if (!bannerReady) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="container max-w-6xl py-8 space-y-8 blur-md pointer-events-none">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FakeWithdrawalForm />
          <FakeWithdrawalHistory />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="max-w-2xl w-full px-4">
          <KycStatusAlert kycStatus={kycStatus} />
        </div>
      </div>
    </div>
  );
}
