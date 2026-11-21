"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { applications, categories, ccOptions, formatPrice } from "@/config/catalog";
import type { OrderStatus, Prisma } from "@prisma/client";
import { isOrderStatus, isQuoteStatus, orderStatuses, stockHoldingStatuses } from "@/config/admin";
import {
  authenticate,
  checkLoginRateLimit,
  clearLoginFailures,
  endSession,
  getVerifiedAdminSession,
  hashPassword,
  recordLoginFailure,
  requireAdmin,
  requireOwner,
  startSession,
  validatePasswordPolicy,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { invalidateCatalogCache } from "@/lib/catalogCache";
import { runPrivacyCleanup } from "@/lib/privacy";
import { clientIpFromHeaders } from "@/lib/rateLimit";
import { saveShopSettings, getShopSettings } from "@/lib/settings";
import { MAX_INT4, db, isUniqueViolation, toInt32 } from "@/lib/db";
import { deleteUpload, InvalidUploadError, isAcceptable, saveUpload } from "@/lib/storage";

function str(form: FormData, key: string, max = 500) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function rawPassword(form: FormData, key: string, max = 200) {
  const value = form.get(key);
  return typeof value === "string" ? value.slice(0, max) : "";
}

// ---- Auth ----

export async function login(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const email = str(form, "email", 160);
  const password = rawPassword(form, "password");
  const ip = clientIpFromHeaders(await headers());

  const limit = await checkLoginRateLimit(ip, email);
  if (!limit.allowed) {
    await recordAudit({ action: "auth.login.rate_limited", target: email.toLowerCase(), ip });
    return { error: `Trop de tentatives. Réessayez dans ${limit.retryMinutes} min.` };
  }

  const session = await authenticate(email, password);
  if (!session) {
    await recordLoginFailure(ip, email);
    await recordAudit({ action: "auth.login.failed", target: email.toLowerCase(), ip });
    // Small delay to slow down password guessing.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Identifiants incorrects." };
  }
  await clearLoginFailures(ip, email);
  await startSession(session);
  await recordAudit({ action: "auth.login.success", actor: session, target: session.email, ip });
  redirect(session.role === "owner" ? "/admin" : "/admin/commandes");
}

export async function logout() {
  const session = await getVerifiedAdminSession();
  await endSession();
  if (session) await recordAudit({ action: "auth.logout", actor: session, target: session.email });
  redirect("/admin/login");
}

// ---- Quote requests (homepage form) ----

export async function markQuoteInProgress(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  if (!id) return;
  const res = await db.quoteRequest.updateMany({
    where: { id, status: "NEW" },
    data: { status: "IN_PROGRESS", handledAt: new Date() },
  });
  if (res.count > 0) await recordAudit({ action: "quote.mark_in_progress", actor: owner, target: `quote:${id}` });
  revalidatePath("/admin", "layout");
}

export async function updateQuote(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  const status = str(form, "status");
  if (!id || !isQuoteStatus(status)) return;
  const updated = await db.quoteRequest
    .update({ where: { id }, data: { status, adminNote: str(form, "adminNote", 5000) || null } })
    .catch(() => null);
  if (updated) {
    if (status !== "NEW") await db.quoteRequest.updateMany({ where: { id, handledAt: null }, data: { handledAt: new Date() } });
    await recordAudit({ action: "quote.update", actor: owner, target: `quote:${id}`, detail: `status=${status}` });
  }
  revalidatePath("/admin", "layout");
}

export async function deleteQuote(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  if (!id) return;
  const quote = await db.quoteRequest.delete({ where: { id } }).catch(() => null);
  await deleteUpload(quote?.attachmentPath, "private");
  if (quote) await recordAudit({ action: "quote.delete", actor: owner, target: `quote:${id}` });
  revalidatePath("/admin", "layout");
  redirect("/admin/demandes");
}

// ---- Orders (owner and staff) ----

type OrderChange = { status: OrderStatus; adminNote?: string | null; deliveryMillimes?: number; call?: string };

type StockItem = { productId: number | null; quantity: number };

/**
 * Moves ordered items in or out of stock. A combo article also moves its two
 * component joints, so selling a combo decrements the culasse and the chemise.
 * Stock never goes below zero (0 = "sur commande" in the public catalogue).
 */
async function adjustStock(tx: Prisma.TransactionClient, items: StockItem[], direction: "out" | "in") {
  const productIds = items.flatMap((item) => (item.productId ? [item.productId] : []));
  if (productIds.length === 0) return;

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, kind: true, comboCulasseId: true, comboChemiseId: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const deltas = new Map<number, number>();
  const add = (productId: number, quantity: number) => deltas.set(productId, (deltas.get(productId) ?? 0) + quantity);

  for (const item of items) {
    if (!item.productId) continue;
    const product = byId.get(item.productId);
    if (!product) continue;
    const delta = (direction === "out" ? -1 : 1) * item.quantity;
    add(product.id, delta);
    if (product.kind === "combo") {
      if (product.comboCulasseId) add(product.comboCulasseId, delta);
      if (product.comboChemiseId) add(product.comboChemiseId, delta);
    }
  }

  const sortedDeltas = Array.from(deltas.entries()).sort(([a], [b]) => a - b);
  for (const [productId, delta] of sortedDeltas) {
    if (!delta) continue;
    await tx.$executeRaw`UPDATE "Product" SET stock = GREATEST(stock + ${delta}, 0) WHERE id = ${productId}`;
  }
}

/**
 * Applies a status / note / delivery change and keeps stock and the timeline in sync.
 * Confirmed, shipped or delivered orders hold their items out of stock; any other status puts them back.
 */
async function changeOrder(id: number, change: OrderChange, actor: string, options?: { skipRevalidate?: boolean }) {
  await db.$transaction(async (tx) => {
    // Lock the order row for the transaction so concurrent status updates cannot double-move stock.
    await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return;
    const { status } = change;
    const holdStock = stockHoldingStatuses.includes(status);
    const stockChange = holdStock && !order.stockDeducted ? -1 : !holdStock && order.stockDeducted ? 1 : 0;
    if (stockChange) await adjustStock(tx, order.items, stockChange < 0 ? "out" : "in");

    const subtotal = order.totalMillimes + order.discountMillimes - order.deliveryMillimes;
    const delivery = change.deliveryMillimes ?? order.deliveryMillimes;
    const adminNote = change.adminNote === undefined ? order.adminNote : change.adminNote;
    await tx.order.update({
      where: { id },
      data: {
        status,
        adminNote,
        stockDeducted: holdStock,
        deliveryMillimes: delivery,
        totalMillimes: subtotal - order.discountMillimes + delivery,
        ...(change.call && { callAttempts: { increment: 1 }, lastCallAt: new Date() }),
      },
    });

    const events: { status?: OrderStatus; message: string }[] = [];
    if (change.call) events.push({ message: `Appel n°${order.callAttempts + 1} : ${change.call}` });
    if (status !== order.status) events.push({ status, message: `Statut : ${orderStatuses[order.status].label} → ${orderStatuses[status].label}` });
    if (stockChange) events.push({ message: stockChange < 0 ? "Articles retirés du stock" : "Articles remis en stock" });
    if (delivery !== order.deliveryMillimes) events.push({ message: `Livraison : ${formatPrice(order.deliveryMillimes)} → ${formatPrice(delivery)} TND` });
    if (adminNote !== order.adminNote) events.push({ message: "Note interne modifiée" });
    if (events.length) await tx.orderEvent.createMany({ data: events.map((e) => ({ orderId: id, actor, ...e })) });
  });
  invalidateCatalogCache();
  if (!options?.skipRevalidate) revalidatePath("/", "layout");
}

export async function updateOrder(form: FormData) {
  const admin = await requireAdmin();
  const id = toInt32(Number(form.get("id")), 1);
  const status = str(form, "status");
  if (!id || !isOrderStatus(status)) return;
  const delivery = Number(str(form, "delivery").replace(",", "."));
  await changeOrder(
    id,
    {
      status,
      adminNote: str(form, "adminNote", 5000) || null,
      ...(Number.isFinite(delivery) && delivery >= 0 && delivery <= 2_000_000 && { deliveryMillimes: Math.round(delivery * 1000) }),
    },
    admin.name,
  );
  await recordAudit({ action: "order.update", actor: admin, target: `order:${id}`, detail: `status=${status}` });
}

const callOutcomes = {
  confirmed: { status: "CONFIRMED", message: "client joint, commande confirmée" },
  no_answer: { status: "NO_ANSWER", message: "pas de réponse" },
  cancelled: { status: "CANCELLED", message: "client joint, commande annulée" },
} as const satisfies Record<string, { status: OrderStatus; message: string }>;

/** Result of the confirmation phone call (cash on delivery). */
export async function recordCall(form: FormData) {
  const admin = await requireAdmin();
  const id = toInt32(Number(form.get("id")), 1);
  const outcome = str(form, "outcome") as keyof typeof callOutcomes;
  if (!id || !Object.hasOwn(callOutcomes, outcome)) return;
  const note = str(form, "callNote", 200);
  const { status, message } = callOutcomes[outcome];
  await changeOrder(id, { status, call: note ? `${message} — ${note}` : message }, admin.name);
  await recordAudit({ action: "order.call", actor: admin, target: `order:${id}`, detail: `outcome=${outcome}` });
}

/** One-click status change (delivery tracking buttons). Keeps the note and delivery fee. */
export async function setOrderStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = toInt32(Number(form.get("id")), 1);
  const status = str(form, "status");
  if (!id || !isOrderStatus(status)) return;
  await changeOrder(id, { status }, admin.name);
  await recordAudit({ action: "order.status", actor: admin, target: `order:${id}`, detail: `status=${status}` });
}

