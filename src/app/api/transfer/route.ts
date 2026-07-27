// src/app/api/transfer/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTransferReceivedEmail } from "@/app/actions/transactional-email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { senderId, recipientEmail, amount, currency = "USD", note } = body;

    // 1. Input Validation
    const numericAmount = Number(amount);
    if (!senderId || !recipientEmail || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid transfer request parameters." },
        { status: 400 }
      );
    }

    // Prepare refs
    const senderRef = db.collection("users").doc(senderId);

    // Read sender doc to get email (for self-transfer check)
    const senderDocSnapshot = await senderRef.get();
    if (!senderDocSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Sender not found." },
        { status: 404 }
      );
    }
    const senderData = senderDocSnapshot.data() || {};
    const senderEmail = (senderData.email || "").toString().toLowerCase();

    const cleanRecipientEmail = recipientEmail.toString().trim().toLowerCase();
    if (senderEmail && senderEmail === cleanRecipientEmail) {
      return NextResponse.json(
        { success: false, error: "You cannot transfer funds to yourself." },
        { status: 400 }
      );
    }

    // Find recipient by email
    const recipientQuery = await db
      .collection("users")
      .where("email", "==", cleanRecipientEmail)
      .limit(1)
      .get();

    if (recipientQuery.empty) {
      return NextResponse.json(
        { success: false, error: "Recipient user not found." },
        { status: 404 }
      );
    }

    const recipientDocSnapshot = recipientQuery.docs[0];
    const recipientRef = recipientDocSnapshot.ref;

    // 2. Perform Firestore transaction for atomic update + create transaction records
    await db.runTransaction(async (transaction) => {
      const senderSnapshot = await transaction.get(senderRef);
      const recipientSnapshot = await transaction.get(recipientRef);

      if (!senderSnapshot.exists) {
        throw new Error("Sender not found in transaction.");
      }
      if (!recipientSnapshot.exists) {
        throw new Error("Recipient not found in transaction.");
      }

      const sender = senderSnapshot.data() || {};
      const recipient = recipientSnapshot.data() || {};

      const senderBalance = Number(sender.balance || 0);
      const recipientBalance = Number(recipient.balance || 0);

      if (senderBalance < numericAmount) {
        // Throwing will abort the transaction and bubble out to the catch below
        throw new Error("Insufficient balance");
      }

      // Update balances
      transaction.update(senderRef, {
        balance: senderBalance - numericAmount,
      });

      transaction.update(recipientRef, {
        balance: recipientBalance + numericAmount,
      });

      // Create transaction records (use new doc refs)
      const txsCollection = db.collection("transactions");
      const senderTxRef = txsCollection.doc();
      const recipientTxRef = txsCollection.doc();

      transaction.set(senderTxRef, {
        userId: senderId,
        type: "TRANSFER_SENT",
        amount: numericAmount,
        currency,
        status: "COMPLETED",
        description: `Sent to ${recipient.email || cleanRecipientEmail}${
          note ? ` - Note: ${note}` : ""
        }`,
        createdAt: new Date().toISOString(),
      });

      transaction.set(recipientTxRef, {
        userId: recipientRef.id,
        type: "TRANSFER_RECEIVED",
        amount: numericAmount,
        currency,
        status: "COMPLETED",
        description: `Received from ${sender.email || senderEmail}${
          note ? ` - Note: ${note}` : ""
        }`,
        createdAt: new Date().toISOString(),
      });
    });

    // 3. Send notification email to recipient (do not make the transaction depend on email success)
    (async () => {
      try {
        // Use recipient snapshot from earlier query for name/email
        const recipientData = recipientDocSnapshot.data() || {};
        const senderDisplayName =
          senderData.name || senderData.firstName || senderEmail || "A user";

        await sendTransferReceivedEmail({
          email: recipientData.email,
          name: recipientData.name || recipientData.firstName || "User",
          senderName: senderDisplayName,
          amount: numericAmount,
          currency,
          note,
        });
      } catch (emailErr) {
        console.error("Failed to send transfer received email:", emailErr);
        // Consider enqueueing a retry job or setting a flag in DB for later processing
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Transfer API error:", error);

    // Map some known errors to 400
    if (error?.message === "Insufficient balance") {
      return NextResponse.json(
        { success: false, error: "Sender not found or insufficient balance." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
