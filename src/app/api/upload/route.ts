import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileBase64, filePath, fileType } = body;

    if (!fileBase64 || !filePath) {
      return NextResponse.json(
        { error: 'Missing fileBase64 or filePath' },
        { status: 400 }
      );
    }

    const storage = getAdminStorage();
    if (!storage) {
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 }
      );
    }

    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    const buffer = Buffer.from(fileBase64, 'base64');

    await file.save(buffer, {
      metadata: {
        contentType: fileType || 'application/octet-stream',
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error('[api/upload] Error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
