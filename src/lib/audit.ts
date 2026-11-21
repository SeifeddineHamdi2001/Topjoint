import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { clientIpFromHeaders } from "./rateLimit";

export type AuditActor = {
  email?: string | null;
  role?: string | null;
};

export type AuditEntry = {
  action: string;
  target?: string | null;
  detail?: string | null;
  actor?: AuditActor | null;
  ip?: string | null;
};

async function resolveIp(explicitIp?: string | null): Promise<string | null> {
  if (explicitIp !== undefined) return explicitIp ? explicitIp.slice(0, 45) : null;
  try {
    return clientIpFromHeaders(await headers()).slice(0, 45);
  } catch {
    return null;
  }
}

/** Appends a security/admin audit record without crashing business flows on DB write failures. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const ip = await resolveIp(entry.ip);
    await db.auditLog.create({
      data: {
        actorEmail: entry.actor?.email ? entry.actor.email.slice(0, 160) : null,
        actorRole: entry.actor?.role ? entry.actor.role.slice(0, 20) : null,
        action: entry.action.slice(0, 64),
        target: entry.target ? entry.target.slice(0, 120) : null,
        ip,
        detail: entry.detail ? entry.detail.slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("recordAudit failed", err instanceof Error ? err.message : err);
  }
}
