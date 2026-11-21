"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { placeOrder, type FormState } from "@/app/[lang]/actions";
import { currency, formatPrice, formatThickness } from "@/config/catalog";
import { deliveryFor } from "@/config/delivery";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";
import { trackMeta } from "../site/MetaPixel";
import { useCart } from "./CartProvider";

const initial: FormState = { status: "idle" };

type Props = {
  lang: Locale;
  t: Dictionary["cart"];
  productT: Dictionary["product"];
  phoneError: string;
  delivery: { deliveryFeeMillimes: number; freeDeliveryFromMillimes: number };
};

export function CheckoutView({ lang, t, productT, phoneError, delivery }: Props) {
  const { items, subtotalMillimes, totalMillimes, pricing, clear, open } = useCart();
  const [state, action, pending] = useActionState(placeOrder, initial);

  useEffect(() => {
    if (state.status !== "success") return;
    // Same event ID as the server-side Purchase sent by placeOrder, so Meta counts it once.
    if (state.orderId && state.valueMillimes !== undefined) {
      trackMeta(
        "Purchase",
        {
          value: state.valueMillimes / 1000,
          currency: "TND",
          content_type: "product",
          content_ids: items.map((i) => i.ref),
          contents: items.map((i) => ({ id: i.ref, quantity: i.qty })),
          num_items: items.reduce((sum, i) => sum + i.qty, 0),
          order_id: String(state.orderId),
        },
        `order-${state.orderId}`,
      );
    }
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per successful order, with the items it contained
  }, [state, clear]);

  // InitiateCheckout once the cart has loaded from the browser storage.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return;
    checkoutTracked.current = true;
    const timer = setTimeout(() => {
      trackMeta("InitiateCheckout", {
        value: totalMillimes / 1000,
        currency: "TND",
        content_type: "product",
        content_ids: items.map((i) => i.ref),
        num_items: items.reduce((sum, i) => sum + i.qty, 0),
      });
    }, window.fbq ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [items, totalMillimes]);

  if (state.status === "success") {
    return (
      <div className="p-8 rounded-xl bg-surface-container-lowest shadow-sm text-center space-y-4">
        <Icon name="check_circle" className="text-5xl text-secondary-container" />
        <p className="font-headline-sm text-headline-sm text-primary">{t.success.replace("{id}", String(state.orderId))}</p>
        <Link href={`/${lang}/produits`} className="inline-flex h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase items-center">
          {t.continue}
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-10 rounded-xl bg-surface-container-lowest shadow-sm text-center space-y-4">
        <Icon name="shopping_cart" className="text-5xl text-outline" />
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t.empty}</p>
        <Link href={`/${lang}/produits`} className="inline-flex h-11 px-5 rounded-lg bg-secondary-container text-primary font-label-metric text-label-metric font-bold uppercase items-center">
          {t.continue}
        </Link>
      </div>
    );
  }

  // Display only: the Server Action recomputes the fee from the database.
  const deliveryMillimes = deliveryFor(totalMillimes, delivery);
  const price = (millimes: number) => `${formatPrice(millimes)} ${currency[lang]}`;

  const error = state.status === "error" ? (state.error === "phone" ? phoneError : t.errors[(state.error ?? "server") as keyof typeof t.errors] ?? t.errors.server) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <form action={action} className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-md space-y-5 self-start">
        <input type="hidden" name="locale" value={lang} />
        <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ productId: i.productId, qty: i.qty, thickness: i.thickness })))} />
        <div>
          <label htmlFor="c-name" className="field-label">{t.name}</label>
          <input id="c-name" name="name" required maxLength={120} autoComplete="name" className="field" />
        </div>
        <div>
          <label htmlFor="c-phone" className="field-label">{t.phone}</label>
          <input id="c-phone" name="phone" type="tel" required dir="ltr" autoComplete="tel" placeholder="+216 -- --- ---" className="field text-start" />
        </div>
        <div>
          <label htmlFor="c-address" className="field-label">{t.address}</label>
          <textarea id="c-address" name="address" required rows={3} maxLength={300} autoComplete="street-address" className="field h-auto py-3" />
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="payments" className="text-secondary" />
          {t.payment}
        </div>
        <label className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
          <input id="c-consent" name="consent" type="checkbox" required className="mt-1 w-4 h-4 shrink-0" />
          <span>
            {t.consentLabel}
            <Link href={`/${lang}/confidentialite`} className="text-primary font-semibold underline hover:text-secondary">
              {t.consentLink}
            </Link>
            .
          </span>
        </label>
        {error && (
          <p role="alert" className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 rounded-lg bg-secondary-container hover:bg-secondary-fixed disabled:opacity-60 text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold flex items-center justify-center gap-2"
        >
          <Icon name="check" className="text-[20px]" />
          {pending ? t.placing : t.place}
        </button>
      </form>

      <aside className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 shadow-sm self-start">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{t.summary}</h2>
          <button type="button" onClick={open} className="font-label-code text-label-code text-secondary font-bold hover:underline">
            {t.editCart}
          </button>
        </div>
        <ul className="divide-y divide-outline-variant/40">
          {items.map((item) => (
            <li key={item.key} className="flex gap-3 py-3">
              <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-surface-container-low">
                {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-label-metric text-label-metric text-primary truncate">{lang === "ar" ? item.nameAr : item.nameFr}</div>
                <div className="font-label-code text-label-code text-on-surface-variant">
                  × {item.qty}
                  {item.kind === "combo" && <span className="ms-1 px-1 rounded bg-secondary-container text-primary font-bold uppercase">{productT.comboBadge}</span>}
                  {item.thickness && ` · ${formatThickness(item.thickness, lang)}`}
                </div>
              </div>
              <div className="font-label-metric text-label-metric text-primary whitespace-nowrap">{formatPrice(item.priceMillimes * item.qty)}</div>
            </li>
          ))}
        </ul>
        <div className="pt-4 mt-2 border-t border-outline-variant/40 space-y-2 font-body-sm text-body-sm">
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t.subtotal}</span>
            <span className="text-primary">{price(subtotalMillimes)}</span>
          </div>
          {pricing.tierDiscountMillimes > 0 && (
            <div className="flex justify-between gap-2 text-secondary font-bold">
              <span>{t.volumeDiscount.replace("{percent}", String(Math.round(pricing.tier.discount * 100)))}</span>
              <span>−{price(pricing.tierDiscountMillimes)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-on-surface-variant">{t.delivery}</span>
            <span className={deliveryMillimes ? "text-primary" : "text-secondary font-bold"}>{deliveryMillimes ? price(deliveryMillimes) : t.freeDelivery}</span>
          </div>
          {deliveryMillimes > 0 && delivery.freeDeliveryFromMillimes > 0 && (
            <p className="text-secondary">{t.freeDeliveryFrom.replace("{amount}", price(delivery.freeDeliveryFromMillimes))}</p>
          )}
        </div>
        <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-outline-variant/40">
          <span className="font-label-metric text-label-metric uppercase text-on-surface-variant">{t.total}</span>
          <span className="font-headline-md text-headline-md text-primary font-bold">{price(totalMillimes + deliveryMillimes)}</span>
        </div>
      </aside>
    </div>
  );
}
