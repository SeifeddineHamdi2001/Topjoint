// Business details shown across the site.
export const site = {
  name: "Top Joint",
  phone: "+216 20 831 260",
  whatsapp: "21620831260", // international format without "+", used for wa.me links
  mapsCid: "13501475796192478860",
  mapsUrl:
    "https://www.google.com/maps/place/Top+joint+Sidi+amer/@35.7339222,10.7012071,17z/data=!4m6!3m5!1s0x13020b00656c46bd:0xbb5ee0b3e796468c!8m2!3d35.7339222!4d10.7012071!16s%2Fg%2F11mcs3h_sr",
  mapsCoords: { lat: 35.7339222, lng: 10.7012071 },
};

export function getSiteUrl(): string {
  const raw = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://topjoint.shop").trim();
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return parsed.origin;
  } catch {
    return "https://topjoint.shop";
  }
}

export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
