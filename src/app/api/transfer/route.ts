import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, firebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

      const txData = {
        type: 'Internal Transfer',
        currency: asset,
        amount,
        price: 0,
        timestamp: FieldValue.serverTimestamp(),
        status: 'Completed',
        recipient: recipientAddress,
        metadata: {
          travelRuleVerified: travelRuleVerified ?? false,
          complianceId: complianceId || 'AUTO_KYC_OK',
        },
      };

      // Sender wallet-level transaction record
      const senderWalletTxRef = db.collection(`users/${senderUid}/wallets/${asset}/transactions`).doc();
      tx.set(senderWalletTxRef, { ...txData, userId: senderUid });

      // Sender top-level transaction record (for dashboard)
      const senderDashTxRef = db.collection(`users/${senderUid}/transactions`).doc();
      tx.set(senderDashTxRef, { ...txData, userId: senderUid });

      // Recipient wallet-level transaction record
      const recipientWalletTxRef = db.collection(`users/${recipientUid}/wallets/${asset}/transactions`).doc();
      tx.set(recipientWalletTxRef, { ...txData, userId: recipientUid, sender: senderUid });

      // Recipient top-level transaction record (for dashboard)
      const recipientDashTxRef = db.collection(`users/${recipientUid}/transactions`).doc();
      tx.set(recipientDashTxRef, { ...txData, userId: recipientUid, sender: senderUid });
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    console.error('[/api/transfer]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
