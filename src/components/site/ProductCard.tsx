import Link from "next/link";
import type { Product } from "@prisma/client";
import { applications, categories, currency, formatPrice, labelOf, startingPriceMillimes } from "@/config/catalog";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { toCartProduct } from "@/lib/cartProduct";
import { AddToCart } from "../cart/AddToCart";

type ProductWithVariants = Product & { variants: { mm: string; priceMillimes: number }[] };

export function ProductCard({ product, lang, t }: { product: ProductWithVariants; lang: Locale; t: Dictionary["product"] }) {
  const href = `/${lang}/produits/${product.slug}`;
  const name = lang === "ar" ? product.nameAr : product.nameFr;
  const inStock = product.stock > 0;
  const fromPrice = startingPriceMillimes(product);
  const hasVariants = product.variants.length > 0;
  const isCombo = product.kind === "combo";

  return (
    <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-1 mb-2.5 font-label-code text-label-code">
          <span className="px-1.5 sm:px-2 py-0.5 rounded bg-surface-container-high text-primary font-bold text-[10px] sm:text-label-code truncate" dir="ltr">
            {t.ref} {product.ref}
          </span>
          <span className={`flex items-center gap-1 font-semibold whitespace-nowrap text-[10px] sm:text-label-code ${inStock ? "text-on-primary-fixed-variant" : "text-outline"}`}>
            <span className={`w-2 h-2 rounded-full ${inStock ? "bg-secondary-container" : "bg-outline-variant"}`} />
            {inStock ? t.inStock : t.outOfStock}
          </span>
        </div>
        <Link href={href} className="block w-full aspect-square bg-surface-container-low rounded-lg overflow-hidden mb-3 sm:mb-4">
          {product.image && (
            <img
              src={product.image}
              alt={name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          )}
        </Link>
        <div className="flex flex-wrap gap-1 mb-2">
          {isCombo && (
            <span className="px-1.5 py-0.5 rounded bg-secondary-container text-primary font-label-code text-[10px] font-bold uppercase">
              {t.comboBadge}
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-code text-[10px] uppercase">
            {labelOf(categories, product.category, lang)}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-code text-[10px] font-bold uppercase">
            {labelOf(applications, product.application, lang)}
          </span>
        </div>
        <h3 className="font-headline-sm text-[13px] sm:text-headline-sm text-primary font-bold leading-snug">
          <Link href={href} className="hover:underline line-clamp-2">
            {name}
          </Link>
        </h3>
        <div className="mt-2 space-y-1 bg-surface-container-low p-2 rounded font-label-code text-label-code">
          {product.cc && (
            <div className="flex justify-between gap-2 text-on-surface-variant">
              <span>{t.cc} :</span>
              <span className="text-on-surface font-semibold text-end">{product.cc} cc</span>
            </div>
          )}
          {product.compatibility && (
            <div className="hidden sm:flex justify-between gap-2 text-on-surface-variant">
              <span>{t.compatibility} :</span>
              <span className="text-on-surface font-semibold text-end truncate max-w-[60%]">{product.compatibility}</span>
            </div>
          )}
        </div>
      </div>
      <div className="pt-3 sm:pt-5">
        <div className="flex items-baseline justify-between gap-1 mb-2 sm:mb-3">
          <span className="font-label-code text-[10px] sm:text-label-code text-on-surface-variant uppercase">{hasVariants ? t.from : isCombo ? t.comboPrice : t.unitPrice}</span>
          <span className="font-headline-md text-base sm:text-headline-md text-primary font-bold whitespace-nowrap">
            {formatPrice(fromPrice)} <span className="font-label-code text-label-code">{currency[lang]}</span>
          </span>
        </div>
        <AddToCart
          product={toCartProduct(product)}
          currency={currency[lang]}
          labels={{
            add: t.add,
            thickness: isCombo ? t.comboThickness : t.thickness,
            chooseThickness: isCombo ? t.comboChooseThickness : t.chooseThickness,
            thicknessRequired: t.thicknessRequired,
            comboVariantRequired: t.comboVariantRequired,
            quantity: t.quantity,
            decrease: t.decrease,
            increase: t.increase,
          }}
        />
        <Link href={href} className="block text-center font-label-code text-label-code text-outline hover:text-primary underline pt-2.5 sm:pt-3">
          {t.details}
        </Link>
      </div>
    </div>
  );
}
