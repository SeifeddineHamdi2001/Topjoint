export type ResolvedVariant = {
  id: number;
  productId: number;
  mm: string;
  priceMillimes: number;
  position: number;
};

type ComponentWithVariants = {
  priceMillimes: number;
  variants: { mm: string; priceMillimes: number }[];
} | null;

/**
 * Returns explicit variants if defined, or derives compound "culasse + chemise"
 * variants and summed prices for combo products without explicit rows.
 */
export function resolveProductVariants(product: {
  id: number;
  kind: string;
  variants: ResolvedVariant[];
  comboCulasse?: ComponentWithVariants;
  comboChemise?: ComponentWithVariants;
}): ResolvedVariant[] {
  if (product.kind !== "combo" || product.variants.length > 0 || !product.comboCulasse) {
    return product.variants;
  }
  const culasseVariants = product.comboCulasse.variants.length
    ? product.comboCulasse.variants
    : [{ mm: "", priceMillimes: product.comboCulasse.priceMillimes }];
  const chemiseVariants = product.comboChemise?.variants.length
    ? product.comboChemise.variants
    : [{ mm: "", priceMillimes: product.comboChemise?.priceMillimes ?? 0 }];
  const derived: ResolvedVariant[] = [];
  for (const culasse of culasseVariants) {
    for (const chemise of chemiseVariants) {
      const mm = culasse.mm && chemise.mm ? `${culasse.mm} + ${chemise.mm}` : culasse.mm || chemise.mm;
      if (mm) {
        derived.push({
          id: derived.length,
          productId: product.id,
          mm,
          priceMillimes: culasse.priceMillimes + chemise.priceMillimes,
          position: derived.length,
        });
      }
    }
  }
  return derived;
}
