"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWallet } from "@/context/wallet-context";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { requestWithdrawalAction } from "@/app/actions/withdrawal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Globe,
  Loader2,
  ChevronRight,
  Info,
  CheckCircle2,
  ArrowDownToLine,
  Banknote,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import { marketCoins } from "@/lib/data";

// ── Fee schedule ─────────────────────────────────────────────────────────────
const EFT_FEE_PCT = 0.015;  // 1.5%
const EFT_FEE_FIXED = 15;   // R15
const SWIFT_FEE_PCT = 0.035; // 3.5%
const SWIFT_FEE_FIXED = 250; // R250 (converted to target currency at ~18.62 ZAR/USD)

// ── Supported SA banks ────────────────────────────────────────────────────────
const SA_BANKS = [
  "ABSA Bank",
  "Capitec Bank",
  "First National Bank (FNB)",
  "Investec Bank",
  "Nedbank",
  "Standard Bank",
  "African Bank",
  "Bidvest Bank",
  "Discovery Bank",
  "TymeBank",
  "Other",
];

// ── Supported SWIFT currencies ────────────────────────────────────────────────
const SWIFT_CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "CHF", label: "CHF — Swiss Franc" },
];

// ── Zod schemas ───────────────────────────────────────────────────────────────
const baseSchema = z.object({
  cryptoSymbol: z.string().min(1, "Select an asset"),
  fiatAmount: z
    .string()
    .min(1, "Enter an amount")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Enter a valid amount"),
  method: z.enum(["EFT", "SWIFT"]),
  fiatCurrency: z.string().min(1),
  accountHolder: z.string().min(2, "Full name is required"),
  bankName: z.string().min(2, "Bank name is required"),
  accountNumber: z.string().min(4, "Account number is required"),
  branchCode: z.string().optional(),
  swiftCode: z.string().optional(),
  bankAddress: z.string().optional(),
  routingNumber: z.string().optional(),
});

const withdrawalSchema = baseSchema
  .refine(
    (d) => d.method !== "EFT" || (!!d.branchCode && d.branchCode.length >= 4),
    { message: "Branch code is required (min 4 digits)", path: ["branchCode"] }
  )
  .refine(
    (d) => d.method !== "SWIFT" || (!!d.swiftCode && d.swiftCode.length >= 8),
    { message: "SWIFT/BIC code is required (min 8 chars)", path: ["swiftCode"] }
  );

type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

