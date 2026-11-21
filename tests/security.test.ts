import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, describe, it } from "node:test";
import { SignJWT } from "jose";

import { priceCart } from "@/config/pricing";
import { recordAudit } from "@/lib/audit";
import { hashPassword, validatePasswordPolicy, checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "@/lib/auth";
import { decryptSecret, encryptSecret, isEncryptedSecret, SecretDecryptionError } from "@/lib/crypto";
import { MAX_INT4, db, toInt32 } from "@/lib/db";
import { resolveSourceUrl } from "@/lib/meta";
import { VISITOR_RETENTION_DAYS, getPrivacyRetentionCounts, retentionCutoffDate } from "@/lib/privacy";
import { clearRateLimits, consumePublicLimit } from "@/lib/rateLimit";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import { InvalidUploadError, deleteUpload, isAcceptable, readUpload, saveUpload } from "@/lib/storage";
import { resolveProductVariants } from "@/lib/variants";

const hasDatabase = Boolean(process.env.DATABASE_URL);

after(async () => {
  await db.$disconnect().catch(() => null);
});

describe("Encryption at rest (src/lib/crypto.ts)", () => {
  it("encrypts and decrypts secrets using AES-256-GCM with fresh IVs", () => {
    const token = "EAAB-sample-meta-token-123456";
    const encA = encryptSecret(token, "Setting:metaAccessToken");
    const encB = encryptSecret(token, "Setting:metaAccessToken");
    assert.ok(isEncryptedSecret(encA));
    assert.notEqual(encA, encB);
    assert.equal(decryptSecret(encA, "Setting:metaAccessToken"), token);
    assert.equal(decryptSecret(encB, "Setting:metaAccessToken"), token);
  });

  it("handles empty values and legacy unprefixed plaintext", () => {
    assert.equal(encryptSecret(""), "");
    assert.equal(decryptSecret(""), "");
    assert.equal(isEncryptedSecret("legacy-plain-token"), false);
    assert.equal(decryptSecret("legacy-plain-token", "Setting:metaAccessToken"), "legacy-plain-token");
  });

  it("rejects tampered ciphertext, wrong AAD context, and malformed payloads", () => {
    const enc = encryptSecret("secret-value", "Setting:metaAccessToken");
    assert.throws(() => decryptSecret(enc, "Setting:wrongContext"), SecretDecryptionError);

    const parts = enc.split(":");
    const tamperedTag = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    assert.throws(
      () => decryptSecret([parts[0], parts[1], parts[2], tamperedTag, parts[4]].join(":"), "Setting:metaAccessToken"),
      SecretDecryptionError,
    );
    assert.throws(() => decryptSecret("enc:v1:invalid", "Setting:metaAccessToken"), SecretDecryptionError);
  });
});

describe("Session JWT hardening (src/lib/session.ts)", () => {
  it("signs and verifies owner and staff tokens with strict claims", async () => {
    const ownerJwt = await createSessionToken({ email: "owner@example.test", name: "Owner", role: "owner" });
    const owner = await verifySessionToken(ownerJwt);
    assert.ok(owner);
    assert.equal(owner.role, "owner");
    assert.ok(owner.jti);

    const staffJwt = await createSessionToken({ email: "staff@example.test", name: "Staff", role: "staff", ver: 3 });
    const staff = await verifySessionToken(staffJwt);
    assert.ok(staff);
    assert.equal(staff.role, "staff");
    assert.equal(staff.ver, 3);
  });

  it("rejects alg=none, HS384, wrong issuer/audience, and staff tokens missing ver", async () => {
    const secretBytes = new TextEncoder().encode(process.env.AUTH_SECRET);
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"sub":"a@b.tn","role":"owner","jti":"1","iss":"topjoint-admin","aud":"topjoint-admin"}').toString("base64url")}.`;
    assert.equal(await verifySessionToken(unsigned), null);

    const hs384 = await new SignJWT({ sub: "a@b.tn", role: "owner" })
      .setProtectedHeader({ alg: "HS384" })
      .setJti("jti-1")
      .setIssuer("topjoint-admin")
      .setAudience("topjoint-admin")
      .setExpirationTime("1h")
      .sign(secretBytes);
    assert.equal(await verifySessionToken(hs384), null);

    const wrongAud = await new SignJWT({ sub: "a@b.tn", role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setJti("jti-2")
      .setIssuer("topjoint-admin")
      .setAudience("other-app")
      .setExpirationTime("1h")
      .sign(secretBytes);
    assert.equal(await verifySessionToken(wrongAud), null);

    const staffNoVer = await new SignJWT({ sub: "s@b.tn", role: "staff" })
      .setProtectedHeader({ alg: "HS256" })
      .setJti("jti-3")
      .setIssuer("topjoint-admin")
      .setAudience("topjoint-admin")
      .setExpirationTime("1h")
      .sign(secretBytes);
    assert.equal(await verifySessionToken(staffNoVer), null);
  });
});

describe("Password policy & scrypt hashing (src/lib/auth.ts)", () => {
  it("enforces 12-200 chars with at least one letter and one digit/symbol", () => {
    assert.ok(validatePasswordPolicy("short1!"));
    assert.ok(validatePasswordPolicy("onlyletterslongpassword"));
    assert.ok(validatePasswordPolicy("12345678901234"));
    assert.equal(validatePasswordPolicy("AtelierTop2026!"), null);
  });

  it("produces salted scrypt hashes", async () => {
    const h1 = await hashPassword("AtelierTop2026!");
    const h2 = await hashPassword("AtelierTop2026!");
    assert.notEqual(h1, h2);
    assert.match(h1, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });
});

describe("Bounds, variants, pricing & CAPI URL validation", () => {
  it("clamps INT4 bounds cleanly with toInt32", () => {
    assert.equal(toInt32("42", 1), 42);
    assert.equal(toInt32("0", 1), null);
    assert.equal(toInt32(MAX_INT4 + 1, 1), null);
    assert.equal(toInt32(Number.NaN, 0), null);
  });

  it("derives combo variants and cart discounts server-side", () => {
    const combo = resolveProductVariants({
      id: 1,
      kind: "combo",
      variants: [],
      comboCulasse: {
        priceMillimes: 20000,
        variants: [{ mm: "0.8", priceMillimes: 22000 }],
      },
      comboChemise: {
        priceMillimes: 10000,
        variants: [
          { mm: "0.5", priceMillimes: 10500 },
          { mm: "0.8", priceMillimes: 11000 },
        ],
      },
    });
    assert.deepEqual(
      combo.map(({ mm, priceMillimes }) => ({ mm, priceMillimes })),
      [
        { mm: "0.8 + 0.5", priceMillimes: 32500 },
        { mm: "0.8 + 0.8", priceMillimes: 33000 },
      ],
    );

    const pricing = priceCart([{ priceMillimes: 10000, qty: 15 }]);
    assert.equal(pricing.subtotalMillimes, 150000);
    assert.ok(pricing.discountMillimes > 0);
    assert.equal(pricing.totalMillimes, 150000 - pricing.discountMillimes);
  });

  it("validates Meta CAPI source URLs against host injection", () => {
    const valid = new Headers({ origin: "https://topjoint.tn" });
    assert.equal(resolveSourceUrl(valid, "/fr/commande"), "https://topjoint.tn/fr/commande");

    const spoofedHost = new Headers({ "x-forwarded-host": "evil.tld/attacker" });
    assert.equal(resolveSourceUrl(spoofedHost, "/fr"), "");

    const invalidProto = new Headers({ origin: "ftp://topjoint.tn" });
    assert.equal(resolveSourceUrl(invalidProto, "/fr"), "");
  });
});

describe("Upload magic-byte verification, sanitization & traversal defense (src/lib/storage.ts)", () => {
  it("blocks path traversal and non-UUID names on read/delete", async () => {
    assert.equal(await readUpload("../.env", "private"), null);
    assert.equal(await readUpload("..\\package.json", "public"), null);
    assert.equal(await readUpload("not-a-uuid.jpg", "public"), null);
    assert.equal(await deleteUpload("../hero.jpg", "public"), undefined);
  });

  it("rejects mismatched extension & content signatures", async () => {
    const htmlAsJpg = new File(["<script>alert(1)</script>"], "evil.jpg", { type: "image/jpeg" });
    assert.equal(isAcceptable(htmlAsJpg, "public"), true);
    await assert.rejects(() => saveUpload(htmlAsJpg, "public"), InvalidUploadError);

    const peAsPdf = new File(["MZ\x90\x00not-a-pdf"], "payload.pdf", { type: "application/pdf" });
    await assert.rejects(() => saveUpload(peAsPdf, "private"), InvalidUploadError);

    const htmlAsStep = new File(["<html><body>x</body></html>"], "fake.stp");
    await assert.rejects(() => saveUpload(htmlAsStep, "private"), InvalidUploadError);
  });

  it("re-encodes valid raster uploads through sharp and accepts valid PDF/STEP", async () => {
    const heroBytes = await readFile(path.resolve("public/hero.jpg"));
    const savedImg = await saveUpload(new File([heroBytes], "hero.jpg", { type: "image/jpeg" }), "public");
    try {
      const stored = await readUpload(savedImg, "public");
      assert.ok(stored);
      assert.equal(stored[0], 0xff);
      assert.equal(stored[1], 0xd8);
    } finally {
      await deleteUpload(savedImg, "public");
    }

    const savedPdf = await saveUpload(new File(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"], "plan.pdf", { type: "application/pdf" }), "private");
    const savedStep = await saveUpload(new File(["ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;\n"], "cad.stp"), "private");
    try {
      assert.ok(await readUpload(savedPdf, "private"));
      assert.ok(await readUpload(savedStep, "private"));
    } finally {
      await deleteUpload(savedPdf, "private");
      await deleteUpload(savedStep, "private");
    }
  });
});

describe("Database security controls (test-scoped, non-destructive)", { skip: !hasDatabase }, () => {
  it("enforces atomic public rate limiting and login lockouts", async () => {
    const pubKey = `__sec_test_pub:${randomUUID()}`;
    const testEmail = `sec-${randomUUID()}@example.test`;
    const testIp = "198.51.100.77";
    try {
      for (let i = 0; i < 3; i++) {
        const res = await consumePublicLimit(pubKey, 3);
        assert.equal(res.allowed, true);
      }
      const blocked = await consumePublicLimit(pubKey, 3);
      assert.equal(blocked.allowed, false);

      for (let i = 0; i < 5; i++) await recordLoginFailure(testIp, testEmail);
      const locked = await checkLoginRateLimit(testIp, testEmail);
      assert.equal(locked.allowed, false);

      await clearLoginFailures(testIp, testEmail);
      const unlocked = await checkLoginRateLimit(testIp, testEmail);
      assert.equal(unlocked.allowed, true);
    } finally {
      await clearRateLimits([pubKey, `ip:${testIp}`, `ip_acct:${testIp}|${testEmail}`, `acct:${testEmail}`]);
    }
  });

  it("persists RevokedToken and AuditLog entries", async () => {
    const jti = `sec-test-${randomUUID()}`;
    const action = `sec.test.${randomUUID().slice(0, 8)}`;
    try {
      await db.revokedToken.create({ data: { jti, expiresAt: new Date(Date.now() + 60_000) } });
      const foundToken = await db.revokedToken.findUnique({ where: { jti } });
      assert.ok(foundToken);

      await recordAudit({ action, actor: { email: "test@example.test", role: "owner" }, target: "test:1", ip: "127.0.0.1" });
      const foundLog = await db.auditLog.findFirst({ where: { action } });
      assert.ok(foundLog);
      assert.equal(foundLog.actorEmail, "test@example.test");
    } finally {
      await db.revokedToken.deleteMany({ where: { jti } });
      await db.auditLog.deleteMany({ where: { action } });
    }
  });

  it("computes privacy retention counts non-destructively", async () => {
    const now = new Date();
    const cutoff = retentionCutoffDate(VISITOR_RETENTION_DAYS, now);
    assert.equal(Math.round((now.getTime() - cutoff.getTime()) / (24 * 60 * 60_000)), VISITOR_RETENTION_DAYS);

    const counts = await getPrivacyRetentionCounts(now);
    assert.ok(counts.expiredTokens >= 0);
    assert.ok(counts.staleRateLimits >= 0);
    assert.ok(counts.oldOrderVisitors >= 0);
    assert.ok(counts.oldClosedQuotes >= 0);
  });
});
