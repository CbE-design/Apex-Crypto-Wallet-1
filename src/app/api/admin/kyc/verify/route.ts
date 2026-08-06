/**
 * POST /api/admin/kyc/verify
 *
 * Runs automatic KYC verification using free open-source libraries:
 *   • Tesseract.js (naptha/tesseract.js on GitHub) — OCR text extraction from document images
 *   • face-api.js (vladmandic/face-api on GitHub) — face detection & descriptor comparison
 *
 * Admin-only. Returns a structured verification report.
 *
 * NOTE: Tesseract.js, canvas, and face-api are loaded dynamically inside the handler
 * so the rest of the app can build even when these heavy packages are not yet installed.
 * Install them with: npm install tesseract.js @vladmandic/face-api canvas
 */

import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebase-admin';

const ADMIN_EMAILS = ['admin@apexwallet.io', 'corrie@apex-crypto.co.uk'];

// Restrict remote image fetching to trusted hosts to prevent SSRF.
// Update this list to match your actual storage/CDN domains.
const ALLOWED_IMAGE_HOSTNAMES = new Set<string>([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

function assertSafeExternalImageUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid image URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http/https image URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject obvious local/private targets.
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  ) {
    throw new Error('Disallowed image host');
  }

  if (!ALLOWED_IMAGE_HOSTNAMES.has(hostname)) {
    throw new Error('Image host is not allowed');
  }
}

async function verifyAdminToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return false;
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    return ADMIN_EMAILS.includes(decoded.email || '');
  } catch {
    return false;
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  // Handle base64 data URLs (images stored directly in Firestore)
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    if (!base64) throw new Error('Invalid data URL');
    return Buffer.from(base64, 'base64');
  }

  // Handle HTTP URLs (legacy storage or external URLs) with SSRF protections.
  assertSafeExternalImageUrl(url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractDateOfBirth(text: string): string | null {
  const dobPattern = /(\d{4})[-\/](\d{2})[-\/](\d{2})/;
  const match = text.match(dobPattern);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

let modelsLoaded = false;

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminToken(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { submissionId, documentImageUrl, selfieImageUrl, fullName, dateOfBirth, documentNumber } = body;

    if (!documentImageUrl || !selfieImageUrl) {
      return NextResponse.json({ error: 'documentImageUrl and selfieImageUrl are required' }, { status: 400 });
    }

    // Dynamic imports so the app can build without these heavy packages installed.
    const [{ createCanvas, loadImage }, Tesseract, faceapi] = await Promise.all([
      import('canvas'),
      import('tesseract.js'),
      import('@vladmandic/face-api'),
    ]);

    // Load face-api models (first call ~2-5 s)
    if (!modelsLoaded) {
      const path = (await import('path')).default;
      const modelPath = path.join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model');
      await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
      modelsLoaded = true;
    }

    // ── OCR ──────────────────────────────────────────────────────────────────────────────────────────
    const ocrResult = await Tesseract.recognize(documentImageUrl, 'eng', {
      logger: () => {},
    });
    const rawOcrText = ocrResult.data.text;
    const ocrConfidence = ocrResult.data.confidence;

    const extractedFullName = rawOcrText.slice(0, 80).replace(/\n/g, ' ').trim();
    const extractedDocumentNumber = rawOcrText.match(/[A-Z0-9]{6,20}/i)?.[0] || '';
    const extractedDob = extractDateOfBirth(rawOcrText) || '';

    // ── Face matching ─────────────────────────────────────────────────────────────────────────────────────────────
    const docBuffer = await fetchImageBuffer(documentImageUrl);
    const selfieBuffer = await fetchImageBuffer(selfieImageUrl);

    const docImg = await loadImage(docBuffer);
    const selfieImg = await loadImage(selfieBuffer);

    const docCanvas = createCanvas(docImg.width, docImg.height);
    const selfieCanvas = createCanvas(selfieImg.width, selfieImg.height);
    (docCanvas.getContext('2d') as any).drawImage(docImg as any, 0, 0);
    (selfieCanvas.getContext('2d') as any).drawImage(selfieImg as any, 0, 0);

    const docDetection = await faceapi
      .detectSingleFace(docCanvas as any, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    const selfieDetection = await faceapi
      .detectSingleFace(selfieCanvas as any, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    let faceMatchScore = 0;
    if (docDetection && selfieDetection) {
      const distance = faceapi.euclideanDistance(docDetection.descriptor, selfieDetection.descriptor);
      faceMatchScore = Math.max(0, 1 - distance);
    }

    // ── Field comparison ────────────────────────────────────────────────────────────────────────────────────────────────
    const nameMatch = normalizeName(fullName || '').includes(normalizeName(extractedFullName).slice(0, 20)) ||
                      normalizeName(extractedFullName).includes(normalizeName(fullName || '').slice(0, 20));
    const idMatch = normalizeName(documentNumber || '') === normalizeName(extractedDocumentNumber);
    const dobMatch = !!(dateOfBirth && extractedDob && extractedDob === dateOfBirth);

    const matchWeights = (nameMatch ? 0.3 : 0) + (idMatch ? 0.35 : 0) + (dobMatch ? 0.35 : 0);
    const overallConfidence = (ocrConfidence / 100) * 0.4 + faceMatchScore * 0.3 + matchWeights * 0.3;

    let recommendation: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT' = 'MANUAL_REVIEW';
    if (overallConfidence > 0.85 && faceMatchScore > 0.55 && nameMatch && idMatch) {
      recommendation = 'AUTO_APPROVE';
    } else if (overallConfidence < 0.4 || faceMatchScore < 0.2) {
      recommendation = 'REJECT';
    }

    const report = {
      success: true,
      ocrConfidence,
      extractedFields: {
        fullName: extractedFullName,
        documentNumber: extractedDocumentNumber,
        dateOfBirth: extractedDob,
      },
      fieldMatches: { nameMatch, idMatch, dobMatch },
      faceMatchScore: Math.round(faceMatchScore * 100) / 100,
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      recommendation,
      rawOcrText: rawOcrText.slice(0, 2000),
      docFaceDetected: !!docDetection,
      selfieFaceDetected: !!selfieDetection,
    };

    // Persist to Firestore
    const db = firebaseAdmin.firestore();
    const FieldValue = firebaseAdmin.firestore.FieldValue;
    await db.collection('kyc_submissions').doc(submissionId).update({
      autoVerification: {
        runAt: FieldValue.serverTimestamp(),
        ...report,
      },
    });

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[kyc-verify] error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 },
    );
  }
}
