/**
 * End-to-End Encryption & Security Integrity Module for NexusInsight
 * Uses standard WebCrypto API (AES-256-GCM and SHA-256)
 */

export interface EncryptedPayload {
  algorithm: 'AES-256-GCM';
  iv: string; // Base64
  ciphertext: string; // Base64
  salt: string; // Base64
  hash: string; // SHA-256 verification hash
  timestamp: string;
}

const DEFAULT_SECRET_PASSPHRASE = 'NexusInsight-Enterprise-E2EE-Master-Key-2026';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function computeSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptFinancialRecord<T>(data: T, passphrase = DEFAULT_SECRET_PASSPHRASE): Promise<EncryptedPayload> {
  const jsonStr = JSON.stringify(data);
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(jsonStr)
  );

  const hash = await computeSHA256(jsonStr);

  return {
    algorithm: 'AES-256-GCM',
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt.buffer),
    hash,
    timestamp: new Date().toISOString(),
  };
}

export async function decryptFinancialRecord<T>(payload: EncryptedPayload, passphrase = DEFAULT_SECRET_PASSPHRASE): Promise<T> {
  const salt = new Uint8Array(base64ToArrayBuffer(payload.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertextBuffer = base64ToArrayBuffer(payload.ciphertext);
  const key = await deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextBuffer
  );

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decrypted);

  // Validate integrity
  const verifiedHash = await computeSHA256(jsonStr);
  if (verifiedHash !== payload.hash) {
    throw new Error('Cryptographic integrity check failed: Data may have been tampered with.');
  }

  return JSON.parse(jsonStr) as T;
}

export async function generateSecureAuditHash(action: string, entityId: string, timestamp: string, userId: string): Promise<string> {
  return computeSHA256(`${action}:${entityId}:${timestamp}:${userId}:${DEFAULT_SECRET_PASSPHRASE.slice(0, 10)}`);
}
