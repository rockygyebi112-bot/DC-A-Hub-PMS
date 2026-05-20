import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * App-level AES-256-GCM encryption for Kobo API tokens.
 *
 * pgsodium is unusable on this Supabase tier (service_role cannot read
 * pgsodium.key), so tokens are encrypted in Node instead and stored in the
 * `evaluation_instruments.kobo_api_token_encrypted` bytea column.
 *
 * STORAGE FORMAT: the Buffer returned by `encryptToken` is written into the
 * bytea column as a `\x`-prefixed hex string, i.e. `'\\x' + buf.toString('hex')`.
 * Any code that stores a token (Task 14) MUST use this same convention so the
 * read path (`byteaToBuffer` in kobo.ts) can decode it.
 *
 * Buffer layout: IV(12) || authTag(16) || ciphertext.
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const raw = process.env.KOBO_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error(
      "KOBO_TOKEN_ENC_KEY is not set — required for Kobo token encryption"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `KOBO_TOKEN_ENC_KEY must decode to exactly ${KEY_LENGTH} bytes, got ${key.length}`
    );
  }
  return key;
}

/**
 * AES-256-GCM encrypt a plaintext token.
 * Returns a Buffer laid out as IV(12) || authTag(16) || ciphertext.
 */
export function encryptToken(plaintext: string): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Reverse of `encryptToken`. Throws on auth-tag mismatch (tampered data).
 */
export function decryptToken(payload: Buffer): string {
  const key = getKey();
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted token payload is too short");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