/** Orders list: same status for every ticked order (e.g. the courier's daily report). */
export async function bulkSetOrderStatus(form: FormData) {
  const admin = await requireAdmin();
  const status = str(form, "status");
  const ids = form
    .getAll("ids")
    .map((value) => toInt32(Number(value), 1))
    .filter((id): id is number => id !== null);
  if (!isOrderStatus(status) || ids.length === 0) return;
  const batch = ids.slice(0, 200);
  for (const id of batch) await changeOrder(id, { status }, admin.name, { skipRevalidate: true });
  invalidateCatalogCache();
  revalidatePath("/", "layout");
  await recordAudit({ action: "order.bulk_status", actor: admin, detail: `status=${status}, count=${batch.length}` });
}

/** Owner only: staff can change statuses but never delete an order. */
export async function deleteOrder(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  if (!id) return;
  let deleted = false;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return;
    if (order.stockDeducted) await adjustStock(tx, order.items, "in");
    await tx.order.delete({ where: { id } });
    deleted = true;
  });
  if (deleted) await recordAudit({ action: "order.delete", actor: owner, target: `order:${id}` });
  invalidateCatalogCache();
  revalidatePath("/", "layout");
  redirect("/admin/commandes");
}

// ---- Products ----

export type ProductFormState = { error?: string };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function deletePublicUploadIfUnused(imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith("/api/uploads/")) return;
  const inUse = await db.product.count({ where: { image: imageUrl } });
  if (inUse > 0) return;
  await deleteUpload(imageUrl.split("/").pop(), "public");
}

