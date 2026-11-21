import Link from "next/link";
import { notFound } from "next/navigation";
import { deliverySteps, formatDate, orderStatuses, toConfirmStatuses } from "@/config/admin";
import { formatPrice, formatThickness } from "@/config/catalog";
import { requireAdmin } from "@/lib/auth";
import { db, toInt32 } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { PageTitle, StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteOrder, recordCall, setOrderStatus, updateOrder } from "../../../actions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id: toInt32(Number(id), 1) ?? 0 },
    include: { items: true, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) notFound();

  const subtotal = order.totalMillimes + order.discountMillimes - order.deliveryMillimes;
  const awaitingCall = toConfirmStatuses.includes(order.status);

  const nextSteps = deliverySteps[order.status] ?? [];

  const card = "bg-surface-container-lowest rounded-xl shadow-sm p-6";
  const callButton = "h-11 px-4 rounded-lg font-label-metric text-label-metric font-bold flex items-center justify-center gap-2";

  return (
    <>
      <Link href="/admin/commandes" className="inline-flex items-center gap-1 font-label-code text-label-code text-on-surface-variant mb-3">
        <Icon name="arrow_back" className="text-[16px]" /> Commandes
      </Link>
      <PageTitle title={`Commande #${order.id}`}>
        <div className="flex items-center gap-3">
          <StatusBadge statuses={orderStatuses} value={order.status} />
          <Link href={`/admin/impression/commande/${order.id}`} target="_blank" className="h-10 px-4 rounded-lg bg-surface-container-lowest shadow-sm text-primary font-label-metric text-label-metric font-bold flex items-center gap-2">
            <Icon name="print" className="text-[18px]" /> Bon de livraison
          </Link>
        </div>
      </PageTitle>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {awaitingCall && (
            <section className={`${card} border-2 border-secondary-container`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2">
                  <Icon name="phone_in_talk" className="text-secondary" /> Appel de confirmation
                </h2>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {order.callAttempts === 0 ? "Pas encore appelé" : `${order.callAttempts} appel${order.callAttempts > 1 ? "s" : ""} · dernier ${formatDate(order.lastCallAt ?? order.updatedAt)}`}
                </span>
              </div>
              <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 mb-4 font-headline-sm text-headline-sm text-primary font-bold" dir="ltr">
                <Icon name="call" className="text-secondary" /> {order.phone}
              </a>
              <form action={recordCall} className="space-y-3">
                <input type="hidden" name="id" value={order.id} />
                <input name="callNote" maxLength={200} placeholder="Remarque de l'appel (facultatif) : rappeler à 18h, adresse précisée..." className="field" />
                <div className="grid sm:grid-cols-3 gap-2">
                  <button name="outcome" value="confirmed" className={`${callButton} bg-primary text-on-primary`}>
                    <Icon name="check_circle" className="text-[18px]" /> Confirmée
                  </button>
                  <button name="outcome" value="no_answer" className={`${callButton} bg-secondary-container text-primary`}>
                    <Icon name="phone_missed" className="text-[18px]" /> Pas de réponse
                  </button>
                  <button name="outcome" value="cancelled" className={`${callButton} border border-error text-error`}>
                    <Icon name="cancel" className="text-[18px]" /> Annulée par le client
                  </button>
                </div>
              </form>
            </section>
          )}

          {nextSteps.length > 0 && (
            <section className={`${card} border-2 border-primary-fixed`}>
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2 mb-1">
                <Icon name="local_shipping" className="text-secondary" /> Suivi de livraison
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                Mettez à jour selon le retour de votre société de livraison.
              </p>
              <form action={setOrderStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={order.id} />
                {nextSteps.map((step) => (
                  <button key={step.status} name="status" value={step.status} className={`${callButton} ${step.className}`}>
                    <Icon name={step.icon} className="text-[18px]" /> {step.label}
                  </button>
                ))}
              </form>
            </section>
          )}

          <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full font-body-sm text-body-sm">
              <thead className="bg-primary text-on-primary font-label-code text-label-code uppercase">
                <tr>
                  {["Réf.", "Produit", "Épaisseur", "Prix unit.", "Qté", "Total"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-outline-variant/40">
                    <td className="px-4 py-3 font-bold">{item.ref}</td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">{item.thickness ? formatThickness(item.thickness, "fr") : "—"}</td>
                    <td className="px-4 py-3">{formatPrice(item.unitPriceMillimes)}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3 font-bold">{formatPrice(item.unitPriceMillimes * item.quantity)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="px-4 pt-3 pb-1 text-end text-on-surface-variant">Sous-total</td>
                  <td className="px-4 pt-3 pb-1">{formatPrice(subtotal)}</td>
                </tr>
                {order.discountMillimes > 0 && (
                  <tr className="text-secondary">
                    <td colSpan={5} className="px-4 py-1 text-end">Remise quantité</td>
                    <td className="px-4 py-1 font-bold">−{formatPrice(order.discountMillimes)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="px-4 py-1 text-end text-on-surface-variant">Livraison</td>
                  <td className="px-4 py-1">{order.deliveryMillimes ? formatPrice(order.deliveryMillimes) : "Offerte"}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-end font-label-metric text-label-metric uppercase">Total TND</td>
                  <td className="px-4 py-3 font-headline-sm text-headline-sm text-primary">{formatPrice(order.totalMillimes)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Keyed on updatedAt: after a call button changes the status, the select must show the new one,
              otherwise saving this form would silently put the old status back. */}
          <form key={order.updatedAt.toISOString()} action={updateOrder} className={`${card} space-y-4`}>
            <input type="hidden" name="id" value={order.id} />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="field-label">Statut</label>
                <select id="status" name="status" defaultValue={order.status} className="field">
                  {Object.entries(orderStatuses).map(([key, s]) => (
                    <option key={key} value={key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="delivery" className="field-label">Frais de livraison (TND)</label>
                <input id="delivery" name="delivery" inputMode="decimal" defaultValue={formatPrice(order.deliveryMillimes)} className="field" />
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Confirmée, expédiée ou livrée : les articles sont retirés du stock. À confirmer, injoignable, retournée ou annulée : ils sont remis en stock.
            </p>
            <div>
              <label htmlFor="adminNote" className="field-label">Note interne</label>
              <textarea id="adminNote" name="adminNote" rows={3} defaultValue={order.adminNote ?? ""} className="field h-auto py-3" />
            </div>
            <button className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase">Enregistrer</button>
          </form>

          <section className={card}>
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-4">Historique</h2>
            {order.events.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">Aucun événement enregistré.</p>}
            <ol className="relative border-s-2 border-outline-variant/60 ms-2 space-y-4">
              {order.events.map((event) => (
                <li key={event.id} className="ps-5 relative">
                  <span className="absolute -start-[7px] top-1.5 w-3 h-3 rounded-full bg-secondary-container ring-2 ring-surface-container-lowest" />
                  <div className="font-body-sm text-body-sm text-on-surface">{event.message}</div>
                  <div className="font-label-code text-label-code text-outline">
                    {formatDate(event.createdAt)}{event.actor && ` · ${event.actor}`}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6 self-start">
          <section className={`${card} space-y-2 font-body-sm text-body-sm`}>
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-2">Livraison</h2>
            <div className="font-label-metric text-label-metric">{order.customerName}</div>
            <div dir="ltr">{order.phone}</div>
            {order.email && <div dir="ltr">{order.email}</div>}
            <div className="whitespace-pre-line">{order.address}</div>
            {order.city && <div>{order.city}</div>}
            {order.note && <p className="p-3 rounded-lg bg-surface-container-low whitespace-pre-line">{order.note}</p>}
            <div className="text-outline">Passée le {formatDate(order.createdAt)} · site en {order.locale === "ar" ? "arabe" : "français"}</div>
            <div className="grid gap-2 pt-3">
              <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="h-10 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric font-bold flex items-center justify-center gap-2">
                <Icon name="call" className="text-[18px]" /> Appeler
              </a>
            </div>
          </section>
          {admin.role === "owner" && (
            <form action={deleteOrder}>
              <input type="hidden" name="id" value={order.id} />
              <ConfirmButton
                message={`Supprimer définitivement la commande #${order.id} ? Les articles retirés du stock y seront remis.`}
                className="w-full h-10 rounded-lg border border-error text-error font-label-metric text-label-metric font-bold flex items-center justify-center gap-2"
              >
                <Icon name="delete" className="text-[18px]" /> Supprimer la commande
              </ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
