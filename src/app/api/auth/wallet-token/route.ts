import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, firebaseAdmin } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK is not configured. Please set FIREBASE_ADMIN_SDK_CONFIG.' },
        { status: 503 },
      );
    }

    const addressLower = walletAddress.toLowerCase();
    let uid: string;
    let isReturningUser = false;

    // Look up whether this wallet address already belongs to an existing user.
    // This guarantees the same seed phrase always resolves to the same Firebase UID,
    // so KYC status, balances, and all history are automatically preserved.
    const snap = await db
      .collection('users')
      .where('walletAddressLowercase', '==', addressLower)
      .limit(1)
      .get();

    if (!snap.empty) {
      uid = snap.docs[0].id;
      isReturningUser = true;
      console.log("Found existing user! ID:", uid);
    } else {
      // New wallet — create a deterministic UID from the address so future imports
      // of the same wallet always get the same UID, even before a doc exists.
      uid = `w_${addressLower.replace('0x', '').slice(0, 40)}`;
    }

    // Issue a short-lived Firebase custom auth token for this UID.
    const token = await firebaseAdmin.auth().createCustomToken(uid);

    return NextResponse.json({ token, isReturningUser, uid });
  } catch (error: any) {
    console.error('[wallet-token] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