export async function saveProduct(_prev: ProductFormState, form: FormData): Promise<ProductFormState> {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  const ref = str(form, "ref", 40).toUpperCase();
  const nameFr = str(form, "nameFr", 200);
  const nameAr = str(form, "nameAr", 200);
  let category = str(form, "category", 40);
  if (category === "autre") {
    category = str(form, "customCategory", 40).trim();
  }
  let application = str(form, "application", 40);
  if (application === "autre") {
    application = str(form, "customApplication", 40).trim();
  }
  const material = str(form, "material", 100).trim();
  const kind = str(form, "kind", 20) || "standard";
  const price = Number(str(form, "price").replace(",", "."));
  const stock = Math.min(MAX_INT4, Math.max(0, Math.floor(Number(str(form, "stock")) || 0)));
  let ccValue = str(form, "cc", 10);
  if (ccValue === "autre") {
    ccValue = str(form, "customCc", 10).trim();
  }
  const cc = ccValue ? Number.parseInt(ccValue, 10) : null;

  if (!ref || !nameFr || !nameAr) return { error: "Référence, nom français et nom arabe sont obligatoires." };
  if (!category) return { error: "Type de joint obligatoire." };
  if (!application) return { error: "Application obligatoire." };
  if (kind !== "standard" && kind !== "combo") return { error: "Type d'article invalide." };
  if (cc !== null && (!Number.isInteger(cc) || cc <= 0 || cc > 20000)) {
    return { error: "Cylindrée invalide : indiquez un nombre entier positif." };
  }
  if (!Number.isFinite(price) || price < 0 || price > 2_000_000) return { error: "Prix invalide." };

  // A combo joins one standard culasse product and one standard chemise product.
  let comboCulasseId: number | null = null;
  let comboChemiseId: number | null = null;
  if (kind === "combo") {
    comboCulasseId = toInt32(Number(str(form, "comboCulasseId")), 1);
    comboChemiseId = toInt32(Number(str(form, "comboChemiseId")), 1);
    if (!comboCulasseId || !comboChemiseId) return { error: "Choisissez un joint de culasse et un joint de chemise pour le combo." };
    if (comboCulasseId === comboChemiseId) return { error: "Le joint de culasse et le joint de chemise doivent être deux produits différents." };
    if (id && (comboCulasseId === id || comboChemiseId === id)) return { error: "Un combo ne peut pas se contenir lui-même." };
    const components = await db.product.findMany({
      where: { id: { in: [comboCulasseId, comboChemiseId] } },
      select: { id: true, kind: true, category: true },
    });
    const culasse = components.find((component) => component.id === comboCulasseId);
    const chemise = components.find((component) => component.id === comboChemiseId);
    if (!culasse || culasse.kind !== "standard" || culasse.category !== "culasse") {
      return { error: "Le joint de culasse choisi est introuvable ou n'est pas un produit standard de type culasse." };
    }
    if (!chemise || chemise.kind !== "standard" || chemise.category !== "chemise") {
      return { error: "Le joint de chemise choisi est introuvable ou n'est pas un produit standard de type chemise." };
    }
  }

  // Épaisseur rows: two parallel fields (mm / mmPrice) in the order they appear on screen.
  // Combo variants may use labels such as "0.8+0.5"; standard products keep a numeric mm.
  const mmValues = form.getAll("mm");
  const priceValues = form.getAll("mmPrice");
  const variants: { mm: string; priceMillimes: number; position: number }[] = [];
  for (let index = 0; index < Math.max(mmValues.length, priceValues.length); index++) {
    const mmEntry = mmValues[index];
    const priceEntry = priceValues[index];
    const rawMm = typeof mmEntry === "string" ? mmEntry.trim() : "";
    const rawPrice = typeof priceEntry === "string" ? priceEntry.trim() : "";
    if (!rawMm && !rawPrice) continue;
    const mm =
      kind === "combo"
        ? rawMm.replace(/[^\d.+\-/ ]/g, "").replace(/\s+/g, " ").trim().slice(0, 30)
        : rawMm.replace(",", ".").replace(/[^\d.]/g, "").slice(0, 30);
    const variantPrice = Number(rawPrice.replace(",", "."));
    if (!mm || mm === "." || !Number.isFinite(variantPrice) || variantPrice < 0 || variantPrice > 2_000_000) {
      return { error: kind === "combo" ? "Épaisseur ou prix du combo invalide." : "Épaisseur ou prix d'épaisseur invalide." };
    }
    if (variants.some((variant) => variant.mm.toLowerCase() === mm.toLowerCase())) {
      return { error: `L'épaisseur ${mm} est en double.` };
    }
    variants.push({ mm, priceMillimes: Math.round(variantPrice * 1000), position: variants.length });
  }
  if (variants.length > 20) return { error: "20 variantes maximum par produit." };

  const data = {
    ref,
    slug: `${slugify(nameFr)}-${slugify(ref)}`.slice(0, 120),
    nameFr,
    nameAr,
    descriptionFr: str(form, "descriptionFr", 5000),
    descriptionAr: str(form, "descriptionAr", 5000),
    category,
    application,
    material,
    kind,
    comboCulasseId,
    comboChemiseId,
    dimensions: str(form, "dimensions", 200),
    compatibility: str(form, "compatibility", 200),
    cc,
    priceMillimes: Math.round(price * 1000),
    stock,
    featured: form.get("featured") === "on",
    active: form.get("active") === "on",
  };

  const photo = form.get("photo");
  let image: string | undefined;
  let uploadedImage: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (!isAcceptable(photo, "public")) return { error: "Photo refusée : JPG, PNG ou WEBP, 10 Mo max." };
    try {
      uploadedImage = `/api/uploads/${await saveUpload(photo, "public")}`;
      image = uploadedImage;
    } catch (err) {
      if (err instanceof InvalidUploadError) return { error: "Photo invalide : fichier JPG, PNG ou WEBP corrompu ou falsifié." };
      throw err;
    }
  }
  // A new combo without its own photo uses the culasse photo, so the shop card is never blank.
  if (!image && kind === "combo" && !id && comboCulasseId) {
    const component = await db.product.findUnique({ where: { id: comboCulasseId }, select: { image: true } });
    if (component?.image) image = component.image;
  }

  try {
    if (id) {
      const previous = await db.product.findUnique({ where: { id } });
      await db.product.update({
        where: { id },
        data: {
          ...data,
          ...(image && { image }),
          variants: { deleteMany: {}, create: variants },
        },
      });
      if (image && previous?.image && previous.image !== image) await deletePublicUploadIfUnused(previous.image);
      await recordAudit({ action: "product.update", actor: owner, target: `product:${id}`, detail: `ref=${ref}` });
    } else {
      const created = await db.product.create({ data: { ...data, image: image ?? "", variants: { create: variants } } });
      await recordAudit({ action: "product.create", actor: owner, target: `product:${created.id}`, detail: `ref=${ref}` });
    }
  } catch (err) {
    if (uploadedImage) await deleteUpload(uploadedImage.split("/").pop(), "public");
    if (isUniqueViolation(err)) return { error: "Cette référence existe déjà." };
    console.error("saveProduct failed", err);
    return { error: "Erreur lors de l'enregistrement." };
  }

  invalidateCatalogCache();
  revalidatePath("/", "layout");
  redirect("/admin/produits");
}

