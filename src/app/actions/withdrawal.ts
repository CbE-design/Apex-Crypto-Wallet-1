"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { FieldValue } from "firebase-admin/firestore";
import { sendWithdrawalRequestEmail } from "@/app/actions/transactional-email";

interface RequestWithdrawalInput {
  userId: string;
  userEmail: string;
  walletAddress: string;

  // Asset details
  cryptoSymbol: string;
  cryptoAmount: number;
  fiatCurrency: string;
  fiatAmount: number;
  exchangeRate: number;
  networkFee: number;

  // Bank details
  withdrawalMethod: "EFT" | "SWIFT";
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branchCode?: string;
  swiftCode?: string;
  bankAddress?: string;
  routingNumber?: string;
}

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APX-${ts}-${rand}`;
}

export async function requestWithdrawalAction(input: RequestWithdrawalInput) {
  try {
    const db = getDb();
    const userRef = db.collection("users").doc(input.userId);
    const walletRef = db
      .collection("users")
      .doc(input.userId)
      .collection("wallets")
      .doc(input.cryptoSymbol);

    const transactionReference = generateReference();

    await db.runTransaction(async (tx) => {
      const [userDoc, walletDoc] = await Promise.all([
        tx.get(userRef),
        tx.get(walletRef),
      ]);

      if (!userDoc.exists) throw new Error("User profile not found.");
      if (!walletDoc.exists) throw new Error("Wallet not found.");

      const walletData = walletDoc.data()!;
      const currentBalance: number = walletData.balance ?? 0;
      const currentReserved: number = walletData.reservedForWithdrawal ?? 0;

      if (currentBalance < input.cryptoAmount) {
        throw new Error("Insufficient balance for this withdrawal.");
      }

      // Reserve the crypto — deduct from available, add to reserved
      tx.update(walletRef, {
        balance: currentBalance - input.cryptoAmount,
        reservedForWithdrawal: currentReserved + input.cryptoAmount,
        lastSynced: FieldValue.serverTimestamp(),
      });

      // Create withdrawal request
      const requestRef = db.collection("withdrawal_requests").doc();
      tx.set(requestRef, {
        id: requestRef.id,
        userId: input.userId,
        userEmail: input.userEmail,
        walletAddress: input.walletAddress,

        cryptoSymbol: input.cryptoSymbol,
        cryptoAmount: input.cryptoAmount,
        fiatCurrency: input.fiatCurrency,
        fiatAmount: input.fiatAmount,
        exchangeRate: input.exchangeRate,
        networkFee: input.networkFee,

        withdrawalMethod: input.withdrawalMethod,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        accountHolder: input.accountHolder,
        ...(input.branchCode ? { branchCode: input.branchCode } : {}),
        ...(input.swiftCode ? { swiftCode: input.swiftCode } : {}),
        ...(input.bankAddress ? { bankAddress: input.bankAddress } : {}),

        // cryptoBreakdown used by admin approval flow to restore reservedForWithdrawal
        cryptoBreakdown: [
          {
            symbol: input.cryptoSymbol,
            amount: input.cryptoAmount,
            priceUSD: input.exchangeRate,
          },
        ],

        status: "PENDING",
        transactionReference,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // Send confirmation email (non-blocking)
    try {
      await sendWithdrawalRequestEmail({
        to: input.userEmail,
        userName: input.accountHolder,
        amount: input.fiatAmount,
        assetType: input.cryptoSymbol,
        methodDetails: `${input.withdrawalMethod} — ${input.bankName} (${input.accountNumber})`,
      });
    } catch {
      // email failure is non-fatal
    }

    revalidatePath("/cash-out");

    return { success: true, reference: transactionReference };
  } catch (error: any) {
    console.error("[requestWithdrawalAction]", error);
    return { success: false, error: error.message ?? "Failed to process withdrawal request." };
  }
}
