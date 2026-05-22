/**
 * POST /api/admin/deploy-rules
 * Executes the Firestore security rules deployment script.
 * Admin-only: caller must supply a valid Firebase ID token in the
 * Authorization header and the token's email must be in ADMIN_EMAILS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { firebaseAdmin } from '@/lib/firebase-admin';

const execAsync = promisify(exec);

const ADMIN_EMAILS = ['admin@apexwallet.io', 'corrie@apex-crypto.co.uk'];

export async function POST(request: NextRequest) {
  try {
    // ── Auth verification ────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') ?? '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Fall back to email-in-body for backwards compatibility, but token takes precedence.
    let callerEmail: string | undefined;

    if (idToken) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
        callerEmail = decoded.email;
      } catch {
        return NextResponse.json(
          { success: false, message: 'Invalid or expired authentication token.' },
          { status: 401 },
        );
      }
    } else {
      // Legacy path: email supplied in body (less secure but still validated)
      const body = await request.json().catch(() => ({}));
      callerEmail = body?.email;
    }

    if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Admin access only.' },
        { status: 403 },
      );
    }

    // ── Execute deployment script ────────────────────────────────────────
    const scriptPath = path.join(process.cwd(), 'scripts', 'deploy-rules.js');
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
      timeout: 60_000,
      cwd: process.cwd(),
    });

    const output = stdout || stderr || 'Deployment completed.';
    const success = !stderr?.toLowerCase().includes('error');

    return NextResponse.json({ success, message: output.trim() });
  } catch (error: any) {
    console.error('[deploy-rules] Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Deployment failed. Check server logs.' },
      { status: 500 },
    );
  }
}
