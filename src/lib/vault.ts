'use client';

export const VAULT_VERSION = 1;
export const VAULT_PREFIX   = 'apex-vault-';
export const SESSION_PREFIX = 'apex-session-';
export const PASSKEY_PREFIX = 'apex-passkey-';
export const VAULT_HINT_PREFIX = 'apex-hint-';

// ── helpers ─────────────────────────────────────────────────────────────
function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// ── key derivation ───────────────────────────────────────────────────────
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── vault types ──────────────────────────────────────────────────────────
export interface Vault {
  v: number;
  salt: string;
  iv: string;
  ct: string;
  addressHint: string;
}

export interface VaultHint {
  addressHint: string;
  hasPasskey: boolean;
}

// ── encrypt ──────────────────────────────────────────────────────────────
export async function encryptVault(data: object, pin: string): Promise<Vault> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(pin, salt);
  const ct   = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  const address = (data as any).address ?? '';
  const addressHint = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';
  return { v: VAULT_VERSION, salt: toHex(salt), iv: toHex(iv), ct: toHex(ct), addressHint };
}

// ── decrypt ──────────────────────────────────────────────────────────────
export async function decryptVault(vault: Vault, pin: string): Promise<object> {
  const salt = fromHex(vault.salt);
  const iv   = fromHex(vault.iv);
  const ct   = fromHex(vault.ct);
  const key  = await deriveKey(pin, salt);
  const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// ── passkey-wrap helpers (credential ID used as key material) ────────────
export async function encryptWithCredId(data: string, credId: string, salt: Uint8Array): Promise<{ iv: string; ct: string }> {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(credId, salt);
  const ct  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data),
  );
  return { iv: toHex(iv), ct: toHex(ct) };
}

export async function decryptWithCredId(
  payload: { iv: string; ct: string; salt: string },
  credId: string,
): Promise<string> {
  const salt = fromHex(payload.salt);
  const iv   = fromHex(payload.iv);
  const ct   = fromHex(payload.ct);
  const key  = await deriveKey(credId, salt);
  const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}
