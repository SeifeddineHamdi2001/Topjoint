// Business details shown across the site. Replace the placeholders with the real ones.
export const site = {
  name: "Top Joint",
  phone: "+216 71 000 000",
  phone2: "+216 98 000 000",
  whatsapp: "21698000000", // international format without "+", used for wa.me links
  email: "contact@topjoint.tn",
  mapsQuery: "Zone Industrielle Ben Arous Tunis Tunisie",
};

export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
