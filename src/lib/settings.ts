import "server-only";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./crypto";
import { db } from "./db";

/** Editable in /admin/reglages. Amounts are in millimes (85.000 TND = 85000). */
export type ShopSettings = {
  deliveryFeeMillimes: number;
  /** Free delivery when the items subtotal reaches this amount; 0 = never free. */
  freeDeliveryFromMillimes: number;
  /** Uploaded logo path (`/api/uploads/...`); empty = built-in Top Joint mark. */
  logoImage: string;
  /** Meta (Facebook) Pixel ID; empty = tracking off. */
  metaPixelId: string;
  /** Conversions API access token (server-side only, never sent to the browser). */
  metaAccessToken: string;
  /** Optional "TEST12345" code from Events Manager → Test events. */
  metaTestEventCode: string;
};

const defaults: ShopSettings = {
  deliveryFeeMillimes: 7000,
  freeDeliveryFromMillimes: 0,
  logoImage: "",
  metaPixelId: "",
  metaAccessToken: "",
  metaTestEventCode: "",
};

const ENCRYPTED_KEYS = new Set<keyof ShopSettings>(["metaAccessToken"]);

const globalForSettings = globalThis as unknown as {
  __shopSettingsCache?: { value: ShopSettings; expiresAt: number };
  __shopSettingsInFlight?: Promise<ShopSettings>;
};
const SETTINGS_TTL_MS = 60_000;

export function invalidateShopSettingsCache() {
  globalForSettings.__shopSettingsCache = undefined;
  globalForSettings.__shopSettingsInFlight = undefined;
}

async function fetchShopSettingsFromDb(): Promise<ShopSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(defaults) } } });
  const settings: ShopSettings = { ...defaults };
  for (const row of rows) {
    const key = row.key as keyof ShopSettings;
    if (typeof defaults[key] === "number") {
      const value = Number(row.value);
      if (Number.isInteger(value) && value >= 0) (settings[key] as number) = value;
    } else if (key === "metaPixelId") {
      if (/^\d{6,20}$/.test(row.value)) settings.metaPixelId = row.value;
    } else if (ENCRYPTED_KEYS.has(key)) {
      try {
        (settings[key] as string) = decryptSecret(row.value, `Setting:${key}`);
      } catch (err) {
        console.error(`Failed to decrypt setting ${key}`, err instanceof Error ? err.message : "");
        (settings[key] as string) = "";
      }
    } else {
      (settings[key] as string) = row.value;
    }
  }
  return settings;
}

export async function getShopSettings(): Promise<ShopSettings> {
  const now = Date.now();
  const cached = globalForSettings.__shopSettingsCache;
  if (cached && now < cached.expiresAt) {
    return { ...cached.value };
  }

  if (!globalForSettings.__shopSettingsInFlight) {
    globalForSettings.__shopSettingsInFlight = fetchShopSettingsFromDb()
      .then((value) => {
        globalForSettings.__shopSettingsCache = { value, expiresAt: Date.now() + SETTINGS_TTL_MS };
        return value;
      })
      .finally(() => {
        globalForSettings.__shopSettingsInFlight = undefined;
      });
  }

  const resolved = await globalForSettings.__shopSettingsInFlight;
  return { ...resolved };
}

export async function saveShopSettings(settings: Partial<ShopSettings>) {
  await db.$transaction(
    Object.entries(settings).map(([key, value]) => {
      const raw = String(value);
      const stored = ENCRYPTED_KEYS.has(key as keyof ShopSettings) ? encryptSecret(raw, `Setting:${key}`) : raw;
      return db.setting.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
    }),
  );
  invalidateShopSettingsCache();
}

/** Encrypts any legacy plaintext encrypted-setting rows currently stored in DB. */
export async function migratePlaintextSettings(): Promise<number> {
  const keys = Array.from(ENCRYPTED_KEYS);
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  let migrated = 0;
  for (const row of rows) {
    if (!row.value || isEncryptedSecret(row.value)) continue;
    await db.setting.update({
      where: { key: row.key },
      data: { value: encryptSecret(row.value, `Setting:${row.key}`) },
    });
    migrated++;
  }
  if (migrated > 0) invalidateShopSettingsCache();
  return migrated;
}
