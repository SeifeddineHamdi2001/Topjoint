import type { Product } from "@prisma/client";
import type { CartProduct } from "@/components/cart/CartProvider";

type ProductForCart = Product & { variants: { mm: string; priceMillimes: number }[] };

/** The subset of a product that the client cart keeps (with its priced épaisseurs). */
export function toCartProduct(p: ProductForCart): CartProduct {
  return {
    productId: p.id,
    slug: p.slug,
    ref: p.ref,
    nameFr: p.nameFr,
    nameAr: p.nameAr,
    priceMillimes: p.priceMillimes,
    image: p.image,
    category: p.category,
    application: p.application,
    kind: p.kind,
    cc: p.cc,
    variants: p.variants.map((variant) => ({ mm: variant.mm, priceMillimes: variant.priceMillimes })),
  };
}
