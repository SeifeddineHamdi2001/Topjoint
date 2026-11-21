import Link from "next/link";
import { LOW_STOCK, formatDate, listHref, lostStatuses, orderStatuses, quoteStatuses, subjectLabels } from "@/config/admin";
import { formatPrice } from "@/config/catalog";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { PageTitle, StatusBadge } from "@/components/admin/StatusBadge";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const periods = {
  "7d": { label: "7 jours", days: 7 },
  "30d": { label: "30 jours", days: 30 },
  "12m": { label: "12 mois", days: 0 },
} as const;
type Period = keyof typeof periods;

/** Tunis is UTC+1 all year: shift by one hour to read the local calendar date from UTC fields. */
function tunisParts(date: Date) {
  const local = new Date(date.getTime() + HOUR);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}
function tunisMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - HOUR);
}

/** Current period, the same-length period just before it, and the chart buckets. */
function periodBounds(period: Period, now: Date) {
  const { y, m, d } = tunisParts(now);
  if (period === "12m") {
    const start = tunisMidnight(y, m - 11, 1);
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 11 + i, 1));
      return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(date),
      };
    });
    return { start, prevStart: tunisMidnight(y, m - 23, 1), unit: "month" as const, buckets };
  }
  const days = periods[period].days;
  const start = tunisMidnight(y, m, d - days + 1);
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(y, m, d - days + 1 + i));
    return {
      key: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date),
    };
  });
  return { start, prevStart: new Date(start.getTime() - days * DAY), unit: "day" as const, buckets };
}

function formatDuration(ms: number) {
  const hours = ms / HOUR;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} j`;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-outline">{current > 0 ? "nouveau" : "—"}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${up ? "text-[#1b7a3d]" : "text-error"}`}>
      <Icon name={up ? "trending_up" : "trending_down"} className="text-[16px]" />
      {up ? "+" : ""}{pct}%
    </span>
  );
}

