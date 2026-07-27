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
  const [paymentMethod, setPaymentMethod] = useState<string>("crypto");
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
        destination: `Method: ${paymentMethod.toUpperCase()} | Destination: ${destination}`,
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
          Available Balance:{" "}
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
        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
            Withdrawal Method
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "crypto", label: "Crypto Wallet" },
              { id: "bank", label: "Bank Wire" },
              { id: "paypal", label: "PayPal" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                  paymentMethod === method.id
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount & Currency Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
            Amount
          </label>
          <div className="flex rounded-lg shadow-sm">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-700 rounded-r-lg text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="BTC">BTC</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
        </div>

        {/* Destination Details */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
            {paymentMethod === "crypto"
              ? "Wallet Address"
              : paymentMethod === "bank"
              ? "Bank IBAN / Account Details"
              : "PayPal Email Address"}
          </label>
          <textarea
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={
              paymentMethod === "crypto"
                ? "e.g., 0x71C... or bc1q..."
                : paymentMethod === "bank"
                ? "Include Account Holder, IBAN, and SWIFT/BIC"
                : "your-paypal@email.com"
            }
            rows={3}
            required
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold rounded-lg text-sm shadow transition-colors flex justify-center items-center gap-2"
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
