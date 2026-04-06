'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Shield,
  Banknote,
  Users,
  Power,
  Lock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  RefreshCw,
  UserPlus,
  TrendingDown,
  ArrowDownRight,
  Bell,
  ShieldCheck,
  Info,
  Upload,
} from 'lucide-react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ProtocolStatus } from '@/lib/types';

interface PlatformControls {
  allowNewRegistrations: boolean;
  tradingEnabled: boolean;
  withdrawalsEnabled: boolean;
  depositsEnabled: boolean;
}

interface ComplianceConfig {
  fatfThresholdZAR: number;
  eddThresholdZAR: number;
  kycRequiredAboveZAR: number;
  maxSingleWithdrawalZAR: number;
  maxDailyWithdrawalZAR: number;
  maxMonthlyWithdrawalZAR: number;
  minWithdrawalZAR: number;
}

interface FeeConfig {
  platformFeePercent: number;
  minFeeZAR: number;
  maxFeeZAR: number;
  swiftFeeUSD: number;
}

interface SecurityConfig {
  requireEmailVerification: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  autoLockSuspiciousActivity: boolean;
  travelRuleEnabled: boolean;
}

const DEFAULTS = {
  controls: { allowNewRegistrations: true, tradingEnabled: true, withdrawalsEnabled: true, depositsEnabled: true } as PlatformControls,
  compliance: { fatfThresholdZAR: 3000, eddThresholdZAR: 25000, kycRequiredAboveZAR: 3000, maxSingleWithdrawalZAR: 100000, maxDailyWithdrawalZAR: 250000, maxMonthlyWithdrawalZAR: 1000000, minWithdrawalZAR: 100 } as ComplianceConfig,
  fees: { platformFeePercent: 1.5, minFeeZAR: 25, maxFeeZAR: 5000, swiftFeeUSD: 25 } as FeeConfig,
  security: { requireEmailVerification: false, sessionTimeoutMinutes: 60, maxLoginAttempts: 5, autoLockSuspiciousActivity: true, travelRuleEnabled: true } as SecurityConfig,
};

