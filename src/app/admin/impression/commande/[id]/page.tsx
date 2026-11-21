import { notFound } from "next/navigation";
import { formatDate } from "@/config/admin";
import { formatPrice, formatThickness } from "@/config/catalog";
import { site } from "@/config/site";
import { requireAdmin } from "@/lib/auth";
import { db, toInt32 } from "@/lib/db";
import { getShopSettings } from "@/lib/settings";
import { Logo } from "@/components/site/Logo";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { title: "Bon de livraison" };

// Printable delivery slip (cash on delivery), outside the admin panel layout.
export default async function DeliverySlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id: toInt32(Number(id), 1) ?? 0 }, include: { items: true } });
  if (!order) notFound();
  const settings = await getShopSettings().catch(() => null);

  return (
    <div className="max-w-3xl mx-auto my-8 print:my-0 bg-surface-container-lowest p-10 print:p-0 shadow-sm print:shadow-none font-body-sm text-body-sm">
      <div className="flex justify-between items-start mb-10">
        <div>
          <Logo name={site.name} image={settings?.logoImage ?? ""} />
          <div className="mt-3 text-on-surface-variant space-y-0.5" dir="ltr">
            <div>{site.phone}</div>
            <div>{site.email}</div>
          </div>
        </div>
        <div className="text-end">
          <h1 className="font-headline-sm text-headline-sm text-primary font-bold uppercase">Bon de livraison</h1>
          <div className="font-label-metric text-label-metric mt-1">Commande n° {order.id}</div>
          <div className="text-on-surface-variant">{formatDate(order.createdAt)}</div>
          <div className="mt-4"><PrintButton /></div>
        </div>
      </div>

      <section className="mb-8 p-4 rounded-lg border border-outline-variant">
        <div className="field-label">Client</div>
        <div className="font-label-metric text-label-metric">{order.customerName}</div>
        <div dir="ltr" className="text-start">{order.phone}</div>
        <div className="whitespace-pre-line">{order.address}</div>
        {order.city && <div>{order.city}</div>}
        {order.note && <div className="mt-2 text-on-surface-variant whitespace-pre-line">Note : {order.note}</div>}
      </section>

      <table className="w-full mb-8">
        <thead className="border-b-2 border-primary font-label-code text-label-code uppercase">
          <tr>
            {["Réf.", "Désignation", "Ép.", "Prix unit.", "Qté", "Total"].map((h) => (
              <th key={h} className="py-2 pe-3 text-start">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-outline-variant/60">
              <td className="py-2 pe-3 font-bold">{item.ref}</td>
              <td className="py-2 pe-3">{item.name}</td>
              <td className="py-2 pe-3">{item.thickness ? formatThickness(item.thickness, "fr") : "—"}</td>
              <td className="py-2 pe-3">{formatPrice(item.unitPriceMillimes)}</td>
              <td className="py-2 pe-3">{item.quantity}</td>
              <td className="py-2 font-bold">{formatPrice(item.unitPriceMillimes * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="pt-4 text-end pe-3 text-on-surface-variant">Sous-total</td>
            <td className="pt-4">{formatPrice(order.totalMillimes + order.discountMillimes - order.deliveryMillimes)}</td>
          </tr>
          {order.discountMillimes > 0 && (
            <tr>
              <td colSpan={5} className="pt-1 text-end pe-3 text-on-surface-variant">Remise quantité</td>
              <td className="pt-1">−{formatPrice(order.discountMillimes)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={5} className="pt-1 text-end pe-3 text-on-surface-variant">Livraison</td>
            <td className="pt-1">{order.deliveryMillimes ? formatPrice(order.deliveryMillimes) : "Offerte"}</td>
          </tr>
          <tr>
            <td colSpan={5} className="pt-4 text-end font-label-metric text-label-metric uppercase pe-3">Total à payer (TND)</td>
            <td className="pt-4 font-headline-sm text-headline-sm text-primary font-bold">{formatPrice(order.totalMillimes)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-8 mt-16">
        <div className="border-t border-outline pt-2 text-on-surface-variant">Paiement à la livraison — signature du client</div>
        <div className="border-t border-outline pt-2 text-on-surface-variant">Signature du livreur</div>
      </div>
    </div>
  );
}
