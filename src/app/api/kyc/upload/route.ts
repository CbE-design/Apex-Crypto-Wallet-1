import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      userEmail,
      walletAddress,
      fullName,
      dateOfBirth,
      nationality,
      countryCode,
      address,
      documentType,
      documentNumber,
      documentExpiry,
      documentBase64,
      selfieBase64,
      documentFileName,
      selfieFileName,
      withdrawalIntent,
    } = body;

    if (!userId || !documentBase64 || !selfieBase64) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Server database unavailable' },
        { status: 503 }
      );
    }

    const timestamp = Date.now();
    const submissionId = `kyc_${userId}_${timestamp}`;

    // Determine MIME type from extension
    const docExt = documentFileName?.split('.').pop()?.toLowerCase() || 'jpg';
    const selfieExt = selfieFileName?.split('.').pop()?.toLowerCase() || 'jpg';
    const docMime = docExt === 'png' ? 'image/png' : 'image/jpeg';
    const selfieMime = selfieExt === 'png' ? 'image/png' : 'image/jpeg';

    // Store images as base64 data URLs directly in Firestore
    const docUrl = `data:${docMime};base64,${documentBase64}`;
    const selfieUrl = `data:${selfieMime};base64,${selfieBase64}`;

    // Build submission
    const kycSubmission: Record<string, any> = {
      id: submissionId,
      userId,
      userEmail: userEmail || 'unknown@apex.io',
      walletAddress: walletAddress || '',
      status: 'PENDING',
      fullName,
      dateOfBirth,
      nationality,
      countryCode: countryCode || 'ZA',
      address,
      documentType,
      documentNumber,
      documentExpiry: documentExpiry || 'N/A',
      documentImageUrl: docUrl,
      selfieImageUrl: selfieUrl,
      submittedAt: FieldValue.serverTimestamp(),
    };

    if (withdrawalIntent) {
      kycSubmission.withdrawalIntent = withdrawalIntent;
    }

    // Save to Firestore
    await db.collection('kyc_submissions').doc(submissionId).set(kycSubmission);

    // Update user
    await db.collection('users').doc(userId).set(
      {
        kycStatus: 'PENDING',
        kycSubmissionId: submissionId,
        kycSubmittedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Create admin notification
    await db.collection('admin_notifications').add({
      type: 'KYC_VERIFICATION',
      title: withdrawalIntent ? 'Urgent: KYC for Withdrawal' : 'New KYC Submission',
      message: `${fullName} has submitted KYC documents for manual review.`,
      userId,
      userEmail: userEmail || 'unknown@apex.io',
      referenceId: submissionId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, submissionId });
  } catch (err: any) {
    console.error('[api/kyc/upload] Error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'KYC submission failed' },
      { status: 500 }
    );
  }
}