function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled}
        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-white/20" />
    </div>
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { user } = useWallet();
  const firestore = useFirestore();

  const protocolRef = useMemoFirebase(() => firestore ? doc(firestore, 'protocol_settings', 'status') : null, [firestore]);
  const controlsRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform_config', 'controls') : null, [firestore]);
  const complianceRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform_config', 'compliance') : null, [firestore]);
  const feesRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform_config', 'fees') : null, [firestore]);
  const securityRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform_config', 'security') : null, [firestore]);

  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolRef);
  const { data: controlsData } = useDoc<PlatformControls>(controlsRef);
  const { data: complianceData } = useDoc<ComplianceConfig>(complianceRef);
  const { data: feesData } = useDoc<FeeConfig>(feesRef);
  const { data: securityData } = useDoc<SecurityConfig>(securityRef);

  const [controls, setControls] = useState<PlatformControls>(DEFAULTS.controls);
  const [compliance, setCompliance] = useState<ComplianceConfig>(DEFAULTS.compliance);
  const [fees, setFees] = useState<FeeConfig>(DEFAULTS.fees);
  const [security, setSecurity] = useState<SecurityConfig>(DEFAULTS.security);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isDeployingRules, setIsDeployingRules] = useState(false);

  useEffect(() => { if (controlsData) setControls({ ...DEFAULTS.controls, ...controlsData }); }, [controlsData]);
  useEffect(() => { if (complianceData) setCompliance({ ...DEFAULTS.compliance, ...complianceData }); }, [complianceData]);
  useEffect(() => { if (feesData) setFees({ ...DEFAULTS.fees, ...feesData }); }, [feesData]);
  useEffect(() => { if (securityData) setSecurity({ ...DEFAULTS.security, ...securityData }); }, [securityData]);
  useEffect(() => { if (protocolStatus) setIsMaintenanceMode(!protocolStatus.isActive); }, [protocolStatus]);

  const saveSection = async (section: string, data: Record<string, any>, collPath?: string) => {
    if (!firestore) return;
    setSavingSection(section);
    try {
      const ref = collPath
        ? doc(firestore, collPath)
        : doc(firestore, 'platform_config', section);
      await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: 'Settings Saved', description: `${section} settings updated successfully.` });
    } catch {
      toast({ title: 'Save Failed', description: 'Could not save settings. Check permissions.', variant: 'destructive' });
    } finally {
      setSavingSection(null);
    }
  };

  const handleMaintenanceToggle = async (active: boolean) => {
    setIsMaintenanceMode(!active);
    await saveSection('Protocol', {
      isActive: active,
      maintenanceMode: !active,
      version: protocolStatus?.version ?? '5.0.1',
      lastUpdated: Date.now(),
    }, 'protocol_settings/status');
  };

  const handleControlToggle = async (key: keyof PlatformControls, value: boolean) => {
    const updated = { ...controls, [key]: value };
    setControls(updated);
    await saveSection('controls', updated);
  };

  const handleSecurityToggle = async (key: keyof SecurityConfig, value: boolean) => {
    const updated = { ...security, [key]: value };
    setSecurity(updated);
    await saveSection('security', updated);
  };

  const isSaving = (section: string) => savingSection === section;

  const handleDeployRules = async () => {
    if (!user?.email) return;
    setIsDeployingRules(true);
    try {
      const res = await fetch('/api/admin/deploy-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Rules Deployed', description: 'Firestore security rules published successfully.' });
      } else {
        toast({ title: 'Deployment Failed', description: data.message || 'Check server logs.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Deployment Error', description: err.message || 'Network error.', variant: 'destructive' });
    } finally {
      setIsDeployingRules(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Platform Settings</h1>
        <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400 mt-1">
          Apex Wallet — Admin Configuration
        </p>
      </div>

      {/* ── PLATFORM STATUS ─────────────────────────────── */}
      <Card className="glass-module border-primary/20">
        <CardHeader>
          <SectionHeader icon={Power} title="Platform Status" description="Global on/off controls for the Apex Wallet platform." />
        </CardHeader>
        <CardContent className="space-y-1 divide-y divide-white/5">
          <ToggleRow
            label="Platform Active"
            description="Turn off to put the entire platform into maintenance mode. Users cannot log in or transact."
            checked={!isMaintenanceMode}
            onChange={handleMaintenanceToggle}
          />
          <ToggleRow
            label="Allow New Registrations"
            description="When disabled, new users cannot create accounts. Existing users are unaffected."
            checked={controls.allowNewRegistrations}
            onChange={(v) => handleControlToggle('allowNewRegistrations', v)}
          />
          <ToggleRow
            label="Trading Enabled"
            description="Allow users to buy, sell and swap crypto assets."
            checked={controls.tradingEnabled}
            onChange={(v) => handleControlToggle('tradingEnabled', v)}
          />
          <ToggleRow
            label="Withdrawals Enabled"
            description="Allow users to cash out to their bank accounts. Disable during audits or security events."
            checked={controls.withdrawalsEnabled}
            onChange={(v) => handleControlToggle('withdrawalsEnabled', v)}
          />
          <ToggleRow
            label="Deposits Enabled"
            description="Allow users to fund their wallets with crypto or fiat."
            checked={controls.depositsEnabled}
            onChange={(v) => handleControlToggle('depositsEnabled', v)}
          />
        </CardContent>
      </Card>

      {/* ── COMPLIANCE & REGULATORY ────────────────────── */}
      <Card className="glass-module border-amber-500/20">
        <CardHeader>
          <SectionHeader
            icon={ShieldCheck}
            title="Compliance & Regulatory"
            description="SA FSCA / FATF compliance thresholds and withdrawal limits. Stored in ZAR."
          />
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 bg-amber-500/5 border-amber-500/20">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-[11px] text-amber-400">
              South African regulatory defaults: FATF reporting at R3,000 · EDD investigation at R25,000.
              Changes take effect immediately for all new transactions.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { key: 'fatfThresholdZAR', label: 'FATF Reporting Threshold (ZAR)', desc: 'Transactions above this amount are flagged for Travel Rule reporting. Default: R3,000.' },
              { key: 'eddThresholdZAR', label: 'EDD Investigation Threshold (ZAR)', desc: 'Enhanced Due Diligence required above this amount. Default: R25,000.' },
              { key: 'kycRequiredAboveZAR', label: 'KYC Required Above (ZAR)', desc: 'Users must complete KYC before withdrawing above this amount.' },
              { key: 'minWithdrawalZAR', label: 'Minimum Withdrawal (ZAR)', desc: 'Smallest withdrawal amount a user can request.' },
              { key: 'maxSingleWithdrawalZAR', label: 'Max Single Withdrawal (ZAR)', desc: 'Largest single withdrawal a user can submit.' },
              { key: 'maxDailyWithdrawalZAR', label: 'Daily Withdrawal Limit (ZAR)', desc: 'Maximum total withdrawals per user per calendar day.' },
              { key: 'maxMonthlyWithdrawalZAR', label: 'Monthly Withdrawal Limit (ZAR)', desc: 'Maximum total withdrawals per user per calendar month.' },
            ] as { key: keyof ComplianceConfig; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">{label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">R</span>
                  <Input
                    type="number"
                    className="bg-white/5 rounded-xl border-white/10 pl-7 font-mono"
                    value={compliance[key]}
                    onChange={(e) => setCompliance(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <Button
            className="w-full mt-6 btn-premium py-6 rounded-2xl font-black uppercase tracking-widest"
            onClick={() => saveSection('compliance', compliance)}
            disabled={isSaving('compliance')}
          >
            {isSaving('compliance') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Compliance Settings
          </Button>
        </CardContent>
      </Card>

      {/* ── FEE CONFIGURATION ─────────────────────────── */}
      <Card className="glass-module border-green-500/20">
        <CardHeader>
          <SectionHeader icon={Banknote} title="Fee Configuration" description="Platform fees applied on withdrawals and transactions." />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Platform Fee (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="bg-white/5 rounded-xl border-white/10 font-mono pr-8"
                  value={fees.platformFeePercent}
                  onChange={(e) => setFees(prev => ({ ...prev, platformFeePercent: parseFloat(e.target.value) || 0 }))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Applied to all withdrawals. E.g. 1.5%</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Minimum Fee (ZAR)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">R</span>
                <Input
                  type="number"
                  className="bg-white/5 rounded-xl border-white/10 pl-7 font-mono"
                  value={fees.minFeeZAR}
                  onChange={(e) => setFees(prev => ({ ...prev, minFeeZAR: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Minimum fee regardless of percentage.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Maximum Fee (ZAR)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">R</span>
                <Input
                  type="number"
                  className="bg-white/5 rounded-xl border-white/10 pl-7 font-mono"
                  value={fees.maxFeeZAR}
                  onChange={(e) => setFees(prev => ({ ...prev, maxFeeZAR: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Fee cap — users never pay more than this.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">SWIFT Transfer Fee (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">$</span>
                <Input
                  type="number"
                  className="bg-white/5 rounded-xl border-white/10 pl-7 font-mono"
                  value={fees.swiftFeeUSD}
                  onChange={(e) => setFees(prev => ({ ...prev, swiftFeeUSD: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Fixed fee charged on SWIFT international withdrawals.</p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
            <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Fee Preview</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              On a R10,000 EFT withdrawal: fee = max(R{fees.minFeeZAR}, min(R{(10000 * fees.platformFeePercent / 100).toFixed(2)}, R{fees.maxFeeZAR}))
              {' '}= <span className="text-white font-bold">
                R{Math.min(fees.maxFeeZAR, Math.max(fees.minFeeZAR, 10000 * fees.platformFeePercent / 100)).toFixed(2)}
              </span>
            </p>
          </div>

          <Button
            className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white py-6 rounded-2xl font-black uppercase tracking-widest"
            onClick={() => saveSection('fees', fees)}
            disabled={isSaving('fees')}
          >
            {isSaving('fees') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Fee Configuration
          </Button>
        </CardContent>
      </Card>

      {/* ── SECURITY SETTINGS ──────────────────────────── */}
      <Card className="glass-module border-red-500/20">
        <CardHeader>
          <SectionHeader icon={Lock} title="Security & Access" description="Authentication, session, and fraud prevention settings." />
        </CardHeader>
        <CardContent className="space-y-1 divide-y divide-white/5">
          <ToggleRow
            label="Require Email Verification"
            description="Users must verify their email address before accessing the platform."
            checked={security.requireEmailVerification}
            onChange={(v) => handleSecurityToggle('requireEmailVerification', v)}
          />
          <ToggleRow
            label="Auto-Lock on Suspicious Activity"
            description="Automatically suspend accounts showing unusual transaction patterns."
            checked={security.autoLockSuspiciousActivity}
            onChange={(v) => handleSecurityToggle('autoLockSuspiciousActivity', v)}
          />
          <ToggleRow
            label="Travel Rule Enforcement"
            description="Enforce FATF Travel Rule on all transfers above the reporting threshold."
            checked={security.travelRuleEnabled}
            onChange={(v) => handleSecurityToggle('travelRuleEnabled', v)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Session Timeout (minutes)</Label>
              <Input
                type="number"
                min="5"
                max="480"
                className="bg-white/5 rounded-xl border-white/10 font-mono"
                value={security.sessionTimeoutMinutes}
                onChange={(e) => setSecurity(prev => ({ ...prev, sessionTimeoutMinutes: parseInt(e.target.value) || 60 }))}
              />
              <p className="text-[10px] text-muted-foreground">Inactive sessions are signed out after this period.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Max Login Attempts</Label>
              <Input
                type="number"
                min="3"
                max="10"
                className="bg-white/5 rounded-xl border-white/10 font-mono"
                value={security.maxLoginAttempts}
                onChange={(e) => setSecurity(prev => ({ ...prev, maxLoginAttempts: parseInt(e.target.value) || 5 }))}
              />
              <p className="text-[10px] text-muted-foreground">Account is locked after this many failed login attempts.</p>
            </div>
          </div>

          <div className="pt-4">
            <Button
              className="w-full bg-red-600/80 hover:bg-red-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest"
              onClick={() => saveSection('security', security)}
              disabled={isSaving('security')}
            >
              {isSaving('security') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Security Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── ADMIN ACCOUNTS INFO ────────────────────────── */}
      <Card className="glass-module border-blue-500/20">
        <CardHeader>
          <SectionHeader icon={Shield} title="Admin Accounts" description="Accounts with full administrative access to this control centre." />
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-blue-500/5 border-blue-500/20">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-[11px] text-blue-300">
              Admin access is granted via the <code className="text-[10px] bg-white/10 px-1 rounded">ADMIN_EMAILS</code> list
              in the application code and the <code className="text-[10px] bg-white/10 px-1 rounded">isAdmin()</code> function
              in your Firestore security rules. To add or remove admins, update both locations and redeploy.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            {['admin@apexwallet.io', 'corrie@apex-crypto.co.uk'].map((email) => (
              <div key={email} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-sm font-mono">{email}</span>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] font-black uppercase">
                  Super Admin
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── FIRESTORE RULES REMINDER ──────────────────── */}
      <Card className="glass-module border-yellow-500/20">
        <CardHeader>
          <SectionHeader icon={Globe} title="Security Rules Status" description="Current Firestore security rules configuration for this project." />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { rule: 'protocol_settings', access: 'Public read · Admin write', status: 'ok' },
              { rule: 'platform_config', access: 'Admin only', status: 'ok' },
              { rule: 'users', access: 'Owner read/write · Admin list all', status: 'ok' },
              { rule: 'withdrawal_requests', access: 'Users create · Admin approve', status: 'ok' },
              { rule: 'kyc_submissions', access: 'Users create · Admin approve', status: 'ok' },
              { rule: 'admin_notifications', access: 'Admin only', status: 'ok' },
            ].map(({ rule, access, status }) => (
              <div key={rule} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <div>
                    <code className="text-[11px] font-mono text-white">{rule}</code>
                    <p className="text-[10px] text-muted-foreground">{access}</p>
                  </div>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-none text-[9px] font-black uppercase">Secured</Badge>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-[11px] text-muted-foreground mb-3">
              Rules are stored in <code className="text-[10px] bg-white/10 px-1 rounded">firestore.rules</code> and deployed
              directly to Firebase from this control panel. Click below to publish the current rules file live.
            </p>
            <Button
              className="w-full py-6 rounded-2xl font-black uppercase tracking-widest bg-yellow-600/80 hover:bg-yellow-600 text-white"
              onClick={handleDeployRules}
              disabled={isDeployingRules}
            >
              {isDeployingRules ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deploying Rules...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Deploy Security Rules to Firebase</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
