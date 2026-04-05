'use client';

import { useTheme } from 'next-themes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Globe, Shield, Bell, Smartphone, User, ChevronRight, Lock, Eye, EyeOff, Fingerprint, Scale, ExternalLink, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/context/currency-context';
import { currencies } from '@/lib/currencies';
import { useWallet } from '@/context/wallet-context';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { usePrivacyMode } from '@/hooks/use-privacy-mode';
import { KYCVerificationModal } from '@/components/kyc-verification-modal';
import type { KYCStatus } from '@/lib/types';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { wallet, userProfile } = useWallet();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const [kycModalOpen, setKycModalOpen] = useState(false);

  const truncatedAddress = wallet?.address
    ? `${wallet.address.slice(0, 10)}···${wallet.address.slice(-6)}`
    : '—';

  const kycStatus: KYCStatus = (userProfile as any)?.kycStatus ?? 'NOT_SUBMITTED';

  const kycBadge = () => {
    switch (kycStatus) {
      case 'APPROVED':
        return <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20 rounded-lg"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'PENDING':
        return <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 rounded-lg"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
      case 'REJECTED':
        return <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 rounded-lg"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="text-[10px] bg-muted/30 text-muted-foreground border-border/40 rounded-lg"><AlertTriangle className="h-3 w-3 mr-1" />Not Verified</Badge>;
    }
  };

  const kycSubtext = () => {
    switch (kycStatus) {
      case 'APPROVED': return 'Identity verified — full access enabled';
      case 'PENDING': return 'Documents submitted — review in progress';
      case 'REJECTED': return 'Verification failed — resubmission required';
      default: return 'Required for withdrawals — tap to verify';
    }
  };

  return (
    <PrivateRoute>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Account ── */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Account</h2>
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur overflow-hidden divide-y divide-border/40">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">Wallet Address</p>
                  <code className="text-[11px] text-muted-foreground font-mono">{truncatedAddress}</code>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-accent/30 text-accent rounded-lg">
                Active
              </Badge>
            </div>

            {/* KYC Row — fully dynamic, opens modal */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
              onClick={() => setKycModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-8 w-8 rounded-lg border flex items-center justify-center',
                  kycStatus === 'APPROVED'
                    ? 'bg-green-500/10 border-green-500/20'
                    : kycStatus === 'PENDING'
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : kycStatus === 'REJECTED'
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-muted/50 border-border/60'
                )}>
                  <Shield className={cn(
                    'h-4 w-4',
                    kycStatus === 'APPROVED' ? 'text-green-400'
                    : kycStatus === 'PENDING' ? 'text-amber-400'
                    : kycStatus === 'REJECTED' ? 'text-destructive'
                    : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className="text-[13px] font-medium">Identity Verification</p>
                  <p className="text-[11px] text-muted-foreground">{kycSubtext()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {kycBadge()}
                {kycStatus !== 'APPROVED' && kycStatus !== 'PENDING' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
            </button>
          </Card>
        </section>

        {/* ── Appearance ── */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Appearance</h2>
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur overflow-hidden">
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Theme</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Application colour scheme</p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40">
                  {[
                    { mode: 'light', icon: Sun },
                    { mode: 'dark',  icon: Moon },
                  ].map(({ mode, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setTheme(mode)}
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 text-[13px]",
                        theme === mode
                          ? "bg-primary text-white shadow-sm shadow-primary/30"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Localization ── */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Localization</h2>
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur overflow-hidden">
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">Display Currency</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">All prices shown in this currency</p>
                  </div>
                </div>
                <Select value={currency.symbol} onValueChange={setCurrency}>
                  <SelectTrigger className="w-40 h-10 rounded-xl bg-muted/30 border-border/60 text-[13px]">
                    <div className="flex items-center gap-2">
                      <div className="relative h-3 w-4.5 overflow-hidden rounded-sm border border-white/10 shrink-0">
                        <Image src={currency.flagUrl} alt={currency.name} fill className="object-cover" />
                      </div>
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-56 rounded-xl border-border/60">
                    {currencies.map(c => (
                      <SelectItem key={c.symbol} value={c.symbol} className="text-[13px]">
                        <div className="flex items-center gap-2">
                          <div className="relative h-3 w-4.5 overflow-hidden rounded-sm border border-white/5 shrink-0">
                            <Image src={c.flagUrl} alt={c.name} fill className="object-cover" />
                          </div>
                          <span>{c.symbol} — {c.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Notifications ── */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Notifications</h2>
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur overflow-hidden divide-y divide-border/40">
            {[
              {
                icon: Bell,
                label: 'Push Notifications',
                desc: 'Receive in-app alerts',
                value: notifications,
                set: setNotifications,
              },
              {
                icon: Smartphone,
                label: 'Price Alerts',
                desc: 'Notify when targets are hit',
                value: priceAlerts,
                set: setPriceAlerts,
              },
            ].map(({ icon: Icon, label, desc, value, set }) => (
              <div key={label} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch checked={value} onCheckedChange={set} />
              </div>
            ))}
          </Card>
        </section>

        {/* ── Security ── */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Security</h2>
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur overflow-hidden divide-y divide-border/40">

            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                  {privacyMode ? <EyeOff className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-[13px] font-medium">Privacy Mode</p>
                  <p className="text-[11px] text-muted-foreground">{privacyMode ? 'Balances are hidden' : 'Balances are visible'}</p>
                </div>
              </div>
              <Switch checked={privacyMode} onCheckedChange={togglePrivacyMode} />
            </div>

            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
              onClick={() => toast({ title: 'Change PIN', description: 'Please log out and use the PIN setup flow to reset your PIN.' })}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">Change PIN</p>
                  <p className="text-[11px] text-muted-foreground">Update your 6-digit security PIN</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </button>

            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
              onClick={() => toast({ title: 'Biometric Auth', description: 'Use passkey authentication on the login screen to enable biometrics.' })}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">Biometric / Passkey Auth</p>
                  <p className="text-[11px] text-muted-foreground">Secure login with device biometrics</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </button>
          </Card>
        </section>

        {/* ── Legal & Compliance ── */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Legal & Compliance</h2>
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur overflow-hidden divide-y divide-border/40">
            {[
              { label: 'Terms of Service', desc: 'User agreement and platform rules', href: '/legal/terms' },
              { label: 'Privacy Policy', desc: 'POPIA-compliant data handling', href: '/legal/privacy' },
              { label: 'Risk Disclosure', desc: 'Investment and crypto risks', href: '/legal/risk-disclosure' },
              { label: 'AML & FICA Policy', desc: 'Compliance obligations and KYC framework', href: '/legal/aml-policy' },
            ].map(({ label, desc, href }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40" />
              </Link>
            ))}
          </Card>
        </section>

        {/* Regulatory Notice */}
        <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Regulatory Information</p>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Apex Wallet operates under FICA No. 38 of 2001, FSRA No. 9 of 2017, and POPIA No. 4 of 2013. Crypto asset transactions are subject to FATF Travel Rule obligations. This platform does not provide licensed financial advice. FSCA regulated.
          </p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/40 pb-4">
          Apex Wallet v2.0.0 · Mainnet · Build 2026.03 · FICA Compliant
        </p>
      </div>

      {/* KYC Verification Modal */}
      <KYCVerificationModal
        open={kycModalOpen}
        onOpenChange={setKycModalOpen}
        kycStatus={kycStatus}
        onSubmissionComplete={() => setKycModalOpen(false)}
      />
    </PrivateRoute>
  );
}
