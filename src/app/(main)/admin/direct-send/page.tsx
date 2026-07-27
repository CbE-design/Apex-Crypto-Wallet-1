"use client";

import { useState } from "react";
import { creditUserWalletAction } from "@/app/actions/direct-send";

export default function DirectSendPage() {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numericAmount = parseFloat(amount);
    if (!userId || isNaN(numericAmount) || numericAmount <= 0) {
      setFeedback({ type: "error", message: "Please provide a valid User ID and Amount." });
      return;
    }

    setLoading(true);

    try {
      const res = await creditUserWalletAction({
        userId,
        amount: numericAmount,
        currency,
        description,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Successfully credited ${currency} ${numericAmount} to user ${userId}` });
        setUserId("");
        setAmount("");
        setDescription("");
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to credit wallet." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-100 dark:border-gray-800">
      <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Direct Send / Credit Wallet</h1>
      <p className="text-sm text-gray-500 mb-6">Manually credit user account balances and dispatch email notifications.</p>

      {feedback && (
        <div className={`p-4 mb-6 rounded-lg text-sm font-medium ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter User ID"
            required
            className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="USDT">USDT</option>
              <option value="BTC">BTC</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Description / Memo</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Deposit match bonus"
            className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:bg-gray-400"
        >
          {loading ? "Processing..." : "Credit User Balance"}
        </button>
      </form>
    </div>
  );
}
