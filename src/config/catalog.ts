import type { Locale } from "./site";

type Labelled = { key: string; fr: string; ar: string };

/**
 * Joint types sold by the workshop. These are the only values accepted by
 * Product.category (the admin form shows exactly this list).
 */
export const categories = [
  { key: "culasse", fr: "Joint culasse", ar: "حشية رأس المحرك" },
  { key: "chemise", fr: "Joint chemise", ar: "حشية القميص" },
  { key: "chaudier", fr: "Joint chaudier", ar: "حشية المرجل" },
  { key: "carter", fr: "Joint carter", ar: "حشية الكارتير" },
  { key: "marine", fr: "Joint marine", ar: "حشية بحرية" },
] as const;

/** Where the joint is used. Shown as a filter in the shop and as a field in the admin. */
export const applications = [
  { key: "automobile", fr: "Automobile", ar: "سيارات" },
  { key: "moto", fr: "Moto", ar: "دراجات نارية" },
  { key: "marine", fr: "Marine", ar: "بحري" },
] as const;

/** Engine displacements the shop sells, in cc. */
export const ccOptions = [50, 125, 150] as const;

export type CategoryKey = (typeof categories)[number]["key"];
export type ApplicationKey = (typeof applications)[number]["key"];
export type CcOption = (typeof ccOptions)[number];

export function labelOf(list: readonly Labelled[], key: string, locale: Locale) {
  return list.find((item) => item.key === key)?.[locale] ?? key;
}

/** 85000 → "85.000" (Tunisian dinar has 3 decimals). */
export function formatPrice(millimes: number) {
  return (millimes / 1000).toFixed(3);
}

export const currency: Record<Locale, string> = { fr: "TND", ar: "د.ت" };

/** One selectable épaisseur with its own unit price (in millimes). */
export type ThicknessOption = { mm: string; priceMillimes: number };

/** Cheapest unit price shown on the cards when a product has several épaisseurs. */
export function startingPriceMillimes(product: { priceMillimes: number; variants?: { priceMillimes: number }[] }) {
  const prices = (product.variants ?? []).map((v) => v.priceMillimes).filter((p) => Number.isInteger(p) && p >= 0);
  return prices.length ? Math.min(...prices) : product.priceMillimes;
}

/** Formats a thickness value (single "1.0" or combo "0.8 + 0.5") for customer-facing display. */
export function formatThickness(thickness: string | null | undefined, locale: Locale): string {
  if (!thickness) return "";
  const trimmed = thickness.trim();
  if (trimmed.includes("+")) {
    const parts = trimmed.split("+").map((p) => p.trim());
    if (parts.length === 2) {
      return locale === "ar"
        ? `رأس ${parts[0]} مم + قميص ${parts[1]} مم`
        : `Culasse ${parts[0]} mm + Chemise ${parts[1]} mm`;
    }
  }
  return locale === "ar" ? `${trimmed} مم` : `${trimmed} mm`;
}
