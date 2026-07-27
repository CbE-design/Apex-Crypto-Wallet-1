"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { sendDepositCreditedEmail } from "@/app/actions/transactional-email";

interface CreditWalletInput {
  /** Can be a Firestore user doc ID, a registered email address, or a wallet address. */
  userId: string;
  amount: number;
  currency: string;
  description?: string;
}

/** Resolve a user document by doc-ID, email, or walletAddress field. */
async function resolveUserDoc(identifier: string) {
  const db = getDb();

  // 1. Try direct doc-ID lookup first (fast path)
  const byId = await db.collection("users").doc(identifier).get();
  if (byId.exists) return byId;

  // 2. Email lookup
  if (identifier.includes("@")) {
    const snap = await db
      .collection("users")
      .where("email", "==", identifier.toLowerCase().trim())
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }

  // 3. Wallet address lookup (case-insensitive)
  const snapWallet = await db
    .collection("users")
    .where("walletAddress", "==", identifier)
    .limit(1)
    .get();
  if (!snapWallet.empty) return snapWallet.docs[0];

  return null;
}

export async function creditUserWalletAction({
  userId,
  amount,
  currency,
  description,
}: CreditWalletInput) {
  try {
    const userDoc = await resolveUserDoc(userId);

    if (!userDoc) {
      return { success: false, error: "User not found. Try the exact user ID, registered email, or wallet address." };
    }

    const userData = userDoc.data();
    const resolvedId = userDoc.id;

    // Credit the correct per-asset balance field (balances.<symbol>) and also
    // keep the legacy top-level `balance` field in sync for USD-like assets.
    const db = getDb();
    const userRef = db.collection("users").doc(resolvedId);

    const balanceField = `balances.${currency}`;
    const currentAssetBalance = userData?.[`balances`]?.[currency] ?? 0;
    const newAssetBalance = currentAssetBalance + amount;

    await userRef.update({
      [balanceField]: newAssetBalance,
      // Keep legacy `balance` field for USD/EUR/GBP credits
      ...(["USD", "EUR", "GBP"].includes(currency)
        ? { balance: (userData?.balance || 0) + amount }
        : {}),
    });

    await db.collection("transactions").add({
      userId: resolvedId,
      type: "CREDIT",
      amount,
      currency,
      status: "COMPLETED",
      description: description || "Direct admin wallet credit",
      adminNote: description || "",
      createdAt: new Date().toISOString(),
    });

    // Debit Whale Treasury
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

    // Fire email notification
    if (userData?.email) {
      await sendDepositCreditedEmail({
        to: userData.email,
        userName: userData.name || userData.firstName || "Valued Client",
        amount,
        asset: currency,
        notes: description || "ADMIN_DIRECT_CREDIT",
      });
    }

    revalidatePath("/admin/direct-send");
    revalidatePath("/admin/whale");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("[direct-send] Error crediting wallet:", error);
    return { success: false, error: "Failed to credit user wallet." };
  }
}
