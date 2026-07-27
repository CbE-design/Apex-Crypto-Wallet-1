"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  sendKycApprovedEmail,
  sendKycRejectedEmail,
} from "@/app/actions/transactional-email";

export async function approveKycAction(userId: string) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { success: false, error: "User profile not found." };
    }

    await userRef.update({
      kycStatus: "APPROVED",
      isKycVerified: true,
    });

    const userData = userDoc.data();
    if (userData?.email) {
      await sendKycApprovedEmail({
        to: userData.email,
        userName: userData.name || userData.firstName || "User",
      });
    }

    revalidatePath("/admin/kyc");
    return { success: true };
  } catch (error) {
    console.error("Error approving KYC:", error);
    return { success: false, error: "Failed to approve KYC application." };
  }
}

export async function rejectKycAction(userId: string, reason?: string) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { success: false, error: "User profile not found." };
    }

    await userRef.update({
      kycStatus: "REJECTED",
      isKycVerified: false,
    });

    const userData = userDoc.data();
    if (userData?.email) {
      await sendKycRejectedEmail({
        to: userData.email,
        userName: userData.name || userData.firstName || "User",
        reason: reason || "Document verification failed.",
      });
    }

    revalidatePath("/admin/kyc");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    return { success: false, error: "Failed to reject KYC application." };
  }
}
