"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { FieldValue } from "firebase-admin/firestore";
import { sendDepositCreditedEmail } from "@/app/actions/transactional-email";
import { settleBaseTokenToWallet, type BaseToken } from "@/lib/base-token-server";

interface CreditWalletInput {
  /** Can be a Firestore user doc ID, a registered email address, or a wallet address. */
  userId: string;
  amount: number;
  currency: string;
  description?: string;
}

/** Resolve a user document by email first, then walletAddress, then doc-ID. */
async function resolveUserDoc(identifier: string) {
  const db = getDb();
  const trimmed = identifier.toLowerCase().trim();

  // 1. Email lookup (primary — most reliable for admin use)
  if (trimmed.includes("@")) {
    const snap = await db
      .collection("users")
      .where("email", "==", trimmed)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }

  // 2. Wallet address lookup
  const snapWallet = await db
    .collection("users")
    .where("walletAddress", "==", identifier.trim())
    .limit(1)
    .get();
  if (!snapWallet.empty) return snapWallet.docs[0];

  // 3. Fallback: direct doc-ID lookup
  const byId = await db.collection("users").doc(identifier.trim()).get();
  if (byId.exists) return byId;

  return null;
}

export async function creditUserWalletAction({
  userId,
  amount,
  currency,
  description,
}: CreditWalletInput) {
  try {
    if (!userId || !currency || !amount || amount <= 0) {
      return { success: false, error: "Invalid input: userId, currency, and a positive amount are required." };
    }

    const userDoc = await resolveUserDoc(userId);

    if (!userDoc) {
      return {
        success: false,
        error: `No user found matching "${userId}". Try the exact email address, wallet address, or Firestore user ID.`,
      };
    }

    const userData = userDoc.data();
    const resolvedId = userDoc.id;
    const db = getDb();
    const normalizedCurrency = currency.toUpperCase() as BaseToken | string;
    const recipientAddress = String(userData?.walletAddress || '').trim();
    let settlement: Awaited<ReturnType<typeof settleBaseTokenToWallet>> | null = null;

    if (normalizedCurrency === 'APXD' || normalizedCurrency === 'USDT') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(recipientAddress)) {
        return { success: false, error: 'The user does not have a valid Base wallet address.' };
      }
      settlement = await settleBaseTokenToWallet(normalizedCurrency, recipientAddress, String(amount));
    }

    // ── 1. Credit the per-asset wallet subcollection ──────────────────────
    // This is the exact path portfolio-overview.tsx and wallets/page.tsx read:
    //   users/{uid}/wallets/{SYMBOL}  →  { balance, currency, ... }
    const walletRef = db.collection("users").doc(resolvedId).collection("wallets").doc(currency);
    // Only APXD has an RPC-based live balance read (useLiveApxdBalance) that
    // reflects the on-chain settlement directly from the user's Apex wallet
    // address. Incrementing Firestore for APXD would therefore double-count.
    // USDT (and every other asset) has no such RPC read for the Apex wallet —
    // the UI reads the Firestore `walletDoc.balance`, so we must still increment
    // it, otherwise the credited funds never appear.
    const skipFirestoreIncrement = settlement != null && normalizedCurrency === "APXD";
    if (!skipFirestoreIncrement) {
      await walletRef.set(
        {
          balance: FieldValue.increment(amount),
          currency,
          id: currency,
          userId: resolvedId,
        },
        { merge: true },
      );
    }

    // ── 2. Record a transaction in the user's subcollection ───────────────
    // transaction-history.tsx queries: users/{uid}/transactions
    // orderBy('timestamp', 'desc'), expects type/status exactly as below.
    const txRef = db.collection("users").doc(resolvedId).collection("transactions").doc();
    await txRef.set({
      type: "Internal Transfer",
      currency,
      amount,
      price: 0,                                      // fiat price unknown at credit time
      status: "Completed",
      timestamp: FieldValue.serverTimestamp(),
      notes: description || "Admin direct wallet credit",
      sender: "Apex Admin",
      recipient: userData?.walletAddress || resolvedId,
      metadata: {
        travelRuleVerified: false,
        complianceId: `ADMIN_CREDIT_${Date.now()}`,
        protocol: "DIRECT_SEND",
      },
    });

    // ── 3. Debit Whale Treasury (best-effort) ─────────────────────────────
    try {
      const whalRef = db.collection("whale_treasury").doc("balances");
      const whalSnap = await whalRef.get();
      if (whalSnap.exists) {
        const whalData = whalSnap.data() as Record<string, number>;
        const currentTreasury = whalData[currency] ?? 0;
        await whalRef.update({ [currency]: Math.max(0, currentTreasury - amount) });
      }
    } catch (whaleErr) {
      console.warn("[direct-send] Could not debit whale treasury:", whaleErr);
    }

    // ── 4. Fire email notification (best-effort) ──────────────────────────
    if (userData?.email) {
      try {
        await sendDepositCreditedEmail({
          to: userData.email,
          userName: userData.name || userData.firstName || "Valued Client",
          amount,
          asset: currency,
          notes: description || "ADMIN_DIRECT_CREDIT",
        });
      } catch (emailErr) {
        console.warn("[direct-send] Email notification failed:", emailErr);
      }
    }

    // ── 5. Invalidate server-side cache so dashboards reflect new balance ──
    revalidatePath("/dashboard");
    revalidatePath("/wallets");
    revalidatePath("/wallet");
    revalidatePath("/admin/direct-send");
    revalidatePath("/admin/whale");
    revalidatePath("/admin/users");

    return {
      success: true,
      resolvedEmail: userData?.email,
      resolvedUid: resolvedId,
    };
  } catch (error) {
    console.error("[direct-send] Error crediting wallet:", error);
    return { success: false, error: "Failed to credit user wallet. Check server logs for details." };
  }
}
