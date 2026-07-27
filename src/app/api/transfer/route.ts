import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // Adjust import path to your database client
import { sendTransferReceivedEmail } from "@/app/actions/transactional-email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { senderId, recipientEmail, amount, currency = "USD", note } = body;

    // 1. Input Validation
    const numericAmount = parseFloat(amount);
    if (!senderId || !recipientEmail || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid transfer request parameters." },
        { status: 400 }
      );
    }

    // 2. Verify Sender
    const sender = await db.user.findUnique({
      where: { id: senderId },
    });

    if (!sender || sender.balance < numericAmount) {
      return NextResponse.json(
        { success: false, error: "Sender not found or insufficient balance." },
        { status: 400 }
      );
    }

    // 3. Verify Recipient
    const cleanRecipientEmail = recipientEmail.trim().toLowerCase();

    if (sender.email.toLowerCase() === cleanRecipientEmail) {
      return NextResponse.json(
        { success: false, error: "You cannot transfer funds to yourself." },
        { status: 400 }
      );
    }

    const recipient = await db.user.findUnique({
      where: { email: cleanRecipientEmail },
    });

    if (!recipient) {
      return NextResponse.json(
        { success: false, error: "Recipient user not found." },
        { status: 404 }
      );
    }

    // 4. Perform Atomic Database Transaction
    await db.$transaction(async (tx) => {
      // Deduct sender balance
      await tx.user.update({
        where: { id: sender.id },
        data: { balance: { decrement: numericAmount } },
      });

      // Credit recipient balance
      await tx.user.update({
        where: { id: recipient.id },
        data: { balance: { increment: numericAmount } },
      });

      // Record sender history
      await tx.transaction.create({
        data: {
          userId: sender.id,
          type: "TRANSFER_SENT",
          amount: numericAmount,
          currency,
          status: "COMPLETED",
          description: `Sent to ${recipient.email}${note ? ` - Note: ${note}` : ""}`,
        },
      });

      // Record recipient history
      await tx.transaction.create({
        data: {
          userId: recipient.id,
          type: "TRANSFER_RECEIVED",
          amount: numericAmount,
          currency,
          status: "COMPLETED",
          description: `Received from ${sender.email}${note ? ` - Note: ${note}` : ""}`,
        },
      });
    });

    // 5. Trigger Email Notification to Recipient
    const senderDisplayName =
      sender.name || sender.firstName || sender.email || "A user";

    await sendTransferReceivedEmail({
      email: recipient.email,
      name: recipient.name || recipient.firstName || "User",
      senderName: senderDisplayName,
      amount: numericAmount,
      currency,
      note,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Transfer API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
