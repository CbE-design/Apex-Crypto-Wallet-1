"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db"; // Adjust to your DB/Prisma/Supabase client
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
    // 1. Fetch recipient details
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      return { success: false, error: "User not found or missing email address." };
    }

    // 2. Perform balance increment and log transaction
    const updatedUser = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          amount,
          currency,
          status: "COMPLETED",
          description: description || "Direct deposit credit by admin",
        },
      });

      return updated;
    });

    // 3. Dispatch deposit email
    const emailResult = await sendDepositCreditedEmail({
      email: user.email,
      name: user.name || user.firstName || "User",
      amount,
      currency,
    });

    if (!emailResult.success) {
      console.warn("Wallet credited, but deposit email failed:", emailResult.error);
    }

    revalidatePath("/admin/direct-send");
    return { success: true, data: updatedUser };
  } catch (error) {
    console.error("Error crediting wallet:", error);
    return { success: false, error: "Failed to credit user account." };
  }
}
