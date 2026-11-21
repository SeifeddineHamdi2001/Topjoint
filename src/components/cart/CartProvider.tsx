"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/config/catalog";
import { type CartPricing, priceCart } from "@/config/pricing";
import { trackMeta } from "@/components/site/MetaPixel";

export type CartVariant = { mm: string; priceMillimes: number };

export type CartItem = {
  key: string; // productId + thickness: the same gasket in two thicknesses is two lines
  productId: number;
  slug: string;
  ref: string;
  nameFr: string;
  nameAr: string;
  image: string;
  category: string; // joint type
  application: string;
  kind: string; // standard | combo
  cc: number | null;
  thickness: string;
  /** Unit price for the chosen épaisseur (discounts are applied to the whole cart). */
  priceMillimes: number;
  qty: number;
};

export type CartProduct = {
  productId: number;
  slug: string;
  ref: string;
  nameFr: string;
  nameAr: string;
  image: string;
  category: string;
  application: string;
  kind: string;
  cc: number | null;
  /** Base price, used when the product has no épaisseur variants. */
  priceMillimes: number;
  variants: CartVariant[];
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalMillimes: number;
  discountMillimes: number;
  totalMillimes: number;
  pricing: CartPricing;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (product: CartProduct, qty: number, thickness: string, options?: { openDrawer?: boolean }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "topjoint-cart-v3";

export function lineTotal(item: CartItem) {
  return item.priceMillimes * item.qty;
}

/** Unit price of a product for the selected épaisseur. */
export function unitPriceOf(product: CartProduct, thickness: string) {
  return product.variants.find((variant) => variant.mm === thickness)?.priceMillimes ?? product.priceMillimes;
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.key === "string" &&
    typeof item.productId === "number" &&
    typeof item.priceMillimes === "number" &&
    Number.isFinite(item.priceMillimes) &&
    typeof item.qty === "number" &&
    item.qty > 0
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem));
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, loaded]);

  const add = useCallback((product: CartProduct, qty: number, thickness: string, options?: { openDrawer?: boolean }) => {
    const price = unitPriceOf(product, thickness);
    trackMeta("AddToCart", {
      content_ids: [product.ref],
      content_type: "product",
      contents: [{ id: product.ref, quantity: qty, item_price: Number(formatPrice(price)) }],
      value: Number(formatPrice(price * qty)),
      currency: "TND",
    });
    const key = `${product.productId}:${thickness}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, priceMillimes: price, qty: Math.min(i.qty + qty, 999) } : i));
      }
      return [
        ...prev,
        {
          key,
          productId: product.productId,
          slug: product.slug,
          ref: product.ref,
          nameFr: product.nameFr,
          nameAr: product.nameAr,
          image: product.image,
          category: product.category,
          application: product.application,
          kind: product.kind,
          cc: product.cc,
          thickness,
          priceMillimes: price,
          qty: Math.max(1, Math.min(qty, 999)),
        },
      ];
    });
    if (options?.openDrawer !== false) setIsOpen(true);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, 999)) } : i)));
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const pricing = useMemo(() => priceCart(items.map((item) => ({ priceMillimes: item.priceMillimes, qty: item.qty }))), [items]);

  const value = useMemo(
    () => ({
      items,
      count: pricing.count,
      subtotalMillimes: pricing.subtotalMillimes,
      discountMillimes: pricing.discountMillimes,
      totalMillimes: pricing.totalMillimes,
      pricing,
      isOpen,
      open,
      close,
      add,
      setQty,
      remove,
      clear,
    }),
    [items, pricing, isOpen, open, close, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
