// Business details shown across the site.
export const site = {
  name: "Top Joint",
  phone: "+216 20 831 260",
  whatsapp: "21620831260", // international format without "+", used for wa.me links
  mapsQuery: "Zone Industrielle Ben Arous Tunis Tunisie",
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
