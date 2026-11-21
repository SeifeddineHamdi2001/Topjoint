"use client";

import { useEffect } from "react";
import { trackMeta } from "./MetaPixel";

/** Product page view for Meta ads (ViewContent). Renders nothing. */
export function MetaViewContent({ productRef, priceTnd }: { productRef: string; priceTnd: number }) {
  useEffect(() => {
    // The pixel script may still be loading on a first visit: give it a moment.
    const timer = setTimeout(() => {
      trackMeta("ViewContent", { content_ids: [productRef], content_type: "product", value: priceTnd, currency: "TND" });
    }, window.fbq ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [productRef, priceTnd]);
  return null;
}
