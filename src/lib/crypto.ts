import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_SALT = Buffer.from("topjoint:crypto:salt:v1");
const HKDF_INFO = Buffer.from("topjoint:settings-aes-256-gcm:v1");

export class SecretDecryptionError extends Error {
  constructor(message = "Failed to decrypt secret") {
    super(message);
    this.name = "SecretDecryptionError";
  }
}

function getMasterSecret(): string {
  const dedicated = process.env.SETTINGS_ENCRYPTION_KEY;
  if (dedicated && dedicated.length >= 32) return dedicated;
  const fallback = process.env.AUTH_SECRET;
  if (fallback && fallback.length >= 32) return fallback;
  throw new Error("SETTINGS_ENCRYPTION_KEY or AUTH_SECRET must be set (32+ characters)");
}

let cachedSecret: string | null = null;
let cachedKey: Buffer | null = null;

function deriveKey(): Buffer {
  const master = getMasterSecret();
  if (cachedKey && cachedSecret === master) return cachedKey;
  cachedSecret = master;
  cachedKey = Buffer.from(hkdfSync("sha256", master, HKDF_SALT, HKDF_INFO, KEY_BYTES));
  return cachedKey;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypts a non-empty secret with AES-256-GCM bound to `context` via AAD. */
export function encryptSecret(plaintext: string, context = "setting"): string {
  if (!plaintext) return "";
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/** Decrypts an `enc:v1:` secret. Legacy unprefixed values pass through so existing setups continue working. */
export function decryptSecret(stored: string, context = "setting"): string {
  if (!stored) return "";
  if (!isEncryptedSecret(stored)) return stored;
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new SecretDecryptionError("Malformed encrypted payload");
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new SecretDecryptionError("Invalid IV or auth tag length");
    }
    const key = deriveKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof SecretDecryptionError) throw err;
    throw new SecretDecryptionError("Secret decryption or authentication tag verification failed");
  }
}
