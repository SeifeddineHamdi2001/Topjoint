import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getComboComponentOptions } from "@/lib/comboOptions";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/admin/StatusBadge";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Nouveau produit" };

type Props = { searchParams: Promise<{ kind?: string }> };

export default async function NewProductPage({ searchParams }: Props) {
  await requireOwner();
  const sp = await searchParams;
  const comboOptions = await getComboComponentOptions();
  return (
    <>
      <Link href="/admin/produits" className="inline-flex items-center gap-1 font-label-code text-label-code text-on-surface-variant mb-3">
        <Icon name="arrow_back" className="text-[16px]" /> Produits
      </Link>
      <PageTitle title={sp.kind === "combo" ? "Nouveau combo" : "Nouveau produit"} />
      <ProductForm comboOptions={comboOptions} defaultKind={sp.kind === "combo" ? "combo" : "standard"} />
    </>
  );
}
