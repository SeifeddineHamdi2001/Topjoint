"use client";

import { currency, formatPrice } from "@/config/catalog";
import type { Locale } from "@/config/site";
import { Icon } from "../Icon";
import { useCart } from "./CartProvider";

/** Opens the cart side drawer. */
export function CartButton({ lang, label }: { lang: Locale; label: string }) {
  const { count, totalMillimes, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      className="h-11 px-3 sm:px-4 rounded-lg bg-surface-container border border-outline-variant flex items-center gap-2 hover:bg-surface-container-high transition-colors"
    >
      <Icon name="shopping_cart" className="text-primary text-[20px]" />
      <span className="hidden sm:flex flex-col text-start">
        <span className="font-label-code text-label-code text-primary font-bold leading-none">
          {label} ({count})
        </span>
        <span className="font-label-code text-on-surface-variant text-[10px] leading-tight mt-0.5">
          {formatPrice(totalMillimes)} {currency[lang]}
        </span>
      </span>
      <span className="sm:hidden font-label-code text-label-code text-primary font-bold">{count}</span>
    </button>
  );
}
