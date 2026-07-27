"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  sendWithdrawalPendingEmail,
  sendWithdrawalApprovedEmail,
  sendWithdrawalRejectedEmail,
} from "@/app/actions/transactional-email";

// 1. USER ACTION: Request Withdrawal
interface RequestWithdrawalInput {
  userId: string;
  amount: number;
  currency: string;
  destination: string;
}

export async function requestWithdrawalAction({
  userId,
  amount,
  currency,
  destination,
}: RequestWithdrawalInput) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      return { success: false, error: "User account not found." };
    }

    if (user.balance < amount) {
      return { success: false, error: "Insufficient account balance." };
    }

    const transaction = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      return await tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAWAL",
          amount,
          currency,
          status: "PENDING",
          description: destination,
        },
      });
    });

    await sendWithdrawalPendingEmail({
      email: user.email,
      name: user.name || user.firstName || "User",
      amount,
      currency,
      destination,
    });

    revalidatePath("/dashboard");
    revalidatePath("/withdraw");

    return { success: true, data: transaction };
  } catch (error) {
    console.error("Error submitting withdrawal request:", error);
    return { success: false, error: "Failed to submit withdrawal request." };
  }
}

// 2. ADMIN ACTION: Approve Withdrawal
export async function approveWithdrawalAction(withdrawalId: string) {
  try {
    const withdrawal = await db.transaction.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!withdrawal || !withdrawal.user?.email) {
      return { success: false, error: "Withdrawal request or user email not found." };
    }

    if (withdrawal.status !== "PENDING") {
      return { success: false, error: "This request has already been processed." };
    }

    const updatedWithdrawal = await db.transaction.update({
      where: { id: withdrawalId },
      data: { status: "COMPLETED" },
    });

    await sendWithdrawalApprovedEmail({
      email: withdrawal.user.email,
      name: withdrawal.user.name || withdrawal.user.firstName || "User",
      amount: withdrawal.amount,
      currency: withdrawal.currency || "USD",
      destination: withdrawal.description || "External Wallet / Bank Account",
    });

    revalidatePath("/admin/withdrawals");
    return { success: true, data: updatedWithdrawal };
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    return { success: false, error: "Failed to approve withdrawal." };
  }
}

// 3. ADMIN ACTION: Reject Withdrawal
export async function rejectWithdrawalAction(
  withdrawalId: string,
  reason?: string
) {
  try {
    const withdrawal = await db.transaction.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!withdrawal || !withdrawal.user?.email) {
      return { success: false, error: "Withdrawal request or user email not found." };
    }

    if (withdrawal.status !== "PENDING") {
      return { success: false, error: "This request has already been processed." };
    }

    await db.$transaction([
      db.user.update({
        where: { id: withdrawal.userId },
        data: { balance: { increment: withdrawal.amount } },
      }),
      db.transaction.update({
        where: { id: withdrawalId },
        data: {
          status: "REJECTED",
          description: reason ? `Rejected: ${reason}` : withdrawal.description,
        },
      }),
    ]);

    await sendWithdrawalRejectedEmail({
      email: withdrawal.user.email,
      name: withdrawal.user.name || withdrawal.user.firstName || "User",
      amount: withdrawal.amount,
      currency: withdrawal.currency || "USD",
      reason: reason || "Compliance verification failure or invalid payout details.",
    });

    revalidatePath("/admin/withdrawals");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    return { success: false, error: "Failed to reject withdrawal." };
  }
}
