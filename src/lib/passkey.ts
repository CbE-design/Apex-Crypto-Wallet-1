'use client';

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

function toBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Register a new platform passkey.
 * Returns the base64url-encoded credential ID.
 */
export async function registerPasskey(uid: string, addressHint: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId    = new TextEncoder().encode(uid);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Apex Wallet',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: addressHint,
        displayName: 'Apex Wallet',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 },  // RS256 fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        userVerification: 'required',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey registration cancelled');
  return toBase64url(credential.rawId);
}

/**
 * Authenticate with an existing passkey.
 * Returns the credential ID on success, throws on failure/cancel.
 */
export async function authenticatePasskey(credentialId: string): Promise<string> {
  const challenge  = crypto.getRandomValues(new Uint8Array(32));
  const credIdBytes = fromBase64url(credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: credIdBytes }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey authentication cancelled');
  return toBase64url(assertion.rawId);
}
