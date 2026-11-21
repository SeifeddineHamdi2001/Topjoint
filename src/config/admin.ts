import type { OrderStatus, QuoteStatus } from "@prisma/client";

// Admin is French only. Status keys are Postgres enums (prisma/schema.prisma).
export const quoteStatuses = {
  NEW: { label: "Nouveau", className: "bg-secondary-container text-primary" },
  IN_PROGRESS: { label: "En cours", className: "bg-primary-fixed text-on-primary-fixed" },
  QUOTED: { label: "Devis envoyé", className: "bg-tertiary-fixed text-on-tertiary-fixed" },
  CLOSED: { label: "Clôturé", className: "bg-surface-container-high text-on-surface-variant" },
} as const satisfies Record<QuoteStatus, { label: string; className: string }>;

export const orderStatuses = {
  NEW: { label: "À confirmer", className: "bg-secondary-container text-primary" },
  NO_ANSWER: { label: "Injoignable", className: "bg-secondary-fixed text-on-secondary-fixed" },
  CONFIRMED: { label: "Confirmée", className: "bg-primary-fixed text-on-primary-fixed" },
  SHIPPED: { label: "Expédiée", className: "bg-tertiary-fixed text-on-tertiary-fixed" },
  DELIVERED: { label: "Livrée", className: "bg-surface-container-high text-on-surface" },
  RETURNED: { label: "Retournée", className: "bg-error-container text-on-error-container" },
  CANCELLED: { label: "Annulée", className: "bg-error-container text-on-error-container" },
} as const satisfies Record<OrderStatus, { label: string; className: string }>;

/**
 * Quick buttons on the order page once it is confirmed: the shop uses its own delivery company,
 * so these statuses are set by hand from the courier's feedback.
 */
export const deliverySteps: Partial<Record<OrderStatus, { status: OrderStatus; label: string; icon: string; className: string }[]>> = {
  CONFIRMED: [
    { status: "SHIPPED", label: "Remise au livreur", icon: "local_shipping", className: "bg-primary text-on-primary" },
    { status: "CANCELLED", label: "Annulée", icon: "cancel", className: "border border-error text-error" },
  ],
  SHIPPED: [
    { status: "DELIVERED", label: "Livrée et payée", icon: "task_alt", className: "bg-primary text-on-primary" },
    { status: "RETURNED", label: "Refusée / retournée", icon: "assignment_return", className: "border border-error text-error" },
  ],
};

/** Orders still waiting for the confirmation call. */
export const toConfirmStatuses: OrderStatus[] = ["NEW", "NO_ANSWER"];

/** Orders that never turned into money: left out of revenue figures. */
export const lostStatuses: OrderStatus[] = ["CANCELLED", "RETURNED"];

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && Object.hasOwn(quoteStatuses, value);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && Object.hasOwn(orderStatuses, value);
}

export const subjectLabels: Record<string, string> = {
  "devis-sur-mesure": "Devis sur mesure",
  "commande-standard": "Pièce standard",
  "grande-serie": "Grand volume / sous-traitance",
  autre: "Autre question",
};

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-TN", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tunis" }).format(date);
}

/** Orders in these statuses have their items taken out of stock. */
export const stockHoldingStatuses: readonly OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"];

/** Active products at or below this stock show up in the dashboard alerts. */
export const LOW_STOCK = 5;

export const PAGE_SIZE = 25;

export function formatDay(date: Date) {
  return new Intl.DateTimeFormat("fr-TN", { dateStyle: "short", timeZone: "Africa/Tunis" }).format(date);
}

/** wa.me link; 8-digit numbers are Tunisian and get the 216 prefix. */
export function whatsappUrl(phone: string, text?: string) {
  const digits = phone.replace(/[^\d]/g, "");
  const number = digits.length === 8 ? `216${digits}` : digits;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Midnight in Tunis (UTC+1, no DST) for a yyyy-mm-dd input value; null if invalid. */
export function parseDay(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+01:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** Prisma createdAt filter from the list pages' "du / au" date inputs. */
export function dateRange(from?: string, to?: string) {
  const gte = parseDay(from);
  const lt = parseDay(to, true);
  return gte || lt ? { createdAt: { ...(gte && { gte }), ...(lt && { lt }) } } : {};
}

/** Builds a list URL keeping the current filters; undefined/empty values are dropped. */
export function listHref(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function pageOf(value: string | undefined) {
  return Math.min(10_000, Math.max(1, Number.parseInt(value ?? "", 10) || 1));
}
