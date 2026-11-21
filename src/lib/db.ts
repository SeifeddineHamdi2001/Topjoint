import { Prisma, PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = db;

export const MAX_INT4 = 2_147_483_647;

/** Parses a finite integer within PostgreSQL signed 32-bit INT4 bounds [min, MAX_INT4]; null otherwise. */
export function toInt32(value: unknown, min = 0): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n >= min && n <= MAX_INT4 ? n : null;
}

/** Case-insensitive "contains" filter (Postgres LIKE is case-sensitive by default). */
export function textSearch(q: string) {
  return { contains: q, mode: Prisma.QueryMode.insensitive };
}

/** True when a write failed on a @unique column (e.g. a duplicate product ref). */
export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
