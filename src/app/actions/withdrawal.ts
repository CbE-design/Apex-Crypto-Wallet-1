"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendWithdrawalRequestedEmail } from "@/app/actions/transactional-email";

interface RequestWithdrawalInput {
  userId: string;
  amount: number;
  currency: string;
  destinationAddress: string;
}

export async function requestWithdrawalAction({
  userId,
  amount,
  currency,
  destinationAddress,
}: RequestWithdrawalInput) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { success: false, error: "User profile not found." };
    }

    const userData = userDoc.data();
    const currentBalance = userData?.balance || 0;

    if (currentBalance < amount) {
      return { success: false, error: "Insufficient account balance." };
    }

    // Deduct balance
    await userRef.update({
      balance: currentBalance - amount,
    });

    // Create withdrawal transaction record
    await db.collection("transactions").add({
      userId,
      type: "WITHDRAWAL",
      amount,
      currency,
      status: "PENDING",
      destinationAddress,
      createdAt: new Date().toISOString(),
    });

    // Send confirmation email if user has email address
    if (userData?.email) {
      await sendWithdrawalRequestedEmail({
        to: userData.email,
        userName: userData.name || userData.firstName || "User",
        amount,
        asset: currency,
        destinationAddress,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/withdraw");

    return { success: true };
  } catch (error) {
    console.error("Error processing withdrawal request:", error);
    return { success: false, error: "Failed to process withdrawal request." };
  }
}
