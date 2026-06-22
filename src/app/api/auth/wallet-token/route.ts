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
      console.error('[wallet-token] Admin SDK not initialized. Check FIREBASE_ADMIN_SDK_CONFIG.');
      return NextResponse.json(
        { error: 'Wallet verification service is starting up. Please try again in a moment.' },
        { status: 503 },
      );
    }

    const addressLower = walletAddress.toLowerCase();
    let uid: string | null = null;
    let isReturningUser = false;

    // Look up whether this wallet address already belongs to an existing user.
    // Try both field names for maximum compatibility with older user records.
    const snap = await db
      .collection('users')
      .where('walletAddressLowercase', '==', addressLower)
      .limit(1)
      .get();

    if (!snap.empty) {
      uid = snap.docs[0].id;
      isReturningUser = true;
    } else {
      // Fallback: Check the original camelCase field
      const fallbackSnap = await db
        .collection('users')
        .where('walletAddress', '==', walletAddress)
        .limit(1)
        .get();
      
      if (!fallbackSnap.empty) {
        uid = fallbackSnap.docs[0].id;
        isReturningUser = true;
      }
    }

    if (!uid) {
      // New wallet — create a deterministic UID from the address.
      // This ensures that even if they import on a different device before 
      // a doc is created, they get the same ID.
      uid = `w_${addressLower.replace('0x', '').slice(0, 40)}`;
    }

    console.log(`[wallet-token] UID resolved: ${uid} (Returning: ${isReturningUser})`);

    // Issue a short-lived Firebase custom auth token for this UID.
    const token = await firebaseAdmin.auth().createCustomToken(uid);

    return NextResponse.json({ token, isReturningUser, uid });
  } catch (error: any) {
    console.error('[wallet-token] Error:', error);
    return NextResponse.json({ error: 'System busy. Please try again shortly.' }, { status: 500 });
  }
}
