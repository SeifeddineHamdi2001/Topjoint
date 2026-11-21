"use client";

import Link from "next/link";
import { useEffect } from "react";
import { currency, formatPrice, formatThickness } from "@/config/catalog";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";
import { useCart } from "./CartProvider";
import { QtyStepper } from "./QtyStepper";

type Props = { lang: Locale; t: Dictionary["cart"]; productT: Dictionary["product"] };

/** Cart as a side panel (end side: right in French, left in Arabic). */
export function CartDrawer({ lang, t, productT }: Props) {
  const { items, count, subtotalMillimes, totalMillimes, pricing, isOpen, close, setQty, remove } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return (
    <div className={`fixed inset-0 z-[60] ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      <div onClick={close} className={`absolute inset-0 bg-primary/50 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className={`absolute inset-y-0 end-0 w-full max-w-md bg-surface-container-lowest shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 h-16 border-b border-outline-variant/40">
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2">
            <Icon name="shopping_cart" /> {t.title} ({count})
          </h2>
          <button type="button" onClick={close} aria-label={t.close} className="w-10 h-10 rounded-lg hover:bg-surface-container flex items-center justify-center">
            <Icon name="close" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <Icon name="shopping_cart" className="text-5xl text-outline" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t.empty}</p>
            <Link href={`/${lang}/produits`} onClick={close} className="h-11 px-5 rounded-lg bg-secondary-container text-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center">
              {t.continue}
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-outline-variant/40 px-4 sm:px-5">
              {items.map((item) => (
                <li key={item.key} className="flex gap-3 py-4">
                  <Link href={`/${lang}/produits/${item.slug}`} onClick={close} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-surface-container-low">
                    {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                  </Link>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-label-metric text-label-metric text-primary leading-snug line-clamp-2">{lang === "ar" ? item.nameAr : item.nameFr}</div>
                    <div className="flex flex-wrap gap-x-3 font-label-code text-label-code text-on-surface-variant">
                      <span dir="ltr">{item.ref}</span>
                      {item.kind === "combo" && (
                        <span className="px-1.5 rounded bg-secondary-container text-primary font-bold uppercase">{productT.comboBadge}</span>
                      )}
                      {item.cc && <span>{item.cc} cc</span>}
                      {item.thickness && (
                        <span>
                          {formatThickness(item.thickness, lang)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <QtyStepper
                        value={item.qty}
                        onChange={(qty) => setQty(item.key, qty)}
                        size="sm"
                        labels={{ quantity: t.quantity, decrease: t.decrease, increase: t.increase }}
                      />
                      <div className="text-end">
                        <div className="font-label-metric text-label-metric text-primary whitespace-nowrap">
                          {formatPrice(item.priceMillimes * item.qty)} {currency[lang]}
                        </div>
                        <div className="font-label-code text-[10px] text-on-surface-variant whitespace-nowrap">
                          {formatPrice(item.priceMillimes)} {productT.perUnit}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => remove(item.key)} aria-label={t.remove} className="self-start text-outline hover:text-error">
                    <Icon name="delete" className="text-[20px]" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-outline-variant/40 p-4 sm:p-5 space-y-3">
              <div className="space-y-1.5 font-body-sm text-body-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-on-surface-variant">{t.subtotal}</span>
                  <span className="text-primary">{formatPrice(subtotalMillimes)} {currency[lang]}</span>
                </div>
                {pricing.tierDiscountMillimes > 0 && (
                  <div className="flex items-baseline justify-between gap-2 text-secondary font-bold">
                    <span>{t.volumeDiscount.replace("{percent}", String(Math.round(pricing.tier.discount * 100)))}</span>
                    <span>−{formatPrice(pricing.tierDiscountMillimes)} {currency[lang]}</span>
                  </div>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-outline-variant/40">
                <span className="font-label-metric text-label-metric uppercase text-on-surface-variant">{t.total}</span>
                <span className="font-headline-md text-headline-md text-primary font-bold whitespace-nowrap">
                  {formatPrice(totalMillimes)} {currency[lang]}
                </span>
              </div>

              <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <Icon name="payments" className="text-secondary text-[18px]" /> {t.payment}
              </div>
              <Link
                href={`/${lang}/commande`}
                onClick={close}
                className="w-full h-12 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold flex items-center justify-center gap-2"
              >
                {t.checkout}
                <Icon name="arrow_forward" className="text-[18px]" flip />
              </Link>
              <button type="button" onClick={close} className="w-full h-10 font-label-metric text-label-metric text-primary hover:underline">
                {t.continue}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
