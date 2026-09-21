import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// For secrets stored on behalf of a business rather than derived from a
// password an owner types back in (that's auth.ts's scrypt job) — right
// now just WhatsApp access tokens (023_whatsapp.sql), which unlike
// stripe_account_id are real bearer credentials that can send messages
// *as* the business, not just an id. AES-256-GCM: authenticated encryption,
// so a tampered ciphertext fails to decrypt instead of silently returning
// garbage.
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)");
  }
  return key;
}

/** Returns "iv:authTag:ciphertext", all base64 — store this whole string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit nonce, GCM's recommended size
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
