import "server-only";
import { db } from "./db";

export const RATE_WINDOW_MS = 15 * 60_000;

/** Extracts a bounded client IP identifier for rate-limiting keys. */
export function clientIpFromHeaders(headers: Headers): string {
  const raw = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return raw.slice(0, 45) || "unknown";
}

/** Checks if any of the given limiter keys is currently locked. */
export async function checkLimitLocked(keys: string[]): Promise<{ allowed: true } | { allowed: false; retryMinutes: number }> {
  const now = new Date();
  const rows = await db.loginLimit.findMany({
    where: { key: { in: keys }, lockedUntil: { gt: now } },
    select: { lockedUntil: true },
  });
  if (rows.length === 0) return { allowed: true };
  const maxUntil = Math.max(...rows.map((r) => r.lockedUntil?.getTime() ?? 0));
  return { allowed: false, retryMinutes: Math.max(1, Math.ceil((maxUntil - now.getTime()) / 60_000)) };
}

/** Atomically increments a sliding-window counter and applies lockout thresholds. */
export async function bumpRateLimit(
  key: string,
  now: Date,
  windowMs: number,
  threshold: number,
  lockMs: number,
  escalatedThreshold?: number,
  escalatedLockMs?: number,
) {
  const windowCutoff = new Date(now.getTime() - windowMs);
  const baseLockUntil = new Date(now.getTime() + lockMs);
  const highLockUntil = new Date(now.getTime() + (escalatedLockMs ?? lockMs));
  const highThreshold = escalatedThreshold ?? threshold;

  const rows = await db.$queryRaw<{ lockedUntil: Date | null }[]>`
    INSERT INTO "LoginLimit" ("key", "failures", "windowStart", "lockedUntil")
    VALUES (${key}, 1, ${now}, NULL)
    ON CONFLICT ("key") DO UPDATE SET
      "failures" = CASE
        WHEN "LoginLimit"."windowStart" < ${windowCutoff} THEN 1
        ELSE "LoginLimit"."failures" + 1
      END,
      "windowStart" = CASE
        WHEN "LoginLimit"."windowStart" < ${windowCutoff} THEN ${now}
        ELSE "LoginLimit"."windowStart"
      END,
      "lockedUntil" = CASE
        WHEN (CASE WHEN "LoginLimit"."windowStart" < ${windowCutoff} THEN 1 ELSE "LoginLimit"."failures" + 1 END) >= ${highThreshold}
          THEN GREATEST(COALESCE("LoginLimit"."lockedUntil", ${highLockUntil}), ${highLockUntil})
        WHEN (CASE WHEN "LoginLimit"."windowStart" < ${windowCutoff} THEN 1 ELSE "LoginLimit"."failures" + 1 END) >= ${threshold}
          THEN GREATEST(COALESCE("LoginLimit"."lockedUntil", ${baseLockUntil}), ${baseLockUntil})
        WHEN "LoginLimit"."windowStart" < ${windowCutoff} THEN NULL
        ELSE "LoginLimit"."lockedUntil"
      END
    RETURNING "lockedUntil"
  `;
  return rows[0]?.lockedUntil ?? null;
}

/** Checks and increments a request-count rate limit (for public forms/checkout). */
export async function consumePublicLimit(key: string, maxRequests: number, windowMs = RATE_WINDOW_MS, lockMs = RATE_WINDOW_MS) {
  const status = await checkLimitLocked([key]);
  if (!status.allowed) return status;
  const lockedUntil = await bumpRateLimit(key, new Date(), windowMs, maxRequests + 1, lockMs);
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return { allowed: false as const, retryMinutes: Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000)) };
  }
  return { allowed: true as const };
}

/** Clears specified keys and prunes stale limiter rows older than 24 hours. */
export async function clearRateLimits(keys: string[]) {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60_000);
  await db.loginLimit
    .deleteMany({
      where: { OR: [{ key: { in: keys } }, { windowStart: { lt: staleBefore } }] },
    })
    .catch(() => null);
}

type MemoryEntry = { count: number; resetAt: number };
const memoryLimits = new Map<string, MemoryEntry>();
const MAX_MEMORY_KEYS = 10_000;

/**
 * Lightweight fixed-window in-memory rate limiter for high-frequency read/telemetry API endpoints
 * so search keystrokes and Meta pixel pings do not amplify PostgreSQL writes.
 */
export function consumeMemoryLimit(key: string, maxRequests: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const existing = memoryLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    if (memoryLimits.size >= MAX_MEMORY_KEYS) {
      for (const [k, v] of memoryLimits) {
        if (v.resetAt <= now) memoryLimits.delete(k);
        if (memoryLimits.size < MAX_MEMORY_KEYS) break;
      }
      if (memoryLimits.size >= MAX_MEMORY_KEYS) {
        const oldestKey = memoryLimits.keys().next().value;
        if (oldestKey !== undefined) memoryLimits.delete(oldestKey);
      }
    }
    memoryLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) return false;
  existing.count += 1;
  return true;
}
