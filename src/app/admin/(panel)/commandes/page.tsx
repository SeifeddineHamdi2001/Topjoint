import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PAGE_SIZE, dateRange, formatDate, isOrderStatus, lostStatuses, orderStatuses, pageOf } from "@/config/admin";
import { formatPrice } from "@/config/catalog";
import { requireAdmin } from "@/lib/auth";
import { db, textSearch } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { PageTitle, StatusBadge } from "@/components/admin/StatusBadge";
import { FilterBar, Pagination, StatusTabs } from "@/components/admin/ListControls";
import { SelectAll } from "@/components/admin/SelectAll";
import { bulkSetOrderStatus } from "../../actions";

export const metadata = { title: "Commandes" };

type Props = { searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isOrderStatus(sp.status) ? sp.status : undefined;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageOf(sp.page);
  // "#12" or "12" also matches the order number.
  const orderId = /^#?\d{1,9}$/.test(q) ? Number(q.replace("#", "")) : undefined;

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...dateRange(sp.from, sp.to),
    ...(q && {
      OR: [
        { customerName: textSearch(q) },
        { phone: textSearch(q) },
        { email: textSearch(q) },
        { address: textSearch(q) },
        ...(orderId ? [{ id: orderId }] : []),
      ],
    }),
  };
  const [orders, total, sum] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
    db.order.aggregate({ where: { ...where, status: status ?? { notIn: lostStatuses } }, _sum: { totalMillimes: true } }),
  ]);

  const params = { status, q: q || undefined, from: sp.from, to: sp.to };

  return (
    <>
      <PageTitle title="Commandes">
        <div className="font-body-sm text-body-sm text-on-surface-variant">
          {total} commande{total > 1 ? "s" : ""} · <span className="font-bold text-primary">{formatPrice(sum._sum.totalMillimes ?? 0)} TND</span>
          {!status && " hors annulées et retournées"}
        </div>
      </PageTitle>
      <StatusTabs path="/admin/commandes" params={params} statuses={orderStatuses} current={status} />
      <FilterBar path="/admin/commandes" q={q} from={sp.from} to={sp.to} placeholder="N°, client, téléphone, adresse..." hidden={{ status }} />
      {/* Row checkboxes point at this form through their `form` attribute. */}
      <form id="bulk-orders" action={bulkSetOrderStatus} className="flex flex-wrap items-center gap-2 mb-3 font-body-sm text-body-sm">
        <span className="text-on-surface-variant">Commandes cochées :</span>
        <select name="status" required defaultValue="" aria-label="Nouveau statut" className="field h-9 w-auto bg-surface-container-lowest">
          <option value="" disabled>Changer le statut…</option>
          {Object.entries(orderStatuses).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </select>
        <button className="h-9 px-4 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold">Appliquer</button>
      </form>
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full font-body-sm text-body-sm">
          <thead className="bg-primary text-on-primary font-label-code text-label-code uppercase">
            <tr>
              <th className="ps-4 py-3 w-8"><SelectAll form="bulk-orders" /></th>
              {["#", "Date", "Client", "Téléphone", "Adresse", "Articles", "Total", "Statut", "Appels", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-on-surface-variant">Aucune commande.</td></tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className={`border-b border-outline-variant/40 hover:bg-surface-container-low ${order.status === "NEW" ? "font-semibold" : ""}`}>
                <td className="ps-4 py-3"><input type="checkbox" name="ids" value={order.id} form="bulk-orders" aria-label={`Sélectionner la commande ${order.id}`} className="w-4 h-4 accent-secondary-container" /></td>
                <td className="px-4 py-3"><Link href={`/admin/commandes/${order.id}`} className="text-secondary font-bold">{order.id}</Link></td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-3"><Link href={`/admin/commandes/${order.id}`} className="text-primary hover:underline">{order.customerName}</Link></td>
                <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{order.phone}</td>
                <td className="px-4 py-3 max-w-[220px] truncate">{order.address}</td>
                <td className="px-4 py-3">{order._count.items}</td>
                <td className="px-4 py-3 font-bold whitespace-nowrap">{formatPrice(order.totalMillimes)} TND</td>
                <td className="px-4 py-3"><StatusBadge statuses={orderStatuses} value={order.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap">{order.callAttempts > 0 ? `${order.callAttempts} · ${formatDate(order.lastCallAt ?? order.updatedAt)}` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <a href={`tel:${order.phone.replace(/\s/g, "")}`} title="Appeler" className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary-container text-primary">
                      <Icon name="call" className="text-[18px]" />
                    </a>
                    <Link href={`/admin/impression/commande/${order.id}`} target="_blank" title="Bon de livraison" className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container text-primary">
                      <Icon name="print" className="text-[18px]" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination path="/admin/commandes" params={params} page={page} total={total} pageSize={PAGE_SIZE} />
    </>
  );
}
