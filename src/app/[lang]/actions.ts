"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { isLocale, type Locale } from "@/config/site";
import { priceCart } from "@/config/pricing";
import { deliveryFor } from "@/config/delivery";
import { MAX_INT4, db, toInt32 } from "@/lib/db";
import { type StoredVisitor, resolveSourceUrl, sendOrderPurchase, visitorFromHeaders } from "@/lib/meta";
import { clientIpFromHeaders, consumePublicLimit } from "@/lib/rateLimit";
import { getShopSettings } from "@/lib/settings";
import { InvalidUploadError, deleteUpload, isAcceptable, saveUpload } from "@/lib/storage";
import { resolveProductVariants } from "@/lib/variants";

export type FormState = { status: "idle" | "success" | "error"; error?: string; orderId?: number; valueMillimes?: number };

const SUBJECTS = ["devis-sur-mesure", "commande-standard", "grande-serie", "autre"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d][\d\s().-]{6,19}$/;

function text(form: FormData, key: string, max = 200) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function localeOf(form: FormData): Locale {
  const value = text(form, "locale", 2);
  return isLocale(value) ? value : "fr";
}

/** Homepage "demande de devis & contact" form → QuoteRequest row shown in /admin/demandes. */
export async function submitQuote(_prev: FormState, form: FormData): Promise<FormState> {
  // Honeypot: real visitors never see or fill this field.
  if (text(form, "website")) return { status: "success" };

  const ip = clientIpFromHeaders(await headers());
  const limit = await consumePublicLimit(`quote_ip:${ip}`, 5);
  if (!limit.allowed) return { status: "error", error: "rateLimit" };

  const data = {
    name: text(form, "name", 120),
    company: text(form, "company", 160) || null,
    email: text(form, "email", 160).toLowerCase(),
    phone: text(form, "phone", 30),
    subject: text(form, "subject", 40),
    message: text(form, "message", 5000),
    locale: localeOf(form),
  };

  if (!data.name || !data.email || !data.phone || !data.message || !SUBJECTS.includes(data.subject)) {
    return { status: "error", error: "required" };
  }
  if (form.get("consent") !== "on") return { status: "error", error: "consent" };
  if (!EMAIL.test(data.email)) return { status: "error", error: "email" };
  if (!PHONE.test(data.phone)) return { status: "error", error: "phone" };

  // Optional technical file (plan, photo), stored privately and downloadable from the admin only.
  const file = form.get("attachment");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && !isAcceptable(file, "private")) return { status: "error", error: "file" };

  let attachmentPath: string | null = null;
  try {
    if (hasFile) attachmentPath = await saveUpload(file, "private");
    await db.quoteRequest.create({
      data: { ...data, attachmentPath, attachmentName: hasFile ? file.name.slice(0, 255) : null },
    });
  } catch (err) {
    await deleteUpload(attachmentPath, "private");
    if (err instanceof InvalidUploadError) return { status: "error", error: "file" };
    console.error("submitQuote failed", err);
    return { status: "error", error: "server" };
  }
  revalidatePath("/admin", "layout");
  return { status: "success" };
}

type OrderLine = { productId: number; qty: number; thickness: string };

