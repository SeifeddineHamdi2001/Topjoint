/**
 * Cart pricing rules shared by the browser and the checkout Server Action.
 *
 * Quantities are counted across the whole cart: 5 pieces of three different
 * articles = 15 pieces, so the 15+ tier applies.
 *
 * - 15+ articles → 20% off
 * - 30+ articles → 25% off
 *
 * Combo joints are real products created by the admin (one culasse + one chemise),
 * so they are priced like any other article and count as one article each.
 */
export const quantityTiers = [
  { min: 1, discount: 0 },
  { min: 15, discount: 0.2 },
  { min: 30, discount: 0.25 },
] as const;

export type PricedLine = {
  /** Unit price for the chosen épaisseur (or the combo price), in millimes. */
  priceMillimes: number;
  qty: number;
};

export type CartPricing = {
  count: number;
  subtotalMillimes: number;
  tier: (typeof quantityTiers)[number];
  tierDiscountMillimes: number;
  discountMillimes: number;
  totalMillimes: number;
};

export function priceCart(lines: readonly PricedLine[]): CartPricing {
  const count = lines.reduce((sum, line) => sum + Math.max(0, line.qty), 0);
  const subtotalMillimes = lines.reduce((sum, line) => sum + Math.max(0, line.priceMillimes) * Math.max(0, line.qty), 0);
  const tier = [...quantityTiers].reverse().find((candidate) => count >= candidate.min) ?? quantityTiers[0];
  const tierDiscountMillimes = Math.round(subtotalMillimes * tier.discount);

  return {
    count,
    subtotalMillimes,
    tier,
    tierDiscountMillimes,
    discountMillimes: tierDiscountMillimes,
    totalMillimes: Math.max(0, subtotalMillimes - tierDiscountMillimes),
  };
}
