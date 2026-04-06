/**
 * POST /api/admin/deploy-rules
 * Executes the Firestore security rules deployment script.
 * Admin-only: caller must be authenticated with an admin email.
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const ADMIN_EMAILS = ['admin@apexwallet.io', 'corrie@apex-crypto.co.uk'];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const callerEmail: string | undefined = body?.email;

    if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Admin access only.' },
        { status: 403 }
      );
    }

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
      {
        success: false,
        message: error?.message || 'Deployment failed. Check server logs.',
      },
      { status: 500 }
    );
  }
}