/** Cart checkout (cash on delivery). Prices and pack discounts are always recomputed from the database. */
export async function placeOrder(_prev: FormState, form: FormData): Promise<FormState> {
  const headerList = await headers();
  const limit = await consumePublicLimit(`order_ip:${clientIpFromHeaders(headerList)}`, 10);
  if (!limit.allowed) return { status: "error", error: "rateLimit" };

  const customer = {
    customerName: text(form, "name", 120),
    phone: text(form, "phone", 30),
    address: text(form, "address", 300),
    locale: localeOf(form),
  };
  if (!customer.customerName || !customer.phone || !customer.address) return { status: "error", error: "required" };
  if (form.get("consent") !== "on") return { status: "error", error: "consent" };
  if (!PHONE.test(customer.phone)) return { status: "error", error: "phone" };

  const deduped = new Map<string, OrderLine>();
  try {
    const parsed: unknown = JSON.parse(text(form, "items", 20000));
    if (Array.isArray(parsed)) {
      for (const raw of parsed) {
        if (!raw || typeof raw !== "object") continue;
        const l = raw as Partial<OrderLine>;
        const productId = toInt32(Number(l.productId), 1);
        const qty = Math.floor(Number(l.qty));
        const thickness = String(l.thickness ?? "").slice(0, 30);
        if (!productId || !Number.isInteger(qty) || qty <= 0 || qty > 999) continue;
        const key = `${productId}:${thickness}`;
        const existing = deduped.get(key);
        if (existing) {
          existing.qty = Math.min(999, existing.qty + qty);
        } else if (deduped.size < 50) {
          deduped.set(key, { productId, qty, thickness });
        } else {
          return { status: "error", error: "server" };
        }
      }
    }
  } catch {
    deduped.clear();
  }
  const lines = Array.from(deduped.values());
  if (lines.length === 0) return { status: "error", error: "empty" };

  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) }, active: true },
    include: {
      variants: { orderBy: { position: "asc" } },
      comboCulasse: { select: { ref: true, priceMillimes: true, variants: { select: { mm: true, priceMillimes: true }, orderBy: { position: "asc" } } } },
      comboChemise: { select: { ref: true, priceMillimes: true, variants: { select: { mm: true, priceMillimes: true }, orderBy: { position: "asc" } } } },
    },
  });
  const items = lines.flatMap((line) => {
    const p = products.find((x) => x.id === line.productId);
    if (!p) return [];
    const availableVariants = resolveProductVariants(p);
    // Only accept an épaisseur the product actually offers, and use its own price.
    const variant = availableVariants.find((v) => v.mm === line.thickness);
    if (availableVariants.length > 0 && !variant) return [];
    const comboRefs = [p.comboCulasse?.ref, p.comboChemise?.ref].filter(Boolean);
    return [
      {
        productId: p.id,
        ref: p.ref,
        name: p.kind === "combo" && comboRefs.length ? `${p.nameFr} (${comboRefs.join(" + ")})` : p.nameFr,
        thickness: variant?.mm ?? null,
        unitPriceMillimes: variant?.priceMillimes ?? p.priceMillimes,
        quantity: line.qty,
      },
    ];
  });
  if (items.length === 0) return { status: "error", error: "empty" };

  // Quantity discounts, recomputed from the database — never trusted from the browser.
  const pricing = priceCart(items.map((item) => ({ priceMillimes: item.unitPriceMillimes, qty: item.quantity })));
  const subtotal = pricing.totalMillimes;
  // Browser details Meta uses to match the Purchase to the ad click (sent below by sendOrderPurchase).
  const cookieJar = await cookies();
  const url = resolveSourceUrl(headerList, `/${customer.locale}/commande`);
  const metaVisitor: StoredVisitor = { ...visitorFromHeaders(headerList, cookieJar), ...(url && { url }) };
  const deliveryMillimes = deliveryFor(subtotal, await getShopSettings());
  if (subtotal + deliveryMillimes > MAX_INT4) return { status: "error", error: "server" };

  try {
    const order = await db.order.create({
      data: {
        ...customer,
        deliveryMillimes,
        discountMillimes: pricing.discountMillimes,
        totalMillimes: subtotal + deliveryMillimes,
        metaVisitor,
        items: { create: items },
        events: { create: { status: "NEW", message: "Commande passée sur le site" } },
      },
    });
    revalidatePath("/admin", "layout");
    // Server-side Purchase (Conversions API) after the response; the browser pixel sends the same event ID.
    after(() => sendOrderPurchase(order.id));
    return { status: "success", orderId: order.id, valueMillimes: order.totalMillimes };
  } catch (err) {
    console.error("placeOrder failed", err);
    return { status: "error", error: "server" };
  }
}
