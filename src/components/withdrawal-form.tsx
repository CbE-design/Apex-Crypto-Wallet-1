"use client";

import { useState } from "react";
import { requestWithdrawalAction } from "@/app/actions/withdrawal"; // Adjust path if your action is located elsewhere

interface WithdrawalProps {
  userId?: string;
  userBalance?: number;
  userEmail?: string;
}

export default function Withdrawal({
  userId,
  userBalance = 0,
  userEmail,
}: WithdrawalProps) {
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [destination, setDestination] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFeedback({
        type: "error",
        message: "Please enter a valid withdrawal amount.",
      });
      return;
    }

    if (numericAmount > userBalance) {
      setFeedback({
        type: "error",
        message: "Insufficient account balance for this transaction.",
      });
      return;
    }

    if (!destination.trim()) {
      setFeedback({
        type: "error",
        message: "Please enter your payment or wallet address details.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestWithdrawalAction({
        userId: userId || "",
        amount: numericAmount,
        currency,
        destinationAddress: destination,
      });

      if (response.success) {
        setFeedback({
          type: "success",
          message:
            "Withdrawal request submitted! An email confirmation has been sent to your inbox.",
        });
        setAmount("");
        setDestination("");
      } else {
        setFeedback({
          type: "error",
          message: response.error || "Failed to process withdrawal request.",
        });
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      setFeedback({
        type: "error",
        message: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800">
      {/* Header section */}
      <div className="mb-6 border-b pb-4 border-gray-100 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Request Withdrawal
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Available Balance: {" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            ${userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </p>
      </div>

      {/* Notification feedback banner */}
      {feedback && (
        <div
          className={`p-4 mb-6 rounded-lg text-sm font-medium border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleWithdrawalSubmit} className="space-y-5">
        {/* Asset / Currency Selector (restored to previous dropdown UI) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
            Select Asset
          </label>
          <div className="h-10 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between px-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-transparent text-sm text-white/90 outline-none"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="BTC">BTC</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
        </div>

        {/* Amount & Currency Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
            Amount
          </label>
          <div className="relative">
            <div className="h-10 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center px-3">
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="flex-1 bg-transparent text-sm text-white/90 outline-none"
              />
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-white/30">{currency}</span>
          </div>
        </div>

        {/* Destination Details (label adapts based on asset type) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
            {currency === "BTC" || currency === "USDT" ? "Wallet Address" : currency === "USD" ? "Bank IBAN / Account Details" : "Payment Details"}
          </label>
          <textarea
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={
              currency === "BTC" || currency === "USDT"
                ? "e.g., 0x71C... or bc1q..."
                : currency === "USD"
                ? "Include Account Holder, IBAN, and SWIFT/BIC"
                : "Enter payment details"
            }
            rows={3}
            required
            className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-white/90 outline-none"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold rounded-lg text-sm shadow transition-colors flex justify-center items-center gap-3"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Processing Request...
            </>
          ) : (
            "Request Withdrawal"
          )}
        </button>
      </form>
    </div>
  );
}
