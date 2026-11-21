import { SignJWT, jwtVerify } from "jose";

// Edge-safe helpers shared by proxy.ts and server code.
export const SESSION_COOKIE = "tj_admin";
const MAX_AGE = 60 * 60 * 12; // 12h
const JWT_ISSUER = "topjoint-admin";
const JWT_AUDIENCE = "topjoint-admin";

/** owner = the .env account (everything); staff = StaffUser rows (orders only). */
export type Role = "owner" | "staff";
export type AdminSession = {
  email: string;
  name: string;
  role: Role;
  ver?: number;
  jti?: string;
  exp?: number;
};

/** Paths a staff account may open; everything else in /admin is owner-only. */
export function staffCanAccess(pathname: string) {
  return pathname.startsWith("/admin/commandes") || pathname.startsWith("/admin/impression");
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(session: AdminSession) {
  const jti = session.jti ?? globalThis.crypto.randomUUID();
  return new SignJWT({
    sub: session.email,
    name: session.name,
    role: session.role,
    ...(session.ver !== undefined && { ver: session.ver }),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const role = payload.role === "owner" || payload.role === "staff" ? payload.role : null;
    if (typeof payload.sub !== "string" || !role || typeof payload.jti !== "string") return null;
    if (role === "staff" && typeof payload.ver !== "number") return null;
    return {
      email: payload.sub,
      name: typeof payload.name === "string" ? payload.name : payload.sub,
      role,
      ...(typeof payload.ver === "number" && { ver: payload.ver }),
      jti: payload.jti,
      ...(typeof payload.exp === "number" && { exp: payload.exp }),
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
