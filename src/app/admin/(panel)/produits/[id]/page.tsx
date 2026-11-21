import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { db, toInt32 } from "@/lib/db";
import { getComboComponentOptions } from "@/lib/comboOptions";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/admin/StatusBadge";
import { ProductForm } from "@/components/admin/ProductForm";
import { deleteProduct } from "../../../actions";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id: toInt32(Number(id), 1) ?? 0 },
    include: { variants: { orderBy: { position: "asc" } } },
  });
  if (!product) notFound();
  const comboOptions = await getComboComponentOptions();

  return (
    <>
      <Link href="/admin/produits" className="inline-flex items-center gap-1 font-label-code text-label-code text-on-surface-variant mb-3">
        <Icon name="arrow_back" className="text-[16px]" /> Produits
      </Link>
      <PageTitle title={`${product.ref} — ${product.nameFr}`}>
        <div className="flex gap-3">
          <Link href={`/fr/produits/${product.slug}`} target="_blank" className="h-10 px-4 rounded-lg bg-surface-container-lowest text-primary font-label-metric text-label-metric font-bold flex items-center gap-2">
            <Icon name="open_in_new" className="text-[18px]" /> Voir
          </Link>
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <button className="h-10 px-4 rounded-lg border border-error text-error font-label-metric text-label-metric font-bold flex items-center gap-2">
              <Icon name="delete" className="text-[18px]" /> Supprimer
            </button>
          </form>
        </div>
      </PageTitle>
      <ProductForm product={product} comboOptions={comboOptions} />
    </>
  );
}
