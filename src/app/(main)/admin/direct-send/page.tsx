"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { creditUserWalletAction } from "@/app/actions/direct-send";
import { AdminRoute } from "@/components/admin/admin-route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Mail,
  ChevronDown,
  Wallet,
  ArrowDownRight,
  RefreshCw,
  SendHorizonal,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KYCStatus } from "@/lib/types";

/* ───────────────────────── Types ───────────────────────── */

interface UserDoc {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  kycStatus?: KYCStatus;
  isRestricted?: boolean;
}

interface WalletBalance {
  id: string;
  currency: string;
  balance: number;
}

const CURRENCIES = ["USD", "EUR", "GBP", "USDT", "BTC"] as const;
type Currency = (typeof CURRENCIES)[number];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  BTC: "₿",
  USDT: "₮",
};

/* ─────────────────────── KYC badge ─────────────────────── */

function KycBadge({ status }: { status?: KYCStatus }) {
  switch (status) {
    case "APPROVED":
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-green-500/10 text-green-400 border-green-500/30">
          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          Verified
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/30">
          <Clock className="h-2.5 w-2.5 mr-1" />
          Pending
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-2.5 w-2.5 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-muted/60 text-muted-foreground border-border">
          <ShieldCheck className="h-2.5 w-2.5 mr-1" />
          Unverified
        </Badge>
      );
  }
}

/* ─────────────────────── Balance card ──────────────────── */

function BalanceCard({
  currency,
  balance,
  highlighted,
}: {
  currency: string;
  balance: number;
  highlighted?: boolean;
}) {
  const sym = CURRENCY_SYMBOLS[currency as Currency] ?? "";
  const isSmall = currency === "BTC";
  const formatted = isSmall ? balance.toFixed(8) : balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors",
        highlighted
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-muted/30"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {currency}
      </span>
      <span className="text-sm font-bold text-foreground font-mono">
        {sym}{formatted}
      </span>
    </div>
  );
}

/* ─────────────────────── Main page ─────────────────────── */

