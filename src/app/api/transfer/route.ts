import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, firebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendTransactionalEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate the caller ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const idToken = authHeader.replace('Bearer ', '').trim();
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken: { uid: string };
    try {
      decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const senderUid = decodedToken.uid;

    // ── Parse body ───────────────────────────────────────────────────────────
    const { recipientAddress, asset, amount, complianceId, travelRuleVerified } = await req.json();

    if (!recipientAddress || !asset || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // ── Look up recipient by wallet address ──────────────────────────────────
    const usersSnap = await db.collection('users')
      .where('walletAddressLowercase', '==', recipientAddress.toLowerCase())
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json(
        { error: 'Recipient address not found. Please check the address and try again.' },
        { status: 404 }
      );
    }

    const recipientUid = usersSnap.docs[0].id;

    if (recipientUid === senderUid) {
      return NextResponse.json(
        { error: 'You cannot send to your own address.' },
        { status: 400 }
      );
    }

    // ── Atomic transaction (Admin SDK — bypasses Firestore rules) ────────────
    const senderWalletRef   = db.doc(`users/${senderUid}/wallets/${asset}`);
    const recipientWalletRef = db.doc(`users/${recipientUid}/wallets/${asset}`);

    let senderEmail: string | undefined;
    let recipientEmail: string | undefined;

    await db.runTransaction(async (tx) => {
      const senderWalletDoc = await tx.get(senderWalletRef);

      if (!senderWalletDoc.exists || (senderWalletDoc.data()?.balance ?? 0) < amount) {
        throw new Error('Insufficient balance.');
      }

      const recipientWalletDoc = await tx.get(recipientWalletRef);
      const recipientCurrentBalance = recipientWalletDoc.exists
        ? (recipientWalletDoc.data()?.balance ?? 0)
        : 0;

      // Debit sender
      tx.update(senderWalletRef, { balance: senderWalletDoc.data()!.balance - amount });

      // Credit recipient
      tx.set(recipientWalletRef, {
        balance: recipientCurrentBalance + amount,
        currency: asset,
        id: asset,
        userId: recipientUid,
      }, { merge: true });

      const baseFields = {
        currency: asset,
        amount,
        price: 0,
        timestamp: FieldValue.serverTimestamp(),
        status: 'Completed',
        metadata: {
          travelRuleVerified: travelRuleVerified ?? false,
          complianceId: complianceId || 'AUTO_KYC_OK',
        },
      };

      // Sender records — type 'Send' so dashboard shows as outgoing (-)
      const senderTxData = { ...baseFields, type: 'Send', userId: senderUid, recipient: recipientAddress };
      const senderWalletTxRef = db.collection(`users/${senderUid}/wallets/${asset}/transactions`).doc();
      tx.set(senderWalletTxRef, senderTxData);
      const senderDashTxRef = db.collection(`users/${senderUid}/transactions`).doc();
      tx.set(senderDashTxRef, senderTxData);

      // Recipient records — type 'Internal Transfer' so dashboard shows as incoming (+)
      const recipientTxData = { ...baseFields, type: 'Internal Transfer', userId: recipientUid, sender: senderUid, recipient: recipientAddress };
      const recipientWalletTxRef = db.collection(`users/${recipientUid}/wallets/${asset}/transactions`).doc();
      tx.set(recipientWalletTxRef, recipientTxData);
      const recipientDashTxRef = db.collection(`users/${recipientUid}/transactions`).doc();
      tx.set(recipientDashTxRef, recipientTxData);
    });

    // Fetch emails and send transfer notifications (best-effort).
    try {
      const [senderDoc, recipientDoc] = await Promise.all([
        db.collection('users').doc(senderUid).get(),
        db.collection('users').doc(recipientUid).get(),
      ]);
      senderEmail = senderDoc.data()?.email as string | undefined;
      recipientEmail = recipientDoc.data()?.email as string | undefined;

      if (senderEmail && senderEmail.includes('@') && !senderEmail.endsWith('@apex.io')) {
        await sendTransactionalEmail({
          to: senderEmail,
          subject: `Transfer Sent: ${amount} ${asset}`,
          html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>Transfer Sent</title></head>
<body style="margin:0;padding:0;background:#0A0C12;color:#E5E7EB;font-family:sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#11131A;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:28px;">
      <div style="font-size:22px;font-weight:700;color:#22D3EE;margin-bottom:24px;">Apex Wallet</div>
      <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 16px;">Transfer Sent</h1>
      <p style="font-size:15px;line-height:1.6;color:#9CA3AF;">You have sent crypto from your wallet.</p>
      <div style="background:rgba(34,211,238,0.08);border-left:3px solid #22D3EE;padding:12px 16px;border-radius:8px;margin:16px 0;">
        Amount: <strong>${amount} ${asset}</strong><br />
        To: <code>${recipientAddress}</code>
      </div>
    </div>
  </div>
</body></html>`,
        });
      }

      if (recipientEmail && recipientEmail.includes('@') && !recipientEmail.endsWith('@apex.io')) {
        await sendTransactionalEmail({
          to: recipientEmail,
          subject: `You Received ${amount} ${asset}`,
          html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>Incoming Transfer</title></head>
<body style="margin:0;padding:0;background:#0A0C12;color:#E5E7EB;font-family:sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#11131A;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:28px;">
      <div style="font-size:22px;font-weight:700;color:#22D3EE;margin-bottom:24px;">Apex Wallet</div>
      <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 16px;">Incoming Transfer</h1>
      <p style="font-size:15px;line-height:1.6;color:#9CA3AF;">You have received crypto in your wallet.</p>
      <div style="background:rgba(34,211,238,0.08);border-left:3px solid #22D3EE;padding:12px 16px;border-radius:8px;margin:16px 0;">
        Amount: <strong>${amount} ${asset}</strong><br />
        From: <code>${recipientAddress}</code>
      </div>
    </div>
  </div>
</body></html>`,
        });
      }
    } catch (emailErr) {
      console.error('[/api/transfer] Transfer email notification failed:', emailErr);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    console.error('[/api/transfer]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