type Props = { searchParams: Promise<{ period?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  await requireOwner();
  const sp = await searchParams;
  const period: Period = sp.period && Object.hasOwn(periods, sp.period) ? (sp.period as Period) : "30d";
  const now = new Date();
  const { start, prevStart, unit, buckets } = periodBounds(period, now);
  const current = { gte: start };
  const previous = { gte: prevStart, lt: start };
  const fmt = unit === "month" ? "YYYY-MM" : "YYYY-MM-DD";

  const [
    sales,
    prevSales,
    quotesIn,
    prevQuotesIn,
    quotesHandled,
    prevQuotesHandled,
    responseTime,
    series,
    topProducts,
    lowStock,
    lowStockCount,
    staleNewOrders,
    staleConfirmedOrders,
    staleQuotes,
    newQuotes,
    newOrders,
    recentQuotes,
    recentOrders,
  ] = await Promise.all([
    db.order.aggregate({ where: { createdAt: current, status: { notIn: lostStatuses } }, _sum: { totalMillimes: true }, _count: true }),
    db.order.aggregate({ where: { createdAt: previous, status: { notIn: lostStatuses } }, _sum: { totalMillimes: true }, _count: true }),
    db.quoteRequest.count({ where: { createdAt: current } }),
    db.quoteRequest.count({ where: { createdAt: previous } }),
    db.quoteRequest.count({ where: { createdAt: current, status: { in: ["QUOTED", "CLOSED"] } } }),
    db.quoteRequest.count({ where: { createdAt: previous, status: { in: ["QUOTED", "CLOSED"] } } }),
    db.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("handledAt" - "createdAt")))::float8 AS avg
      FROM "QuoteRequest" WHERE "handledAt" IS NOT NULL AND "createdAt" >= ${start}`,
    db.$queryRaw<{ bucket: string; revenue: number; orders: number }[]>`
      SELECT to_char("createdAt" AT TIME ZONE 'Africa/Tunis', ${fmt}) AS bucket,
             SUM("totalMillimes")::float8 AS revenue, COUNT(*)::int AS orders
      FROM "Order" WHERE "createdAt" >= ${start} AND status NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY bucket`,
    db.$queryRaw<{ ref: string; name: string; productId: number | null; quantity: number; revenue: number }[]>`
      SELECT i.ref, MAX(i.name) AS name, MAX(i."productId") AS "productId",
             SUM(i.quantity)::int AS quantity, SUM(i."unitPriceMillimes" * i.quantity)::float8 AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      WHERE o."createdAt" >= ${start} AND o.status NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY i.ref ORDER BY revenue DESC LIMIT 5`,
    db.product.findMany({ where: { active: true, stock: { lte: LOW_STOCK } }, orderBy: [{ stock: "asc" }, { ref: "asc" }], take: 8 }),
    db.product.count({ where: { active: true, stock: { lte: LOW_STOCK } } }),
    // Waiting for the confirmation call: never called after 2h, or unreachable and last tried 3h+ ago.
    db.order.findMany({
      where: {
        OR: [
          { status: "NEW", createdAt: { lt: new Date(now.getTime() - 2 * HOUR) } },
          { status: "NO_ANSWER", lastCallAt: { lt: new Date(now.getTime() - 3 * HOUR) } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 6,
    }),
    db.order.findMany({ where: { status: "CONFIRMED", updatedAt: { lt: new Date(now.getTime() - 2 * DAY) } }, orderBy: { updatedAt: "asc" }, take: 5 }),
    db.quoteRequest.findMany({ where: { status: "NEW", createdAt: { lt: new Date(now.getTime() - DAY) } }, orderBy: { createdAt: "asc" }, take: 5 }),
    db.quoteRequest.count({ where: { status: "NEW" } }),
    db.order.count({ where: { status: "NEW" } }),
    db.quoteRequest.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  // Cash on delivery: share of the orders already called that the customer confirmed.
  const confirmationRate = async (createdAt: { gte: Date; lt?: Date }) => {
    const rows = await db.order.groupBy({ by: ["status"], where: { createdAt, status: { notIn: ["NEW", "NO_ANSWER"] } }, _count: true });
    const decided = rows.reduce((sum, r) => sum + r._count, 0);
    const confirmed = rows.filter((r) => r.status !== "CANCELLED").reduce((sum, r) => sum + r._count, 0);
    return { decided, confirmed, rate: decided ? Math.round((confirmed / decided) * 100) : 0 };
  };
  const [confirmation, prevConfirmation] = await Promise.all([confirmationRate(current), confirmationRate(previous)]);

  const revenue = sales._sum.totalMillimes ?? 0;
  const prevRevenue = prevSales._sum.totalMillimes ?? 0;
  const average = sales._count ? revenue / sales._count : 0;
  const prevAverage = prevSales._count ? prevRevenue / prevSales._count : 0;
  const handledRate = quotesIn ? Math.round((quotesHandled / quotesIn) * 100) : 0;
  const prevHandledRate = prevQuotesIn ? Math.round((prevQuotesHandled / prevQuotesIn) * 100) : 0;
  const avgResponse = responseTime[0]?.avg;

  const byBucket = new Map(series.map((row) => [row.bucket, row]));
  const chart = buckets.map((b) => ({ ...b, revenue: byBucket.get(b.key)?.revenue ?? 0, orders: byBucket.get(b.key)?.orders ?? 0 }));
  const maxRevenue = Math.max(1, ...chart.map((c) => c.revenue));
  const labelEvery = chart.length > 12 ? Math.ceil(chart.length / 10) : 1;
  const maxTop = Math.max(1, ...topProducts.map((p) => p.revenue));

  const todo = [
    ...staleQuotes.map((q) => ({ key: `q${q.id}`, href: `/admin/demandes/${q.id}`, icon: "request_quote", title: `Demande #${q.id} · ${q.name}`, detail: `Non ouverte depuis ${formatDuration(now.getTime() - q.createdAt.getTime())}` })),
    ...staleNewOrders.map((o) => ({
      key: `n${o.id}`,
      href: `/admin/commandes/${o.id}`,
      icon: "phone_in_talk",
      title: `Commande #${o.id} · ${o.customerName}`,
      detail: o.status === "NO_ANSWER" ? `À rappeler · ${o.callAttempts} appel${o.callAttempts > 1 ? "s" : ""} sans réponse` : `Pas encore appelé · passée il y a ${formatDuration(now.getTime() - o.createdAt.getTime())}`,
    })),
    ...staleConfirmedOrders.map((o) => ({ key: `c${o.id}`, href: `/admin/commandes/${o.id}`, icon: "local_shipping", title: `Commande #${o.id} · ${o.customerName}`, detail: `Confirmée, pas expédiée depuis ${formatDuration(now.getTime() - o.updatedAt.getTime())}` })),
  ];

  const kpis = [
    { label: "Chiffre d'affaires", value: `${formatPrice(revenue)} TND`, icon: "payments", delta: <Delta current={revenue} previous={prevRevenue} />, href: listHref("/admin/commandes", { from: unit === "month" ? `${buckets[0].key}-01` : buckets[0].key }) },
    { label: "Commandes", value: String(sales._count), icon: "shopping_bag", delta: <Delta current={sales._count} previous={prevSales._count} />, href: "/admin/commandes" },
    { label: "Panier moyen", value: `${formatPrice(Math.round(average))} TND`, icon: "shopping_cart", delta: <Delta current={average} previous={prevAverage} />, href: "/admin/commandes" },
    {
      label: "Taux de confirmation",
      value: confirmation.decided ? `${confirmation.rate}%` : "—",
      icon: "phone_in_talk",
      delta: <Delta current={confirmation.rate} previous={prevConfirmation.rate} />,
      detail: `${confirmation.confirmed}/${confirmation.decided} commandes appelées confirmées`,
      href: "/admin/commandes",
    },
    {
      label: "Demandes traitées",
      value: quotesIn ? `${handledRate}%` : "—",
      icon: "task_alt",
      delta: <Delta current={handledRate} previous={prevHandledRate} />,
      detail: `${quotesHandled}/${quotesIn} devis envoyés ou clôturés · réponse en ~${avgResponse ? formatDuration(avgResponse * 1000) : "—"}`,
      href: "/admin/demandes",
    },
  ];

  const card = "bg-surface-container-lowest rounded-xl shadow-sm p-5";
  const sectionTitle = "font-headline-sm text-headline-sm text-primary font-bold";

  return (
    <>
      <PageTitle title="Tableau de bord">
        <div className="flex gap-1 p-1 rounded-lg bg-surface-container-lowest shadow-sm">
          {Object.entries(periods).map(([key, p]) => (
            <Link key={key} href={key === "30d" ? "/admin" : `/admin?period=${key}`} className={`px-3 py-1.5 rounded-md font-label-metric text-label-metric ${key === period ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-primary"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </PageTitle>

      {(newQuotes > 0 || newOrders > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {newOrders > 0 && (
            <Link href="/admin/commandes?status=NEW" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric">
              <Icon name="shopping_bag" className="text-[18px] text-secondary-container" /> {newOrders} nouvelle{newOrders > 1 ? "s" : ""} commande{newOrders > 1 ? "s" : ""}
            </Link>
          )}
          {newQuotes > 0 && (
            <Link href="/admin/demandes?status=NEW" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric">
              <Icon name="mark_email_unread" className="text-[18px] text-secondary-container" /> {newQuotes} nouvelle{newQuotes > 1 ? "s" : ""} demande{newQuotes > 1 ? "s" : ""}
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className={`${card} hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
              <span className="font-label-code text-label-code uppercase text-on-surface-variant">{kpi.label}</span>
              <Icon name={kpi.icon} className="text-secondary" />
            </div>
            <div className="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold mt-2 whitespace-nowrap">{kpi.value}</div>
            <div className="font-body-sm text-body-sm mt-1">
              {kpi.delta} <span className="text-outline">vs {periods[period].label} précédents</span>
            </div>
            {"detail" in kpi && <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">{kpi.detail}</div>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <section className={`${card} xl:col-span-2`}>
          <div className="flex justify-between items-baseline mb-4">
            <h2 className={sectionTitle}>Ventes — {periods[period].label}</h2>
            <span className="font-body-sm text-body-sm text-on-surface-variant">par {unit === "month" ? "mois" : "jour"}, hors annulées et retournées</span>
          </div>
          <div className="flex items-end gap-[3px] h-56 border-b border-outline-variant">
            {chart.map((c) => (
              <div key={c.key} className="group relative flex-1 h-full flex items-end">
                <div
                  className={`w-full rounded-t ${c.revenue ? "bg-secondary-container group-hover:bg-secondary" : "bg-surface-container"}`}
                  style={{ height: c.revenue ? `${Math.max(2, (c.revenue / maxRevenue) * 100)}%` : "2px" }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded bg-inverse-surface text-inverse-on-surface px-2 py-1 font-body-sm text-[12px]">
                  {c.label} · {formatPrice(c.revenue)} TND · {c.orders} cmd
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-[3px] mt-1">
            {chart.map((c, i) => (
              <div key={c.key} className="flex-1 text-center font-label-code text-[10px] text-outline overflow-visible whitespace-nowrap">
                {i % labelEvery === 0 ? c.label : ""}
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className={`${sectionTitle} mb-4`}>Meilleures ventes</h2>
          {topProducts.length === 0 && <p className="text-on-surface-variant font-body-sm text-body-sm">Aucune vente sur la période.</p>}
          <ol className="space-y-4">
            {topProducts.map((p, i) => (
              <li key={p.ref}>
                <div className="flex justify-between gap-3 font-body-sm text-body-sm">
                  <Link href={p.productId ? `/admin/produits/${p.productId}` : "/admin/produits"} className="min-w-0 truncate text-primary hover:underline">
                    <span className="font-bold text-secondary me-1">{i + 1}.</span> {p.ref} · {p.name}
                  </Link>
                  <span className="whitespace-nowrap font-bold">{formatPrice(p.revenue)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-container">
                    <div className="h-full rounded-full bg-secondary-container" style={{ width: `${(p.revenue / maxTop) * 100}%` }} />
                  </div>
                  <span className="font-label-code text-label-code text-on-surface-variant whitespace-nowrap">{p.quantity} pcs</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <section className={card}>
          <h2 className={`${sectionTitle} mb-4 flex items-center gap-2`}>
            <Icon name="pending_actions" className="text-secondary" /> À traiter
          </h2>
          {todo.length === 0 && <p className="text-on-surface-variant font-body-sm text-body-sm">Rien en retard. 👍</p>}
          <ul className="divide-y divide-outline-variant/40">
            {todo.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="flex items-center gap-3 py-3 px-2 rounded hover:bg-surface-container-low">
                  <Icon name={t.icon} className="text-error" />
                  <div className="min-w-0">
                    <div className="font-label-metric text-label-metric text-primary truncate">{t.title}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">{t.detail}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`${sectionTitle} flex items-center gap-2`}>
              <Icon name="inventory" className="text-secondary" /> Stock faible ({lowStockCount})
            </h2>
            <Link href="/admin/produits?state=low&sort=stock" className="font-label-code text-label-code text-secondary font-bold">Tout voir</Link>
          </div>
          {lowStock.length === 0 && <p className="text-on-surface-variant font-body-sm text-body-sm">Tous les produits en ligne ont plus de {LOW_STOCK} pièces.</p>}
          <ul className="divide-y divide-outline-variant/40">
            {lowStock.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/produits/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 px-2 rounded hover:bg-surface-container-low">
                  <div className="min-w-0 font-body-sm text-body-sm truncate">
                    <span className="font-bold text-secondary">{p.ref}</span> · {p.nameFr}
                  </div>
                  <span className={`px-2 py-0.5 rounded font-label-code text-label-code font-bold whitespace-nowrap ${p.stock === 0 ? "bg-error-container text-on-error-container" : "bg-secondary-fixed text-on-secondary-fixed"}`}>
                    {p.stock === 0 ? "Rupture" : `${p.stock} pcs`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className={card}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={sectionTitle}>Dernières demandes de devis</h2>
            <Link href="/admin/demandes" className="font-label-code text-label-code text-secondary font-bold">Tout voir</Link>
          </div>
          {recentQuotes.length === 0 && <p className="text-on-surface-variant font-body-sm text-body-sm">Aucune demande pour le moment.</p>}
          <ul className="divide-y divide-outline-variant/40">
            {recentQuotes.map((q) => (
              <li key={q.id}>
                <Link href={`/admin/demandes/${q.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-container-low px-2 rounded">
                  <div className="min-w-0">
                    <div className="font-label-metric text-label-metric text-primary truncate">{q.name}{q.company && ` — ${q.company}`}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">{subjectLabels[q.subject] ?? q.subject} · {formatDate(q.createdAt)}</div>
                  </div>
                  <StatusBadge statuses={quoteStatuses} value={q.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={sectionTitle}>Dernières commandes</h2>
            <Link href="/admin/commandes" className="font-label-code text-label-code text-secondary font-bold">Tout voir</Link>
          </div>
          {recentOrders.length === 0 && <p className="text-on-surface-variant font-body-sm text-body-sm">Aucune commande pour le moment.</p>}
          <ul className="divide-y divide-outline-variant/40">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/commandes/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-container-low px-2 rounded">
                  <div className="min-w-0">
                    <div className="font-label-metric text-label-metric text-primary truncate">#{o.id} · {o.customerName}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">{formatPrice(o.totalMillimes)} TND · {formatDate(o.createdAt)}</div>
                  </div>
                  <StatusBadge statuses={orderStatuses} value={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
