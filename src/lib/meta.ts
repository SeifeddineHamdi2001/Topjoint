import "server-only";
import { createHash } from "node:crypto";
import { formatPrice as formatTnd } from "@/config/catalog";
import { db } from "./db";
import { getShopSettings } from "./settings";

// Meta Conversions API. ViewContent / AddToCart / InitiateCheckout are server-side copies of the pixel
// events (Meta drops the duplicate when name + event_id match). Purchase is sent when the customer
// clicks "Confirmer la commande", from the browser and from placeOrder (sendOrderPurchase).

const GRAPH_URL = "https://graph.facebook.com/v21.0";

export const metaServerEvents = ["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"] as const;
export type MetaServerEvent = (typeof metaServerEvents)[number];

export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: "product";
  contents?: { id: string; quantity: number; item_price?: number }[];
  num_items?: number;
  order_id?: string;
};

export type MetaVisitor = {
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string;
  fbc?: string;
  phone?: string;
  name?: string;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Meta wants phone numbers as digits with the country code: 8-digit numbers are Tunisian. */
function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return digits.length === 8 ? `216${digits}` : digits;
}

function userData(visitor: MetaVisitor) {
  const [first, ...rest] = (visitor.name ?? "").trim().toLowerCase().split(/\s+/);
  return {
    ...(visitor.ip && { client_ip_address: visitor.ip }),
    ...(visitor.userAgent && { client_user_agent: visitor.userAgent }),
    ...(visitor.fbp && { fbp: visitor.fbp }),
    ...(visitor.fbc && { fbc: visitor.fbc }),
    ...(visitor.phone && { ph: [sha256(normalizePhone(visitor.phone))] }),
    ...(first && { fn: [sha256(first)] }),
    ...(rest.length > 0 && { ln: [sha256(rest.join(" "))] }),
    country: [sha256("tn")],
  };
}

/** Sends one event; does nothing unless both the pixel ID and the access token are set. Never throws; true when Meta accepted it. */
export async function sendMetaEvent(event: {
  name: MetaServerEvent;
  id: string;
  url: string;
  visitor: MetaVisitor;
  customData?: MetaCustomData;
}) {
  try {
    const { metaPixelId, metaAccessToken, metaTestEventCode } = await getShopSettings();
    if (!/^\d{6,20}$/.test(metaPixelId) || !metaAccessToken) return false;
    const body = {
      data: [
        {
          event_name: event.name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event.id,
          event_source_url: event.url,
          action_source: "website",
          user_data: userData(event.visitor),
          ...(event.customData && { custom_data: event.customData }),
        },
      ],
      ...(metaTestEventCode && { test_event_code: metaTestEventCode }),
    };
    const res = await fetch(`${GRAPH_URL}/${metaPixelId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${metaAccessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("Meta CAPI", event.name, res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Meta CAPI failed", err instanceof Error ? err.message : "unknown error");
    return false;
  }
}

/** Browser details saved on the order at checkout (Order.metaVisitor). */
export type StoredVisitor = { ip?: string | null; userAgent?: string | null; fbp?: string; fbc?: string; url?: string };

/** Server-side Purchase for an order just placed, with the browser details saved at checkout. Sent at most once per order. */
export async function sendOrderPurchase(orderId: number) {
  const { metaPixelId, metaAccessToken } = await getShopSettings();
  if (!/^\d{6,20}$/.test(metaPixelId) || !metaAccessToken) return;
  // Claim the order first so two quick status changes can't send it twice.
  const claimed = await db.order.updateMany({ where: { id: orderId, metaPurchaseSentAt: null }, data: { metaPurchaseSentAt: new Date() } });
  if (claimed.count === 0) return;

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const stored = (order.metaVisitor ?? {}) as StoredVisitor;
  const ok = await sendMetaEvent({
    name: "Purchase",
    id: `order-${order.id}`,
    url: stored.url ?? "",
    visitor: { ip: stored.ip, userAgent: stored.userAgent, fbp: stored.fbp, fbc: stored.fbc, phone: order.phone, name: order.customerName },
    customData: {
      value: order.totalMillimes / 1000,
      currency: "TND",
      content_type: "product",
      content_ids: order.items.map((i) => i.ref),
      contents: order.items.map((i) => ({ id: i.ref, quantity: i.quantity, item_price: i.unitPriceMillimes / 1000 })),
      num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
      order_id: String(order.id),
    },
  });
  if (ok) {
    await db.orderEvent.create({ data: { orderId, message: `Vente envoyée à Meta (${formatTnd(order.totalMillimes)} TND)` } });
  } else {
    // Not marked as sent, so it can be retried.
    await db.order.update({ where: { id: orderId }, data: { metaPurchaseSentAt: null } });
  }
}

/** Visitor details Meta uses for matching, read from the incoming request. */
export function visitorFromHeaders(headers: Headers, cookies: { get(name: string): { value: string } | undefined }): MetaVisitor {
  return {
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip"),
    userAgent: headers.get("user-agent"),
    fbp: cookies.get("_fbp")?.value,
    fbc: cookies.get("_fbc")?.value,
  };
}

const HOST_RE = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

/** Builds a validated source URL for CAPI events from incoming request headers. */
export function resolveSourceUrl(headers: Headers, pathname: string): string {
  const originHeader = headers.get("origin");
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      if ((parsed.protocol === "https:" || parsed.protocol === "http:") && HOST_RE.test(parsed.host)) {
        return `${parsed.origin}${pathname}`;
      }
    } catch {}
  }
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
  if (host && HOST_RE.test(host)) {
    const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "http" ? "http" : "https";
    return `${proto}://${host}${pathname}`;
  }
  return "";
}