export async function deleteProduct(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  if (!id) return;
  const product = await db.product.delete({ where: { id } }).catch(() => null);
  await deletePublicUploadIfUnused(product?.image);
  if (product) await recordAudit({ action: "product.delete", actor: owner, target: `product:${id}`, detail: `ref=${product.ref}` });
  invalidateCatalogCache();
  revalidatePath("/", "layout");
  redirect("/admin/produits");
}

/** Inline stock edit from the products table. */
export async function updateStock(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  const stock = Math.min(MAX_INT4, Math.max(0, Math.floor(Number(str(form, "stock")) || 0)));
  if (!id) return;
  const updated = await db.product.update({ where: { id }, data: { stock } }).catch(() => null);
  if (updated) await recordAudit({ action: "product.stock", actor: owner, target: `product:${id}`, detail: `stock=${stock}` });
  invalidateCatalogCache();
  revalidatePath("/", "layout");
}

const bulkActions = {
  show: { active: true },
  hide: { active: false },
  feature: { featured: true },
  unfeature: { featured: false },
} as const;

export async function bulkUpdateProducts(form: FormData) {
  const owner = await requireOwner();
  const action = str(form, "action") as keyof typeof bulkActions;
  const ids = form
    .getAll("ids")
    .map((value) => toInt32(Number(value), 1))
    .filter((id): id is number => id !== null);
  if (!Object.hasOwn(bulkActions, action) || ids.length === 0) return;
  await db.product.updateMany({ where: { id: { in: ids } }, data: bulkActions[action] });
  await recordAudit({ action: "product.bulk", actor: owner, detail: `action=${action}, count=${ids.length}` });
  invalidateCatalogCache();
  revalidatePath("/", "layout");
}

