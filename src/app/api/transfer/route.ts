import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendTransferReceivedEmail } from "@/app/actions/transactional-email";

/**
 * POST /api/transfer
 *
 * Apex-to-Apex internal transfer. Moves a crypto balance from the authenticated
 * sender to another Apex user identified by their wallet address (or email).
 *
 * Auth: `Authorization: Bearer <Firebase ID token>` — the sender is derived from
 * the verified token, never trusted from the request body.
 *
 * Body: { recipientAddress: string, asset: string, amount: number,
 *         complianceId?: string, travelRuleVerified?: boolean, note?: string }
 *
 * Balances live in the `users/{uid}/wallets/{SYMBOL}` subcollection (same path the
 * dashboard, wallets page and admin credit flow all read/write).
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate the sender from the Firebase ID token ──────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated. Please reconnect your wallet." },
        { status: 401 }
      );
    }

    let senderId: string;
    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
      senderId = decoded.uid;
    } catch {
      return NextResponse.json(
        { success: false, error: "Your session has expired. Please reconnect your wallet." },
        { status: 401 }
      );
    }

    // ── 2. Parse & validate the request body ───────────────────────────────
    const body = await req.json().catch(() => ({}));
    const {
      recipientAddress,
      asset,
      amount,
      complianceId,
      travelRuleVerified,
      note,
    } = body as {
      recipientAddress?: string;
      asset?: string;
      amount?: number | string;
      complianceId?: string;
      travelRuleVerified?: boolean;
      note?: string;
    };

    const currency = (asset || "").toString().trim().toUpperCase();
    const numericAmount = Number(amount);
    const cleanRecipient = (recipientAddress || "").toString().trim();

    if (!cleanRecipient || !currency || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid transfer request parameters." },
        { status: 400 }
      );
    }

    const db = getDb();

    // ── 3. Resolve the sender & recipient user documents ───────────────────
    const senderRef = db.collection("users").doc(senderId);
    const senderSnap = await senderRef.get();
    if (!senderSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Sender account not found." },
        { status: 404 }
      );
    }
    const senderData = senderSnap.data() || {};

    const recipientRef = await resolveRecipientRef(db, cleanRecipient);
    if (!recipientRef) {
      return NextResponse.json(
        { success: false, error: "No Apex user found for that recipient address." },
        { status: 404 }
      );
    }

    if (recipientRef.id === senderId) {
      return NextResponse.json(
        { success: false, error: "You cannot transfer funds to yourself." },
        { status: 400 }
      );
    }

    const recipientSnap = await recipientRef.get();
    const recipientData = recipientSnap.data() || {};

    // Wallet subcollection refs — this is where balances actually live.
    const senderWalletRef = senderRef.collection("wallets").doc(currency);
    const recipientWalletRef = recipientRef.collection("wallets").doc(currency);

    // ── 4. Atomic balance move + transaction records ───────────────────────
    await db.runTransaction(async (transaction) => {
      const senderWalletSnap = await transaction.get(senderWalletRef);
      const recipientWalletSnap = await transaction.get(recipientWalletRef);

      const senderBalance = Number(senderWalletSnap.data()?.balance ?? 0);
      if (!senderWalletSnap.exists || senderBalance < numericAmount) {
        throw new Error("Insufficient balance");
      }

      const recipientBalance = Number(recipientWalletSnap.data()?.balance ?? 0);

      // Debit sender.
      transaction.update(senderWalletRef, {
        balance: senderBalance - numericAmount,
        lastSynced: FieldValue.serverTimestamp(),
      });

      // Credit recipient (create the wallet doc if it doesn't exist yet).
      transaction.set(
        recipientWalletRef,
        {
          id: currency,
          userId: recipientRef.id,
          currency,
          balance: recipientBalance + numericAmount,
          lastSynced: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const senderEmail = senderData.email || senderData.walletAddress || "You";
      const recipientEmail =
        recipientData.email || recipientData.walletAddress || cleanRecipient;

      const metadata = {
        travelRuleVerified: !!travelRuleVerified,
        complianceId: complianceId || `TRANSFER_${Date.now()}`,
        protocol: "APEX_INTERNAL_TRANSFER",
      };

      // Sender ledger entry (debit — "sent" is detected as a debit in history).
      const senderTxRef = senderRef.collection("transactions").doc();
      transaction.set(senderTxRef, {
        type: "Transfer Sent",
        currency,
        amount: numericAmount,
        price: 0,
        status: "Completed",
        timestamp: FieldValue.serverTimestamp(),
        sender: senderEmail,
        recipient: recipientEmail,
        description: `Sent to ${recipientEmail}${note ? ` — ${note}` : ""}`,
        notes: note || "Apex internal transfer",
        metadata,
      });

      // Recipient ledger entry (credit — "Internal Transfer" triggers the
      // real-time "Deposit Received" toast via use-transaction-listener).
      const recipientTxRef = recipientRef.collection("transactions").doc();
      transaction.set(recipientTxRef, {
        type: "Internal Transfer",
        currency,
        amount: numericAmount,
        price: 0,
        status: "Completed",
        timestamp: FieldValue.serverTimestamp(),
        sender: senderEmail,
        recipient: recipientEmail,
        description: `Received from ${senderEmail}${note ? ` — ${note}` : ""}`,
        notes: note || "Apex internal transfer",
        metadata,
      });
    });

    // ── 5. Fire recipient notification email (best-effort) ─────────────────
    (async () => {
      try {
        if (!recipientData.email) return;
        const senderDisplayName =
          senderData.name ||
          senderData.firstName ||
          senderData.email ||
          "An Apex user";
        await sendTransferReceivedEmail({
          to: recipientData.email,
          userName: recipientData.name || recipientData.firstName || "User",
          senderName: senderDisplayName,
          amount: numericAmount,
          assetType: currency,
        });
      } catch (emailErr) {
        console.error("[transfer] Failed to send transfer-received email:", emailErr);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "Insufficient balance") {
      return NextResponse.json(
        { success: false, error: "Insufficient balance for this transfer." },
        { status: 400 }
      );
    }
    console.error("[transfer] API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * Resolve a recipient user document from a shared wallet address or email.
 * The receive screen shares the top-level ETH wallet address, so we match on
 * `walletAddressLowercase` first, then `walletAddress`, then email.
 */
async function resolveRecipientRef(
  db: FirebaseFirestore.Firestore,
  identifier: string
): Promise<FirebaseFirestore.DocumentReference | null> {
  const lower = identifier.toLowerCase();

  const byLower = await db
    .collection("users")
    .where("walletAddressLowercase", "==", lower)
    .limit(1)
    .get();
  if (!byLower.empty) return byLower.docs[0].ref;

  const byAddress = await db
    .collection("users")
    .where("walletAddress", "==", identifier)
    .limit(1)
    .get();
  if (!byAddress.empty) return byAddress.docs[0].ref;

  if (identifier.includes("@")) {
    const byEmail = await db
      .collection("users")
      .where("email", "==", lower)
      .limit(1)
      .get();
    if (!byEmail.empty) return byEmail.docs[0].ref;
  }

  return null;
}
