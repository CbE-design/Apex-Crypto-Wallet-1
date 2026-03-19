'use client';

import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Globe, Shield, Bell, Smartphone, User, ChevronRight, Lock, Eye, Fingerprint } from 'lucide-react';
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

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);

  const truncatedAddress = wallet?.address
    ? `${wallet.address.slice(0, 10)}···${wallet.address.slice(-6)}`
    : '—';

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
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">KYC Status</p>
                  <p className="text-[11px] text-muted-foreground">Identity verified</p>
                </div>
              </div>
              <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20 rounded-lg">Verified</Badge>
            </div>
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
            {[
              { icon: Lock,        label: 'Change PIN',       desc: 'Update your 6-digit security PIN' },
              { icon: Eye,         label: 'Privacy Mode',     desc: 'Hide balances in the interface'   },
              { icon: Fingerprint, label: 'Biometric Auth',   desc: 'Use fingerprint or face ID'       },
            ].map(({ icon: Icon, label, desc }) => (
              <button
                key={label}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                onClick={() => toast({ title: `${label}`, description: 'This feature is coming soon.' })}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            ))}
          </Card>
        </section>

        {/* Version */}
        <p className="text-center text-[11px] text-muted-foreground/40 pb-4">
          Apex Wallet v2.0.0 · Mainnet · Build 2026.03
        </p>
      </div>
    </PrivateRoute>
  );
}