// ---- Settings (owner) ----

export type FormResult = { error?: string; ok?: string };

function tndToMillimes(value: string) {
  if (!value) return 0;
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 && amount <= 2_000_000 ? Math.round(amount * 1000) : null;
}

export async function saveSettings(_prev: FormResult, form: FormData): Promise<FormResult> {
  const owner = await requireOwner();
  const deliveryFeeMillimes = tndToMillimes(str(form, "deliveryFee"));
  const freeDeliveryFromMillimes = tndToMillimes(str(form, "freeDeliveryFrom"));
  if (deliveryFeeMillimes === null || freeDeliveryFromMillimes === null) return { error: "Montant invalide." };

  const metaPixelId = str(form, "metaPixelId", 30).replace(/\s/g, "");
  if (metaPixelId && !/^\d{6,20}$/.test(metaPixelId)) return { error: "L'ID du pixel Meta ne contient que des chiffres." };
  const token = str(form, "metaAccessToken", 500);

  const current = await getShopSettings();
  const logo = form.get("logo");
  let logoImage: string | undefined;
  if (logo instanceof File && logo.size > 0) {
    if (!isAcceptable(logo, "public")) return { error: "Logo refusé : JPG, PNG ou WEBP, 10 Mo max." };
    try {
      logoImage = `/api/uploads/${await saveUpload(logo, "public")}`;
    } catch (err) {
      if (err instanceof InvalidUploadError) return { error: "Logo invalide : fichier JPG, PNG ou WEBP corrompu ou falsifié." };
      throw err;
    }
  }
  const removeLogo = form.get("removeLogo") === "on";
  const removeToken = form.get("removeToken") === "on";

  await saveShopSettings({
    deliveryFeeMillimes,
    freeDeliveryFromMillimes,
    metaPixelId,
    metaTestEventCode: str(form, "metaTestEventCode", 40),
    // The saved token is never sent back to the page: an empty field keeps it.
    ...(token && { metaAccessToken: token }),
    ...(removeToken && { metaAccessToken: "" }),
    ...(logoImage && { logoImage }),
    ...(removeLogo && { logoImage: "" }),
  });

  // Clean up the replaced logo file now that the new path is saved.
  if ((logoImage || removeLogo) && current.logoImage.startsWith("/api/uploads/")) {
    await deleteUpload(current.logoImage.split("/").pop(), "public");
  }

  const changes = [
    `pixel=${metaPixelId || "off"}`,
    token ? "token=updated" : removeToken ? "token=removed" : null,
    logoImage ? "logo=updated" : removeLogo ? "logo=removed" : null,
  ].filter(Boolean);
  await recordAudit({ action: "settings.update", actor: owner, target: "setting:shop", detail: changes.join(", ") });

  revalidatePath("/", "layout");
  return { ok: "Réglages enregistrés." };
}