// ── Input component matching app style ───────────────────────────────────────
function FormInput({
  label,
  sublabel,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  sublabel?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {label}
        </Label>
        {sublabel && (
          <span className="text-[10px] text-white/30">{sublabel}</span>
        )}
      </div>
      <input
        {...props}
        className={cn(
          "w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5",
          "text-sm text-white placeholder:text-white/25 outline-none",
          "focus:border-primary/50 focus:bg-white/[0.06] transition-all duration-150",
          error && "border-destructive/60 bg-destructive/5",
          className
        )}
      />
      {error && (
        <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WithdrawalForm() {
  const { user, userProfile, wallet } = useWallet();
  const { toast } = useToast();
  const { rates } = useCurrency();
  const firestore = useFirestore();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assetPricesUSD, setAssetPricesUSD] = useState<Record<string, number>>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref: string; amount: string; method: string } | null>(null);

  // Fetch user wallets from Firestore
  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, "users", user.uid, "wallets"));
  }, [user, firestore]);

  const { data: userWallets } = useCollection(walletsQuery);

  // Filter to wallets with a positive balance
  const availableWallets = useMemo(() => {
    if (!userWallets) return [];
    return userWallets
      .filter((w) => (w.balance ?? 0) > 0)
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  }, [userWallets]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      method: "EFT",
      fiatCurrency: "ZAR",
      cryptoSymbol: "",
      fiatAmount: "",
      accountHolder: "",
      bankName: "",
      accountNumber: "",
      branchCode: "",
      swiftCode: "",
      bankAddress: "",
      routingNumber: "",
    },
    mode: "onChange",
  });

  const watchMethod = watch("method");
  const watchSymbol = watch("cryptoSymbol");
  const watchFiatAmount = watch("fiatAmount");
  const watchFiatCurrency = watch("fiatCurrency");

  // When method changes, reset currency and swap-specific fields
  useEffect(() => {
    if (watchMethod === "EFT") {
      setValue("fiatCurrency", "ZAR");
    } else {
      if (watchFiatCurrency === "ZAR") setValue("fiatCurrency", "USD");
    }
  }, [watchMethod, setValue, watchFiatCurrency]);

  // Fetch asset price in USD when symbol changes
  useEffect(() => {
    if (!watchSymbol) return;
    setPriceLoading(true);
    fetch(`/api/prices?symbols=${watchSymbol}&currency=USD`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ prices }: { prices: Record<string, number> }) => {
        setAssetPricesUSD((prev) => ({
          ...prev,
          [watchSymbol]: prices[watchSymbol] ?? 0,
        }));
      })
      .catch(() => {})
      .finally(() => setPriceLoading(false));
  }, [watchSymbol]);

  // Compute exchange rates
  const { cryptoAmount, feeAmount, netFiatAmount, exchangeRate } = useMemo(() => {
    const fiatAmt = parseFloat(watchFiatAmount) || 0;
    const priceUSD = assetPricesUSD[watchSymbol] ?? 0;
    if (fiatAmt <= 0 || priceUSD <= 0) {
      return { cryptoAmount: 0, feeAmount: 0, netFiatAmount: 0, exchangeRate: 0 };
    }

    const zarRate = rates?.ZAR ?? 18.62;

    let priceFiat = 0;
    if (watchFiatCurrency === "ZAR") {
      priceFiat = priceUSD * zarRate;
    } else if (watchFiatCurrency === "USD") {
      priceFiat = priceUSD;
    } else if (watchFiatCurrency === "EUR") {
      priceFiat = priceUSD * (rates?.EUR ? 1 / rates.EUR : 0.92);
    } else if (watchFiatCurrency === "GBP") {
      priceFiat = priceUSD * (rates?.GBP ? 1 / rates.GBP : 0.79);
    } else {
      priceFiat = priceUSD;
    }

    const feePct = watchMethod === "EFT" ? EFT_FEE_PCT : SWIFT_FEE_PCT;
    const feeFixed = watchMethod === "EFT" ? EFT_FEE_FIXED : SWIFT_FEE_FIXED;
    const fee = fiatAmt * feePct + (watchFiatCurrency === "ZAR" ? feeFixed : feeFixed / zarRate);

    const cryptoAmt = priceFiat > 0 ? fiatAmt / priceFiat : 0;
    const net = Math.max(0, fiatAmt - fee);

    return {
      cryptoAmount: cryptoAmt,
      feeAmount: fee,
      netFiatAmount: net,
      exchangeRate: priceFiat,
    };
  }, [watchFiatAmount, watchFiatCurrency, watchMethod, watchSymbol, assetPricesUSD, rates]);

  // Selected wallet balance
  const selectedWallet = useMemo(
    () => userWallets?.find((w) => w.currency === watchSymbol),
    [userWallets, watchSymbol]
  );
  const availableBalance = selectedWallet?.balance ?? 0;

  const hasInsufficientBalance = cryptoAmount > 0 && cryptoAmount > availableBalance;

  const formatFiat = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

  const formatCrypto = (amount: number, symbol: string) =>
    `${amount.toFixed(8).replace(/\.?0+$/, "")} ${symbol}`;

  const onSubmitForm = useCallback(() => {
    if (!isValid || hasInsufficientBalance) return;
    setIsConfirmOpen(true);
  }, [isValid, hasInsufficientBalance]);

  const onConfirmWithdrawal = handleSubmit(async (data) => {
    if (!user || !userProfile || !wallet) {
      toast({ title: "Error", description: "Session expired. Please re-authenticate.", variant: "destructive" });
      return;
    }
    setIsConfirmOpen(false);
    setIsSubmitting(true);

    try {
      const result = await requestWithdrawalAction({
        userId: user.uid,
        userEmail: userProfile.email ?? user.email ?? "",
        walletAddress: wallet.address,
        cryptoSymbol: data.cryptoSymbol,
        cryptoAmount,
        fiatCurrency: data.fiatCurrency,
        fiatAmount: parseFloat(data.fiatAmount),
        exchangeRate,
        networkFee: feeAmount,
        withdrawalMethod: data.method,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountHolder: data.accountHolder,
        branchCode: data.branchCode,
        swiftCode: data.swiftCode,
        bankAddress: data.bankAddress,
        routingNumber: data.routingNumber,
      });

      if (result.success) {
        setSubmitted({
          ref: result.reference ?? "",
          amount: formatFiat(parseFloat(data.fiatAmount), data.fiatCurrency),
          method: data.method,
        });
        reset();
      } else {
        toast({
          title: "Withdrawal Failed",
          description: result.error ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  });

  // ── Success state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0A0C12]/80 backdrop-blur-xl p-6 flex flex-col items-center text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center glow-violet">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-white">Request Submitted</h3>
          <p className="text-xs text-white/50">
            Your withdrawal is pending compliance review. You&apos;ll be notified by email.
          </p>
        </div>
        <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5 text-left">
          <div className="flex justify-between text-xs">
            <span className="text-white/40 font-medium">Amount</span>
            <span className="text-white font-black">{submitted.amount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40 font-medium">Method</span>
            <span className="text-white font-bold uppercase">{submitted.method}</span>
          </div>
          <div className="neon-divider" />
          <div className="flex justify-between text-xs">
            <span className="text-white/40 font-medium">Reference</span>
            <span className="font-mono text-[10px] text-primary font-bold">{submitted.ref}</span>
          </div>
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed">
          Funds are reserved and will be released upon approval. Processing typically takes 1–3 business days.
        </p>
        <Button
          variant="outline"
          className="w-full rounded-xl h-11 text-[11px] font-black uppercase tracking-wider border-white/[0.1] hover:border-primary/40"
          onClick={() => setSubmitted(null)}
        >
          New Withdrawal
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0A0C12]/80 backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] gradient-border-violet">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ArrowDownToLine className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Initiate Withdrawal</h3>
              <p className="text-[10px] text-white/40">Convert crypto → fiat bank payout</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Method Selector ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5">
            {(["EFT", "SWIFT"] as const).map((m) => {
              const isSelected = watchMethod === m;
              const Icon = m === "EFT" ? Building2 : Globe;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setValue("method", m, { shouldValidate: true })}
                  className={cn(
                    "relative flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all duration-200 text-left",
                    isSelected
                      ? "border-primary/40 bg-primary/10 glow-violet"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
                  )}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center",
                      isSelected ? "bg-primary/20" : "bg-white/[0.06]"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-white/40")} />
                  </div>
                  <div>
                    <p className={cn("text-xs font-black", isSelected ? "text-white" : "text-white/60")}>
                      {m === "EFT" ? "EFT / SA Bank" : "SWIFT / International"}
                    </p>
                    <p className="text-[9px] text-white/30 mt-0.5 leading-relaxed">
                      {m === "EFT" ? "1.5% + R15 · 1–2 days" : "3.5% + $250 · 3–5 days"}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Asset Selector ────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Asset to Withdraw
            </Label>
            <Select
              value={watchSymbol}
              onValueChange={(v) => setValue("cryptoSymbol", v, { shouldValidate: true })}
            >
              <SelectTrigger
                className={cn(
                  "h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm text-white",
                  "focus:border-primary/50 transition-all",
                  errors.cryptoSymbol && "border-destructive/60"
                )}
              >
                <SelectValue placeholder="Select a crypto asset" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A0C12] border-white/[0.1] rounded-xl">
                {availableWallets.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-white/40 text-center">No assets with balance</div>
                ) : (
                  availableWallets.map((w) => {
                    const coin = marketCoins.find((c) => c.symbol === w.currency);
                    return (
                      <SelectItem
                        key={w.currency}
                        value={w.currency}
                        className="text-sm text-white focus:bg-white/[0.08] rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <CryptoIcon name={w.currency} className="h-[18px] w-[18px]" />
                          <span className="font-semibold">{w.currency}</span>
                          <span className="text-white/40 text-xs">{coin?.name}</span>
                          <span className="ml-auto text-white/60 text-xs tabular-nums">
                            {Number(w.balance).toFixed(6)}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {errors.cryptoSymbol && (
              <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.cryptoSymbol.message}
              </p>
            )}
            {/* Available balance */}
            {watchSymbol && (
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[10px] text-white/30">Available balance</span>
                <span className="text-[10px] font-black tabular-nums text-white/60">
                  {priceLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin inline" />
                  ) : (
                    formatCrypto(availableBalance, watchSymbol)
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ── Amount + Currency ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Payout Amount
              </Label>
              {watchSymbol && exchangeRate > 0 && (
                <span className="text-[10px] text-white/30">
                  1 {watchSymbol} ≈ {formatFiat(exchangeRate, watchFiatCurrency)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  {...register("fiatAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={cn(
                    "w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5",
                    "text-sm text-white placeholder:text-white/25 outline-none",
                    "focus:border-primary/50 focus:bg-white/[0.06] transition-all duration-150",
                    errors.fiatAmount && "border-destructive/60"
                  )}
                />
              </div>
              {/* Currency selector for SWIFT */}
              {watchMethod === "SWIFT" ? (
                <Select
                  value={watchFiatCurrency}
                  onValueChange={(v) => setValue("fiatCurrency", v, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-11 w-[100px] rounded-xl bg-white/[0.04] border-white/[0.08] text-sm font-bold text-white flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0C12] border-white/[0.1] rounded-xl">
                    {SWIFT_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code} className="text-sm text-white focus:bg-white/[0.08] rounded-lg">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-11 w-[72px] rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-white/60">ZAR</span>
                </div>
              )}
            </div>
            {errors.fiatAmount && (
              <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.fiatAmount.message}
              </p>
            )}
            {/* Insufficient balance warning */}
            {hasInsufficientBalance && (
              <p className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Insufficient balance. You have {formatCrypto(availableBalance, watchSymbol)}.
              </p>
            )}
          </div>

          {/* ── Fee breakdown ─────────────────────────────────────────────── */}
          {cryptoAmount > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Breakdown</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Gross Amount</span>
                  <span className="font-bold text-white tabular-nums">
                    {formatFiat(parseFloat(watchFiatAmount) || 0, watchFiatCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">
                    Fee ({watchMethod === "EFT" ? "1.5% + R15" : "3.5% + R250"})
                  </span>
                  <span className="font-bold text-amber-400 tabular-nums">
                    − {formatFiat(feeAmount, watchFiatCurrency)}
                  </span>
                </div>
                <div className="neon-divider" />
                <div className="flex justify-between text-xs">
                  <span className="text-white/70 font-bold">Net Payout</span>
                  <span className="font-black text-accent tabular-nums">
                    {formatFiat(netFiatAmount, watchFiatCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/30">Crypto reserved</span>
                  <span className="font-mono text-white/40 tabular-nums">
                    {formatCrypto(cryptoAmount, watchSymbol)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Bank Details ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-px flex-1",
                "bg-gradient-to-r from-transparent via-white/10 to-transparent"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
                {watchMethod === "EFT" ? (
                  <><Building2 className="h-3 w-3" /> SA Bank Details</>
                ) : (
                  <><Globe className="h-3 w-3" /> International Bank Details</>
                )}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <FormInput
              label="Account Holder Name"
              placeholder="Full legal name on bank account"
              error={errors.accountHolder?.message}
              {...register("accountHolder")}
            />

            {/* SA Bank name dropdown vs free text for SWIFT */}
            {watchMethod === "EFT" ? (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Bank Name
                </Label>
                <Select
                  value={watch("bankName")}
                  onValueChange={(v) => setValue("bankName", v, { shouldValidate: true })}
                >
                  <SelectTrigger
                    className={cn(
                      "h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm text-white",
                      errors.bankName && "border-destructive/60"
                    )}
                  >
                    <SelectValue placeholder="Select your bank" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0C12] border-white/[0.1] rounded-xl">
                    {SA_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank} className="text-sm text-white focus:bg-white/[0.08] rounded-lg">
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bankName && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.bankName.message}
                  </p>
                )}
              </div>
            ) : (
              <FormInput
                label="Bank Name"
                placeholder="e.g. HSBC, Barclays, Chase"
                error={errors.bankName?.message}
                {...register("bankName")}
              />
            )}

            <div className={cn("grid gap-3", watchMethod === "EFT" ? "grid-cols-2" : "grid-cols-1")}>
              <FormInput
                label={watchMethod === "EFT" ? "Account Number" : "IBAN / Account Number"}
                placeholder={watchMethod === "EFT" ? "e.g. 1234567890" : "e.g. GB29NWBK60161331926819"}
                error={errors.accountNumber?.message}
                {...register("accountNumber")}
              />
              {watchMethod === "EFT" && (
                <FormInput
                  label="Branch Code"
                  placeholder="e.g. 632005"
                  error={errors.branchCode?.message}
                  {...register("branchCode")}
                />
              )}
            </div>

            {watchMethod === "SWIFT" && (
              <>
                <FormInput
                  label="SWIFT / BIC Code"
                  placeholder="e.g. NWBKGB2L (8–11 chars)"
                  error={errors.swiftCode?.message}
                  {...register("swiftCode")}
                />
                <FormInput
                  label="Bank Address"
                  sublabel="optional"
                  placeholder="Street, City, Country"
                  error={errors.bankAddress?.message}
                  {...register("bankAddress")}
                />
                <FormInput
                  label="Routing / Sort Code"
                  sublabel="if required"
                  placeholder="e.g. 60-16-13"
                  error={errors.routingNumber?.message}
                  {...register("routingNumber")}
                />
              </>
            )}
          </div>

          {/* ── Compliance notice ──────────────────────────────────────────── */}
          <div className="flex gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <Info className="h-3.5 w-3.5 text-white/30 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/30 leading-relaxed">
              {watchMethod === "EFT"
                ? "Transfers ≥ R3,000 trigger FATF Travel Rule reporting. Enhanced due diligence applies above R25,000 (FICA)."
                : "International transfers are subject to SARB exchange control regulations and SWIFT fees imposed by correspondent banks."}
            </p>
          </div>

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={onSubmitForm}
            disabled={isSubmitting || !isValid || hasInsufficientBalance || !watchSymbol}
            className={cn(
              "w-full h-12 rounded-xl font-black text-sm text-white uppercase tracking-wider",
              "btn-premium transition-all duration-200",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
              "flex items-center justify-center gap-2"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting Request…
              </>
            ) : (
              <>
                Review Withdrawal
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Confirmation Dialog ────────────────────────────────────────────── */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="max-w-sm border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base font-black">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Banknote className="h-3.5 w-3.5 text-primary" />
              </div>
              Confirm Withdrawal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-white/50 leading-relaxed">
              Please review your withdrawal details carefully. Once submitted, funds will be reserved pending admin approval.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2.5 my-1">
            {/* Method badge */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
              <div className="flex items-center gap-2">
                {watchMethod === "EFT" ? (
                  <Building2 className="h-4 w-4 text-primary" />
                ) : (
                  <Globe className="h-4 w-4 text-accent" />
                )}
                <span className="text-xs font-black text-white">{watchMethod === "EFT" ? "EFT — SA Bank" : "SWIFT — International"}</span>
              </div>
              <span className="text-[10px] font-bold text-white/40 uppercase">
                {watchMethod === "EFT" ? "1–2 days" : "3–5 days"}
              </span>
            </div>

            {/* Summary rows */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 space-y-2.5">
              {[
                {
                  label: "Gross Amount",
                  value: formatFiat(parseFloat(watchFiatAmount) || 0, watchFiatCurrency),
                  highlight: false,
                },
                {
                  label: "Platform Fee",
                  value: `− ${formatFiat(feeAmount, watchFiatCurrency)}`,
                  highlight: false,
                  valueClass: "text-amber-400",
                },
                {
                  label: "Net Payout",
                  value: formatFiat(netFiatAmount, watchFiatCurrency),
                  highlight: true,
                },
                {
                  label: "Crypto Reserved",
                  value: formatCrypto(cryptoAmount, watchSymbol),
                  highlight: false,
                  valueClass: "font-mono text-white/50 text-[10px]",
                },
              ].map(({ label, value, highlight, valueClass }) => (
                <div key={label} className={cn("flex justify-between items-center text-xs", highlight && "pt-1.5 border-t border-white/[0.06]")}>
                  <span className={cn("font-medium", highlight ? "text-white/70" : "text-white/40")}>{label}</span>
                  <span className={cn("font-black tabular-nums", highlight ? "text-accent" : "text-white", valueClass)}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Destination */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Destination Account</p>
              <p className="text-xs font-bold text-white">{watch("accountHolder")}</p>
              <p className="text-[11px] text-white/50">{watch("bankName")}</p>
              <p className="text-[11px] font-mono text-white/40">{watch("accountNumber")}</p>
              {watchMethod === "SWIFT" && watch("swiftCode") && (
                <p className="text-[10px] font-mono text-primary/70">SWIFT: {watch("swiftCode")}</p>
              )}
              {watchMethod === "EFT" && watch("branchCode") && (
                <p className="text-[10px] font-mono text-primary/70">Branch: {watch("branchCode")}</p>
              )}
            </div>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11 text-[11px] font-black uppercase border-white/[0.1] bg-transparent hover:bg-white/[0.04] flex-1">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn-premium rounded-xl h-11 text-[11px] font-black uppercase text-white flex-1 border-0"
              onClick={(e) => {
                e.preventDefault();
                onConfirmWithdrawal();
              }}
            >
              Confirm &amp; Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
