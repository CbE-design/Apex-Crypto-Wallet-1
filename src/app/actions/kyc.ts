"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  sendKycApprovedEmail,
  sendKycRejectedEmail,
} from "@/app/actions/transactional-email";

export async function approveKycAction(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      return { success: false, error: "User not found or missing email address." };
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        kycStatus: "APPROVED",
        isKycVerified: true,
      },
    });

    await sendKycApprovedEmail({
      email: user.email,
      name: user.name || user.firstName || "User",
    });

    revalidatePath("/admin/kyc");
    return { success: true, data: updatedUser };
  } catch (error) {
    console.error("Error approving KYC:", error);
    return { success: false, error: "Failed to approve KYC application." };
  }
}

export async function rejectKycAction(userId: string, reason?: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      return { success: false, error: "User not found or missing email address." };
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        kycStatus: "REJECTED",
        isKycVerified: false,
      },
    });

    await sendKycRejectedEmail({
      email: user.email,
      name: user.name || user.firstName || "User",
      reason: reason || "Document verification failed.",
    });

    revalidatePath("/admin/kyc");
    return { success: true, data: updatedUser };
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    return { success: false, error: "Failed to reject KYC application." };
  }
}
