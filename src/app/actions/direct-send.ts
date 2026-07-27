"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { sendDepositCreditedEmail } from "@/app/actions/transactional-email";

interface CreditWalletInput {
  userId: string;
  amount: number;
  currency: string;
  description?: string;
}

export async function creditUserWalletAction({
  userId,
  amount,
  currency,
  description,
}: CreditWalletInput) {
  try {
    const userRef = getDb().collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { success: false, error: "User profile not found." };
    }

    const userData = userDoc.data();
    const currentBalance = userData?.balance || 0;
    const newBalance = currentBalance + amount;

    await userRef.update({ balance: newBalance });

    await getDb().collection("transactions").add({
      userId,
      type: "CREDIT",
      amount,
      currency,
      status: "COMPLETED",
      description: description || "Direct admin wallet credit",
      createdAt: new Date().toISOString(),
    });

    if (userData?.email) {
      await sendDepositCreditedEmail({
        to: userData.email,
        userName: userData.name || userData.firstName || "User",
        amount,
        asset: currency,
        notes: description || "ADMIN_DIRECT_CREDIT",
      });
    }

    revalidatePath("/admin/direct-send");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error crediting wallet:", error);
    return { success: false, error: "Failed to credit user wallet." };
  }
}
