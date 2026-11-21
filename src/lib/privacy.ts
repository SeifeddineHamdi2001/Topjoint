import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { deleteUpload } from "./storage";

export const VISITOR_RETENTION_DAYS = 90;
export const CLOSED_QUOTE_RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60_000;

export function retentionCutoffDate(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export type PrivacyRetentionCounts = {
  expiredTokens: number;
  staleRateLimits: number;
  oldOrderVisitors: number;
  oldClosedQuotes: number;
};

export async function getPrivacyRetentionCounts(now = new Date()): Promise<PrivacyRetentionCounts> {
  const rateCutoff = new Date(now.getTime() - DAY_MS);
  const visitorCutoff = retentionCutoffDate(VISITOR_RETENTION_DAYS, now);
  const quoteCutoff = retentionCutoffDate(CLOSED_QUOTE_RETENTION_DAYS, now);

  const [expiredTokens, staleRateLimits, oldOrderVisitors, oldClosedQuotes] = await Promise.all([
    db.revokedToken.count({ where: { expiresAt: { lt: now } } }),
    db.loginLimit.count({
      where: {
        windowStart: { lt: rateCutoff },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
    }),
    db.order.count({
      where: {
        createdAt: { lt: visitorCutoff },
        metaVisitor: { not: Prisma.AnyNull },
      },
    }),
    db.quoteRequest.count({
      where: {
        status: "CLOSED",
        createdAt: { lt: quoteCutoff },
      },
    }),
  ]);

  return { expiredTokens, staleRateLimits, oldOrderVisitors, oldClosedQuotes };
}

export type PrivacyCleanupResult = {
  deletedTokens: number;
  deletedRateLimits: number;
  scrubbedOrderVisitors: number;
  deletedClosedQuotes: number;
  deletedFiles: number;
};

/**
 * Removes expired auth tokens/rate-limit windows, scrubs stale Order browser tracking metadata,
 * and purges archived CLOSED quotes (and their private uploads) older than the retention window.
 */
export async function runPrivacyCleanup(now = new Date()): Promise<PrivacyCleanupResult> {
  const rateCutoff = new Date(now.getTime() - DAY_MS);
  const visitorCutoff = retentionCutoffDate(VISITOR_RETENTION_DAYS, now);
  const quoteCutoff = retentionCutoffDate(CLOSED_QUOTE_RETENTION_DAYS, now);

  const [tokens, rateLimits, orders, quotes] = await Promise.all([
    db.revokedToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.loginLimit.deleteMany({
      where: {
        windowStart: { lt: rateCutoff },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
    }),
    db.order.updateMany({
      where: {
        createdAt: { lt: visitorCutoff },
        metaVisitor: { not: Prisma.AnyNull },
      },
      data: { metaVisitor: Prisma.DbNull },
    }),
    db.quoteRequest.findMany({
      where: { status: "CLOSED", createdAt: { lt: quoteCutoff } },
      select: { id: true, attachmentPath: true },
    }),
  ]);

  let deletedFiles = 0;
  if (quotes.length > 0) {
    await db.quoteRequest.deleteMany({ where: { id: { in: quotes.map((q) => q.id) } } });
    for (const q of quotes) {
      if (q.attachmentPath) {
        await deleteUpload(q.attachmentPath, "private");
        deletedFiles++;
      }
    }
  }

  return {
    deletedTokens: tokens.count,
    deletedRateLimits: rateLimits.count,
    scrubbedOrderVisitors: orders.count,
    deletedClosedQuotes: quotes.length,
    deletedFiles,
  };
}
