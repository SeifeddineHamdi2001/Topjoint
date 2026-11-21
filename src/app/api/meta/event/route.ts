import { after, type NextRequest } from "next/server";
import { type MetaCustomData, metaServerEvents, sendMetaEvent, visitorFromHeaders } from "@/lib/meta";
import { clientIpFromHeaders, consumeMemoryLimit } from "@/lib/rateLimit";

// The browser pixel posts its funnel events here so they also reach Meta through the Conversions API.
// Purchase is not accepted here: placeOrder sends it with the real order data.
const allowed = new Set<string>(metaServerEvents.filter((e) => e !== "Purchase"));

function sanitizeCustomData(raw: unknown): MetaCustomData | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const out: MetaCustomData = {};

  if (typeof input.value === "number" && Number.isFinite(input.value) && input.value >= 0 && input.value <= 1_000_000) {
    out.value = input.value;
  }
  if (typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency)) {
    out.currency = input.currency;
  }
  if (input.content_type === "product") {
    out.content_type = "product";
  }
  if (Array.isArray(input.content_ids)) {
    const ids = input.content_ids
      .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)
      .slice(0, 50);
    if (ids.length) out.content_ids = ids;
  }
  if (Array.isArray(input.contents)) {
    const items = input.contents
      .slice(0, 50)
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const c = entry as Record<string, unknown>;
        if (typeof c.id !== "string" || !c.id || c.id.length > 64) return [];
        if (typeof c.quantity !== "number" || !Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 999) return [];
        const itemPrice =
          typeof c.item_price === "number" && Number.isFinite(c.item_price) && c.item_price >= 0 && c.item_price <= 100_000
            ? c.item_price
            : undefined;
        return [{ id: c.id, quantity: c.quantity, ...(itemPrice !== undefined && { item_price: itemPrice }) }];
      });
    if (items.length) out.contents = items;
  }
  if (typeof input.num_items === "number" && Number.isInteger(input.num_items) && input.num_items >= 0 && input.num_items <= 50_000) {
    out.num_items = input.num_items;
  }

  return Object.keys(out).length ? out : undefined;
}

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  if (!consumeMemoryLimit(`meta_ip:${ip}`, 60, 60_000)) {
    return new Response(null, { status: 429 });
  }

  const originHeader = request.headers.get("origin");
  const expectedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!originHeader || !expectedHost) return new Response(null, { status: 403 });
  try {
    if (new URL(originHeader).host !== expectedHost) return new Response(null, { status: 403 });
  } catch {
    return new Response(null, { status: 403 });
  }

  let body: { name?: string; id?: string; url?: string; customData?: unknown };
  try {
    const rawText = await request.text();
    if (rawText.length > 16_384) return new Response(null, { status: 413 });
    body = JSON.parse(rawText);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });

  const { name, id, url, customData } = body;
  if (!name || !allowed.has(name) || typeof id !== "string" || !id.trim() || id.length > 64 || typeof url !== "string" || url.length > 2000) {
    return new Response(null, { status: 400 });
  }
  try {
    const parsedUrl = new URL(url, request.url);
    if (parsedUrl.host !== expectedHost && parsedUrl.origin !== request.nextUrl.origin) {
      return new Response(null, { status: 400 });
    }
  } catch {
    return new Response(null, { status: 400 });
  }

  const visitor = visitorFromHeaders(request.headers, request.cookies);
  const safeCustomData = sanitizeCustomData(customData);
  after(() => sendMetaEvent({ name: name as (typeof metaServerEvents)[number], id, url, visitor, customData: safeCustomData }));
  return new Response(null, { status: 204 });
}
