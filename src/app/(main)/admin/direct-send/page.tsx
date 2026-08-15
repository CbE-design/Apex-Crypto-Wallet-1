"use client";

import { useState, useEffect, useCallback } from "react";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { creditUserWalletAction } from "@/app/actions/direct-send";
import { AdminRoute } from "@/components/admin/admin-route";
import { CryptoIcon } from "@/components/crypto-icon";
import { cn } from "@/lib/utils";
import {
  Wallet, ChevronDown, AlertTriangle, Search, ArrowRight, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import Link from "next/link";

// ─── Asset definitions ───────────────────────────────────────────────────────

const ASSETS = [
  { symbol: "APEX", name: "Apex Coin",         isCrypto: true  },
  { symbol: "ETH",  name: "Ethereum",        isCrypto: true  },
  { symbol: "BTC",  name: "Bitcoin",          isCrypto: true  },
  { symbol: "USDT", name: "Tether",           isCrypto: true  },
  { symbol: "SOL",  name: "Solana",           isCrypto: true  },
  { symbol: "BNB",  name: "BNB",              isCrypto: true  },
  { symbol: "USD",  name: "US Dollar",        isCrypto: false },
  { symbol: "EUR",  name: "Euro",             isCrypto: false },
  { symbol: "GBP",  name: "British Pound",    isCrypto: false },
] as const;

type AssetSymbol = (typeof ASSETS)[number]["symbol"];

// ─── Whale Treasury banner (reads from Firestore) ────────────────────────────

function WhaleTreasuryBanner({ symbol }: { symbol: AssetSymbol }) {
  const firestore = useFirestore();
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!firestore) return;
    try {
      const ref = doc(firestore, "whale_treasury", "balances");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Record<string, number>;
        setBalance(data[symbol] ?? 0);
      } else {
        setBalance(0);
      }
    } catch {
      setBalance(0);
    }
  }, [firestore, symbol]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const isCrypto = ASSETS.find((a) => a.symbol === symbol)?.isCrypto ?? false;
  const displayBalance =
    balance === null
      ? "—"
      : isCrypto
      ? `${balance.toFixed(6)} ${symbol}`
      : `${symbol} ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          {/* wave-style icon */}
          <svg className="h-4 w-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-400/70 mb-0.5">Whale Treasury</p>
          <p className="text-sm font-bold tabular-nums text-cyan-300">{displayBalance}</p>
        </div>
      </div>
      <Link
        href="/admin/whale"
        className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        Manage <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Asset Dropdown ───────────────────────────────────────────────────────────

function AssetDropdown({
  value,
  onChange,
}: {
  value: AssetSymbol;
  onChange: (v: AssetSymbol) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = ASSETS.find((a) => a.symbol === value)!;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:border-white/[0.14] transition-all"
      >
        <CryptoIcon name={selected.name} className="h-5 w-5 shrink-0" />
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-white">{selected.symbol}</span>
          <span className="ml-2 text-xs text-white/40">{selected.name}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-white/30 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-20 mt-1.5 rounded-xl border border-white/[0.1] bg-[#0D1018] shadow-2xl shadow-black/60 overflow-hidden">
            {ASSETS.map((asset) => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => { onChange(asset.symbol as AssetSymbol); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors",
                  asset.symbol === value && "bg-cyan-500/8"
                )}
              >
                <CryptoIcon name={asset.name} className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold text-white/80">{asset.symbol}</span>
                <span className="text-xs text-white/35">{asset.name}</span>
                {asset.symbol === value && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Review / Confirm modal ───────────────────────────────────────────────────

interface ReviewModalProps {
  asset: AssetSymbol;
  recipient: string;
  amount: string;
  note: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ReviewModal({ asset, recipient, amount, note, onConfirm, onCancel, loading }: ReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#0A0C12] p-6 space-y-5 shadow-2xl shadow-black/60">
        {/* top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl bg-gradient-to-r from-cyan-500 to-violet-500" />

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Wallet className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Confirm Credit</h3>
            <p className="text-xs text-white/40">Review before executing</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden text-[12px]">
          {[
            { label: "Asset",     value: asset },
            { label: "Recipient", value: recipient },
            { label: "Amount",    value: `${amount} ${asset}` },
            { label: "Note",      value: note || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-white/35 font-semibold uppercase tracking-wide text-[10px]">{label}</span>
              <span className="text-white/85 font-mono text-right max-w-[55%] break-all">{value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-[11px] text-amber-400/90 leading-relaxed">
            This will debit the Whale Treasury and credit the recipient&apos;s ledger balance. This action is irreversible.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-white/50 hover:text-white/70 hover:border-white/20 text-sm font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 text-[#040609] font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin text-white/60" /> Executing…</>
            ) : (
              "Execute Credit"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DirectSendPage() {
  const [asset, setAsset]       = useState<AssetSymbol>("ETH");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount]     = useState("");
  const [note, setNote]         = useState("");

  const [showReview, setShowReview] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canReview =
    recipient.trim().length > 0 &&
    parseFloat(amount) > 0;

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canReview) return;
    setResult(null);
    setShowReview(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await creditUserWalletAction({
        userId: recipient.trim(),
        amount: parseFloat(amount),
        currency: asset,
        description: note || "Admin direct wallet credit",
      });

      if (res.success) {
        setResult({ type: "success", message: `Successfully credited ${amount} ${asset} to ${recipient.trim()}.` });
        setRecipient("");
        setAmount("");
        setNote("");
      } else {
        setResult({ type: "error", message: res.error || "Failed to credit wallet." });
      }
    } catch (err) {
      console.error("[v0] DirectSend confirm error:", err);
      setResult({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
      setShowReview(false);
    }
  };

  return (
    <AdminRoute>
      <div className="max-w-2xl space-y-6 pb-20">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Wallet className="h-5 w-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Fund Wallet</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">
            Internal Ledger Credit · Debits Whale Treasury
          </p>
        </div>

        {/* Whale Treasury Banner */}
        <WhaleTreasuryBanner symbol={asset} />

        {/* Audit Warning */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06]">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-400/90 leading-relaxed">
            <span className="font-bold">CRITICAL:</span> Direct ledger manipulation. All actions are audited and linked to{" "}
            <span className="font-semibold">corrie@apex-crypto.co.uk</span>. Funds are debited from the Whale Treasury.
          </p>
        </div>

        {/* Result feedback */}
        {result && (
          <div
            className={cn(
              "flex items-start gap-3 px-4 py-3.5 rounded-xl border text-[12px] font-medium",
              result.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                : "border-red-500/20 bg-red-500/[0.06] text-red-400"
            )}
          >
            {result.type === "success"
              ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            }
            {result.message}
          </div>
        )}

        {/* Form card */}
        <form
          onSubmit={handleReview}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5"
        >
          {/* Asset */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Asset
            </label>
            <AssetDropdown value={asset} onChange={(v) => { setAsset(v); setResult(null); }} />
          </div>

          {/* User email or wallet address */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              User Email or Wallet Address
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="user@example.com or 0x..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:bg-cyan-500/[0.03] transition-all"
              />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Amount to Credit
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:bg-cyan-500/[0.03] transition-all tabular-nums font-mono"
            />
          </div>

          {/* Admin note */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Admin Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for manual credit..."
              className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:bg-cyan-500/[0.03] transition-all"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canReview}
            className={cn(
              "w-full py-3 rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] transition-all",
              canReview
                ? "bg-white/[0.07] border border-white/[0.14] text-white/70 hover:bg-white/[0.11] hover:text-white hover:border-white/25"
                : "bg-white/[0.03] border border-white/[0.06] text-white/20 cursor-not-allowed"
            )}
          >
            <Search className="h-4 w-4" />
            Review Credit
          </button>
        </form>
      </div>

      {/* Review modal */}
      {showReview && (
        <ReviewModal
          asset={asset}
          recipient={recipient}
          amount={amount}
          note={note}
          onConfirm={handleConfirm}
          onCancel={() => setShowReview(false)}
          loading={loading}
        />
      )}
    </AdminRoute>
  );
}
