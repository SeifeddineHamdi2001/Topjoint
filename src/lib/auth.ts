import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { RATE_WINDOW_MS, bumpRateLimit, checkLimitLocked, clearRateLimits } from "./rateLimit";
import { type AdminSession, SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from "./session";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// Used when an account does not exist or is inactive so failed logins take uniform scrypt work.
const DUMMY_SCRYPT = "00000000000000000000000000000000:" + "00".repeat(64);
const LOCK_5M_MS = 5 * 60_000;
const LOCK_15M_MS = 15 * 60_000;

function safeEqual(a: string, b: string) {
  const key = randomBytes(32);
  const ha = createHmac("sha256", key).update(a).digest();
  const hb = createHmac("sha256", key).update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** "salt:hash" in hex — scrypt with a random 16-byte salt. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scryptAsync(password, salt, 64)).toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length < 16 || expected.length !== 64) return false;
  const actual = await scryptAsync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 12 || password.length > 200) {
    return "Le mot de passe doit contenir entre 12 et 200 caractères.";
  }
  if (!/\p{L}/u.test(password) || !/[\d\p{P}\p{S}]/u.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre ou symbole.";
  }
  return null;
}

function limitKeys(ip: string, email: string) {
  const safeIp = (ip || "unknown").trim().slice(0, 45) || "unknown";
  const safeEmail = email.trim().toLowerCase().slice(0, 160);
  return {
    ipKey: `ip:${safeIp}`,
    pairKey: `ip_acct:${safeIp}|${safeEmail}`,
    acctKey: `acct:${safeEmail}`,
  };
}

export async function checkLoginRateLimit(ip: string, email: string) {
  const { ipKey, pairKey, acctKey } = limitKeys(ip, email);
  return checkLimitLocked([ipKey, pairKey, acctKey]);
}

export async function recordLoginFailure(ip: string, email: string) {
  const { ipKey, pairKey, acctKey } = limitKeys(ip, email);
  const now = new Date();
  await Promise.all([
    bumpRateLimit(ipKey, now, RATE_WINDOW_MS, 20, LOCK_15M_MS),
    bumpRateLimit(pairKey, now, RATE_WINDOW_MS, 5, LOCK_5M_MS, 10, LOCK_15M_MS),
    bumpRateLimit(acctKey, now, RATE_WINDOW_MS, 25, LOCK_5M_MS),
  ]);
}

export async function clearLoginFailures(ip: string, email: string) {
  const { pairKey, acctKey } = limitKeys(ip, email);
  await clearRateLimits([pairKey, acctKey]);
}

/** Owner from .env first (ADMIN_PASSWORD_HASH or ADMIN_PASSWORD), then active staff accounts. */
export async function authenticate(email: string, password: string): Promise<AdminSession | null> {
  const login = email.trim().toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (adminEmail && (adminPasswordHash || adminPassword)) {
    const emailOk = safeEqual(login, adminEmail.toLowerCase());
    if (adminPasswordHash && emailOk) {
      const ok = await verifyPassword(password, adminPasswordHash);
      return ok ? { email: adminEmail, name: "Propriétaire", role: "owner" } : null;
    }
    if (!adminPasswordHash) {
      const passwordOk = safeEqual(password, adminPassword);
      if (emailOk && passwordOk) return { email: adminEmail, name: "Propriétaire", role: "owner" };
    }
  }

  const staff = await db.staffUser.findUnique({ where: { email: login } });
  const hashToVerify = staff?.active ? staff.passwordHash : DUMMY_SCRYPT;
  const passwordOk = await verifyPassword(password, hashToVerify);
  if (!staff?.active || !passwordOk) return null;

  await db.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  return { email: staff.email, name: staff.name, role: "staff", ver: staff.tokenVersion };
}

export async function startSession(session: AdminSession) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions);
}

export async function endSession() {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (session?.jti && session.exp) {
    const expiresAt = new Date(session.exp * 1000);
    await db.revokedToken
      .upsert({
        where: { jti: session.jti },
        create: { jti: session.jti, expiresAt },
        update: { expiresAt },
      })
      .catch(() => null);
    await db.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null);
  }
  jar.delete(SESSION_COOKIE);
}

/** Verifies JWT signature, revocation list, and live staff active/tokenVersion status. */
export async function getVerifiedAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session?.jti) return null;

  const revoked = await db.revokedToken.findUnique({ where: { jti: session.jti }, select: { jti: true } });
  if (revoked) return null;

  // A deactivated, deleted, or password-reset staff account loses access right away.
  if (session.role === "staff") {
    const staff = await db.staffUser.findUnique({
      where: { email: session.email },
      select: { active: true, tokenVersion: true },
    });
    if (!staff?.active || staff.tokenVersion !== session.ver) return null;
  }
  return session;
}

/** Call at the top of every admin page and Server Action. Owner or staff. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getVerifiedAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Owner-only pages and actions: dashboard, quotes, products, settings, team, deleting orders. */
export async function requireOwner(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "owner") redirect("/admin/commandes");
  return session;
}
