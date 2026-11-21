"use client";

import { useState } from "react";
import { formatPrice } from "@/config/catalog";
import { Icon } from "../Icon";
import { useCart, type CartProduct } from "./CartProvider";
import { QtyStepper } from "./QtyStepper";

type Props = {
  product: CartProduct;
  currency: string;
  labels: {
    add: string;
    thickness: string;
    chooseThickness: string;
    thicknessRequired: string;
    comboVariantRequired: string;
    quantity: string;
    decrease: string;
    increase: string;
  };
};

/** Compact add-to-cart for product cards (2 per row on mobile). */
export function AddToCart({ product, currency, labels }: Props) {
  const { add } = useCart();
  const variants = product.variants;
  const [qty, setQty] = useState(1);
  const [thickness, setThickness] = useState(variants.length === 1 ? variants[0].mm : "");
  const [missing, setMissing] = useState(false);

  return (
    <div className="space-y-2">
      {variants.length > 0 && (
        <select
          aria-label={labels.thickness}
          value={thickness}
          onChange={(event) => {
            setThickness(event.target.value);
            setMissing(false);
          }}
          className={`field h-9 text-[12px] ${missing ? "border-error" : ""}`}
        >
          <option value="">{labels.chooseThickness}</option>
          {variants.map((variant) => {
            let label = `${variant.mm} mm`;
            if (variant.mm.includes("+")) {
              const parts = variant.mm.split("+").map((p) => p.trim());
              if (parts.length === 2) {
                label =
                  currency === "د.ت"
                    ? `رأس ${parts[0]} مم + قميص ${parts[1]} مم`
                    : `Culasse ${parts[0]} mm + Chemise ${parts[1]} mm`;
              }
            }
            return (
              <option key={variant.mm} value={variant.mm}>
                {label} — {formatPrice(variant.priceMillimes)} {currency}
              </option>
            );
          })}
        </select>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <QtyStepper
          value={qty}
          onChange={setQty}
          size="md"
          className="w-full justify-between sm:w-auto"
          labels={{ quantity: labels.quantity, decrease: labels.decrease, increase: labels.increase }}
        />
        <button
          type="button"
          onClick={() => {
            if (variants.length > 0 && !thickness) return setMissing(true);
            add(product, qty, thickness);
          }}
          className="w-full h-10 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-metric text-label-metric font-bold uppercase flex items-center justify-center gap-1.5 transition-colors sm:flex-1"
        >
          <Icon name="add_shopping_cart" className="text-[18px]" />
          {labels.add}
        </button>
      </div>
      {missing && <p className="font-body-sm text-[11px] text-error">{product.kind === "combo" ? labels.comboVariantRequired : labels.thicknessRequired}</p>}
    </div>
  );
}
