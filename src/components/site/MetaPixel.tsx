"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
declare global {
  interface Window {
    fbq?: Fbq;
    __metaCapi?: boolean;
    __metaFirstView?: boolean;
  }
}

export type MetaEventData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: "product";
  contents?: { id: string; quantity: number; item_price?: number }[];
  num_items?: number;
  order_id?: string;
};

/**
 * Sends a standard pixel event and, when the Conversions API is configured, the same event
 * through our server with the same event ID so Meta counts it once.
 */
export function trackMeta(name: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase", data: MetaEventData, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  const uid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const id = eventId ?? `${name}-${uid}`;
  window.fbq("track", name, data, { eventID: id });
  if (window.__metaCapi && name !== "Purchase") {
    fetch("/api/meta/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, id, url: window.location.href, customData: data }),
      keepalive: true,
    }).catch(() => {});
  }
}

/** Loads the Meta pixel (only when an ID is set in /admin/reglages) and tracks PageView on each navigation. */
export function MetaPixel({ pixelId, capi }: { pixelId: string; capi: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    window.__metaCapi = capi;
  }, [capi]);

  useEffect(() => {
    // The first PageView is sent by the init snippet; later ones follow client-side navigation.
    if (window.fbq && window.__metaFirstView) window.fbq("track", "PageView");
    window.__metaFirstView = true;
  }, [pathname]);

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');`}
    </Script>
  );
}