export default function DirectSendPage() {
  const db = useFirestore();

  /* — User registry — */
  const [allUsers, setAllUsers] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  /* — Search / selection — */
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  /* — Wallet balances — */
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);

  /* — Form — */
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  /* ── Load all users once ── */
  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const docs: UserDoc[] = snap.docs.map((d) => ({
          id: d.id,
          email: d.data().email ?? "",
          name: d.data().name,
          firstName: d.data().firstName,
          lastName: d.data().lastName,
          kycStatus: d.data().kycStatus,
          isRestricted: d.data().isRestricted,
        }));
        setAllUsers(docs);
      } catch (err) {
        console.error("[v0] Failed to load users:", err);
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [db]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  /* ── Load wallet balances for selected user ── */
  const loadBalances = useCallback(
    async (uid: string) => {
      if (!db) return;
      setBalancesLoading(true);
      try {
        const snap = await getDocs(collection(db, "users", uid, "wallets"));
        const docs: WalletBalance[] = snap.docs.map((d) => ({
          id: d.id,
          currency: d.data().currency ?? d.id.toUpperCase(),
          balance: d.data().balance ?? 0,
        }));
        // Ensure all five currencies are represented
        const existing = new Set(docs.map((d) => d.currency));
        CURRENCIES.forEach((c) => {
          if (!existing.has(c)) docs.push({ id: c, currency: c, balance: 0 });
        });
        docs.sort((a, b) => CURRENCIES.indexOf(a.currency as Currency) - CURRENCIES.indexOf(b.currency as Currency));
        setBalances(docs);
      } catch (err) {
        console.error("[v0] Failed to load balances:", err);
        setBalances([]);
      } finally {
        setBalancesLoading(false);
      }
    },
    [db]
  );

  /* ── Filtered suggestions ── */
  const suggestions = searchQuery.trim().length > 0
    ? allUsers
        .filter((u) => {
          const q = searchQuery.toLowerCase();
          const displayName = [u.name, u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase();
          return (
            displayName.includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  /* ── Select a user ── */
  function selectUser(u: UserDoc) {
    setSelectedUser(u);
    setSearchQuery("");
    setDropdownOpen(false);
    setFeedback(null);
    loadBalances(u.id);
  }

  /* ── Clear selection ── */
  function clearSelection() {
    setSelectedUser(null);
    setBalances([]);
    setFeedback(null);
    setAmount("");
    setDescription("");
  }

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!selectedUser) {
      setFeedback({ type: "error", message: "Please select a user first." });
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFeedback({ type: "error", message: "Enter a valid positive amount." });
      return;
    }

    setLoading(true);
    try {
      const res = await creditUserWalletAction({
        userId: selectedUser.id,
        amount: numericAmount,
        currency,
        description,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Successfully credited ${CURRENCY_SYMBOLS[currency]}${numericAmount.toLocaleString()} ${currency} to ${selectedUser.email}.`,
        });
        setAmount("");
        setDescription("");
        // Refresh balances
        await loadBalances(selectedUser.id);
      } else {
        setFeedback({ type: "error", message: res.error ?? "Failed to credit wallet." });
      }
    } catch (err) {
      console.error("[v0] creditUserWalletAction error:", err);
      setFeedback({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  }

  const displayName = selectedUser
    ? [selectedUser.name, selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ") || selectedUser.email
    : "";

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Fund Wallet</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Credit a user&apos;s balance and automatically dispatch a deposit notification email.
            </p>
          </div>

          {/* ── Step 1: User search ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Step 1 — Select User
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {/* Search input */}
              {!selectedUser ? (
                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    {usersLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <Input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                      placeholder="Search by name, email, or user ID…"
                      className="pl-9 pr-9 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground"
                      disabled={usersLoading}
                    />
                  </div>

                  {/* Dropdown */}
                  {dropdownOpen && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                      {suggestions.map((u) => {
                        const name = [u.name, u.firstName, u.lastName].filter(Boolean).join(" ");
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => selectUser(u)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {name || u.email}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <KycBadge status={u.kycStatus} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {dropdownOpen && searchQuery.trim().length > 0 && suggestions.length === 0 && !usersLoading && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg px-4 py-3">
                      <p className="text-sm text-muted-foreground">No users match &quot;{searchQuery}&quot;.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected user profile card */
                <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{displayName}</span>
                      <KycBadge status={selectedUser.kycStatus} />
                      {selectedUser.isRestricted && (
                        <Badge variant="outline" className="text-[10px] font-bold bg-destructive/10 text-destructive border-destructive/30">
                          Restricted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{selectedUser.email}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono break-all">
                      UID: {selectedUser.id}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0 mt-1"
                  >
                    Change
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Step 2: Live balance preview ── */}
          {selectedUser && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Current Balances
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => loadBalances(selectedUser.id)}
                    disabled={balancesLoading}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3 w-3", balancesLoading && "animate-spin")} />
                    Refresh
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {balancesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {balances.map((b) => (
                      <BalanceCard
                        key={b.currency}
                        currency={b.currency}
                        balance={b.balance}
                        highlighted={b.currency === currency}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Transaction form ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                Step 2 — Transaction Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Amount + Currency */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono select-none">
                        {CURRENCY_SYMBOLS[currency]}
                      </span>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="pl-7 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Currency
                    </label>
                    <div className="relative">
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className="w-full appearance-none rounded-md border border-border bg-muted/40 px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Description / Memo
                  </label>
                  <Input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Welcome bonus, Deposit match, Manual adjustment"
                    className="bg-muted/40 border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Feedback */}
                {feedback && (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
                      feedback.type === "success"
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    )}
                  >
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading || !selectedUser}
                  className="w-full gap-2 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <SendHorizonal className="h-4 w-4" />
                      Credit User Balance
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  A deposit notification email will be sent to the user automatically.
                </p>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </AdminRoute>
  );
}