export async function runPrivacyCleanupAction(_prev: FormResult): Promise<FormResult> {
  const owner = await requireOwner();
  const result = await runPrivacyCleanup();
  const summary = `tokens=${result.deletedTokens}, limits=${result.deletedRateLimits}, visitors=${result.scrubbedOrderVisitors}, quotes=${result.deletedClosedQuotes}, files=${result.deletedFiles}`;
  await recordAudit({ action: "privacy.cleanup", actor: owner, target: "privacy:retention", detail: summary });
  revalidatePath("/admin", "layout");
  return {
    ok: `Nettoyage effectué : ${result.scrubbedOrderVisitors} métadonnée(s) IP/navigateur purgée(s), ${result.deletedClosedQuotes} demande(s) clôturée(s) supprimée(s), ${result.deletedTokens + result.deletedRateLimits} entrée(s) expirée(s) nettoyée(s).`,
  };
}

// ---- Team (owner) ----

export async function createStaff(_prev: FormResult, form: FormData): Promise<FormResult> {
  const owner = await requireOwner();
  const name = str(form, "name", 120);
  const email = str(form, "email", 160).toLowerCase();
  const password = rawPassword(form, "password");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Nom et e-mail valide obligatoires." };
  const policyError = validatePasswordPolicy(password);
  if (policyError) return { error: policyError };
  if (email === (process.env.ADMIN_EMAIL ?? "").toLowerCase()) return { error: "Cet e-mail est celui du propriétaire." };
  let createdId: number;
  try {
    const created = await db.staffUser.create({ data: { name, email, passwordHash: await hashPassword(password) } });
    createdId = created.id;
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Un compte existe déjà avec cet e-mail." };
    throw err;
  }
  await recordAudit({ action: "staff.create", actor: owner, target: `staff:${createdId}`, detail: `email=${email}` });
  revalidatePath("/admin/equipe");
  return { ok: `Compte créé pour ${name}.` };
}

export async function toggleStaff(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  if (!id) return;
  const staff = await db.staffUser.findUnique({ where: { id } });
  if (staff) {
    await db.staffUser.update({
      where: { id },
      data: { active: !staff.active, tokenVersion: { increment: 1 } },
    });
    await recordAudit({ action: "staff.toggle", actor: owner, target: `staff:${id}`, detail: `email=${staff.email}, active=${!staff.active}` });
  }
  revalidatePath("/admin/equipe");
}

export async function resetStaffPassword(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  const password = rawPassword(form, "password");
  if (!id || validatePasswordPolicy(password)) return;
  const updated = await db.staffUser
    .update({
      where: { id },
      data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
      select: { email: true },
    })
    .catch(() => null);
  if (updated) await recordAudit({ action: "staff.reset_password", actor: owner, target: `staff:${id}`, detail: `email=${updated.email}` });
  revalidatePath("/admin/equipe");
}

export async function deleteStaff(form: FormData) {
  const owner = await requireOwner();
  const id = toInt32(Number(form.get("id")), 1);
  if (!id) return;
  const deleted = await db.staffUser.delete({ where: { id }, select: { email: true } }).catch(() => null);
  if (deleted) await recordAudit({ action: "staff.delete", actor: owner, target: `staff:${id}`, detail: `email=${deleted.email}` });
  revalidatePath("/admin/equipe");
}
