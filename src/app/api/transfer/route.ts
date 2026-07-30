import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendTransferReceivedEmail } from "@/app/actions/transactional-email";
import { anchorTransfer } from "@/lib/ledger";

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
    const senderRef = getDb().collection("users").doc(senderId);

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
    const recipientQuery = await getDb()
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

    // Pre-create transaction record refs so we can reference their ids after
    // the commit (e.g. to store the on-chain anchor hash).
    const txsCollection = getDb().collection("transactions");
    const senderTxRef = txsCollection.doc();
    const recipientTxRef = txsCollection.doc();
    const recipientId = recipientRef.id;

    // 2. Perform Firestore transaction for atomic update + create transaction records
    await getDb().runTransaction(async (transaction) => {
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

      // Calculate flat balance updates
      const senderBalance = Number(sender.balance || 0);
      const recipientBalance = Number(recipient.balance || 0);

      // Calculate currency-specific wallet updates
      const senderWallets = sender.wallets || {};
      const recipientWallets = recipient.wallets || {};
      const senderCurrencyBal = Number(senderWallets[currency] ?? senderBalance);
      const recipientCurrencyBal = Number(recipientWallets[currency] ?? recipientBalance);

      if (senderBalance < numericAmount && senderCurrencyBal < numericAmount) {
        throw new Error("Insufficient balance");
      }

      // Prepare updates for both flat balance and nested wallets object
      const senderUpdates: Record<string, any> = {
        balance: senderBalance - numericAmount,
        [`wallets.${currency}`]: senderCurrencyBal - numericAmount,
      };

      const recipientUpdates: Record<string, any> = {
        balance: recipientBalance + numericAmount,
        [`wallets.${currency}`]: recipientCurrencyBal + numericAmount,
      };

      transaction.update(senderRef, senderUpdates);
      transaction.update(recipientRef, recipientUpdates);

      // Create transaction records (refs pre-created above)
      transaction.set(senderTxRef, {
        userId: senderId,
        type: "TRANSFER_SENT",
        amount: numericAmount,
        currency,
        status: "COMPLETED",
        description: `Sent to ${recipient.email || cleanRecipientEmail}${note ? ` - Note: ${note}` : ""}`,
        createdAt: new Date().toISOString(),
        ledgerStatus: "PENDING_ANCHOR",
      });

      transaction.set(recipientTxRef, {
        userId: recipientRef.id,
        type: "TRANSFER_RECEIVED",
        amount: numericAmount,
        currency,
        status: "COMPLETED",
        description: `Received from ${sender.email || senderEmail}${note ? ` - Note: ${note}` : ""}`,
        createdAt: new Date().toISOString(),
        ledgerStatus: "PENDING_ANCHOR",
      });
    });

    // 2b. Anchor the transfer onto the private ledger (best-effort). Firestore
    // is the source of truth, so an anchoring failure never blocks the transfer.
    try {
      const anchor = await anchorTransfer({
        senderId,
        recipientId,
        amount: numericAmount,
        currency,
        note,
      });

      const ledgerUpdate = anchor
        ? {
            ledgerStatus: "ANCHORED",
            onChainTxHash: anchor.txHash,
            onChainBlockNumber: anchor.blockNumber,
            onChainId: anchor.chainId,
            ledgerAddressFrom: anchor.ledgerAddressFrom,
            ledgerAddressTo: anchor.ledgerAddressTo,
          }
        : { ledgerStatus: "NOT_ANCHORED" };

      await Promise.all([
        senderTxRef.update(ledgerUpdate),
        recipientTxRef.update(ledgerUpdate),
      ]);
    } catch (anchorErr) {
      console.log("[v0][ledger] Post-commit anchor update failed:", anchorErr);
    }

    // 3. Send notification email to recipient
    (async () => {
      try {
        const recipientData = recipientDocSnapshot.data() || {};
        const senderDisplayName = senderData.name || senderData.firstName || senderEmail || "A user";

        await sendTransferReceivedEmail({
          to: recipientData.email,
          userName: recipientData.name || recipientData.firstName || "User",
          senderName: senderDisplayName,
          amount: numericAmount,
        });
      } catch (emailErr) {
        console.error("Failed to send transfer received email:", emailErr);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Transfer API error:", error);
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
