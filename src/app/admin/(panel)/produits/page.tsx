import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { LOW_STOCK, listHref, pageOf } from "@/config/admin";
import { applications, categories, formatPrice, labelOf } from "@/config/catalog";
import { requireOwner } from "@/lib/auth";
import { db, textSearch } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { Pagination } from "@/components/admin/ListControls";
import { PageTitle } from "@/components/admin/StatusBadge";
import { SelectAll } from "@/components/admin/SelectAll";
import { bulkUpdateProducts, updateStock } from "../../actions";

const ADMIN_PRODUCT_PAGE_SIZE = 50;

export const metadata = { title: "Produits" };

const states = {
  active: { label: "En ligne", where: { active: true } },
  hidden: { label: "Masqués", where: { active: false } },
  out: { label: "En rupture", where: { stock: 0 } },
  low: { label: `Stock faible (≤ ${LOW_STOCK})`, where: { stock: { lte: LOW_STOCK } } },
  featured: { label: "Sur l'accueil", where: { featured: true } },
  combo: { label: "Combos", where: { kind: "combo" } },
} satisfies Record<string, { label: string; where: Prisma.ProductWhereInput }>;

const sorts = {
  ref: "ref",
  name: "nameFr",
  category: "category",
  price: "priceMillimes",
  stock: "stock",
  updated: "updatedAt",
} as const;

type Props = { searchParams: Promise<{ q?: string; cat?: string; state?: string; sort?: string; dir?: string; page?: string }> };

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireOwner();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const cat = categories.some((c) => c.key === sp.cat) ? sp.cat : undefined;
  const state = sp.state && Object.hasOwn(states, sp.state) ? (sp.state as keyof typeof states) : undefined;
  const sort = sp.sort && Object.hasOwn(sorts, sp.sort) ? (sp.sort as keyof typeof sorts) : "ref";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = pageOf(sp.page);

  const where: Prisma.ProductWhereInput = {
    ...(q && { OR: [{ ref: textSearch(q) }, { nameFr: textSearch(q) }, { nameAr: textSearch(q) }, { compatibility: textSearch(q) }] }),
    ...(cat && { category: cat }),
    ...(state && states[state].where),
  };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ [sorts[sort]]: dir }, { ref: "asc" }],
      skip: (page - 1) * ADMIN_PRODUCT_PAGE_SIZE,
      take: ADMIN_PRODUCT_PAGE_SIZE,
    }),
    db.product.count({ where }),
  ]);

  const params = { q: q || undefined, cat, state, sort: sort === "ref" ? undefined : sort, dir: dir === "asc" ? undefined : dir };
  const header = (label: string, key?: keyof typeof sorts) => {
    if (!key) return <th key={label} className="px-4 py-3 text-start font-medium">{label}</th>;
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    return (
      <th key={label} className="px-4 py-3 text-start font-medium">
        <Link href={listHref("/admin/produits", { ...params, sort: key, dir: nextDir })} className="inline-flex items-center gap-1 hover:text-secondary-container">
          {label}
          {sort === key && <Icon name={dir === "asc" ? "arrow_upward" : "arrow_downward"} className="text-[14px]" />}
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageTitle title={`Produits (${total})`}>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/produits/nouveau?kind=combo" className="h-11 px-4 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric font-bold uppercase flex items-center gap-2">
            <Icon name="link" className="text-[18px]" /> Nouveau combo
          </Link>
          <Link href="/admin/produits/nouveau" className="h-11 px-5 rounded-lg bg-secondary-container text-primary font-label-metric text-label-metric font-bold uppercase flex items-center gap-2">
            <Icon name="add" className="text-[18px]" /> Nouveau
          </Link>
        </div>
      </PageTitle>

      <form className="flex flex-wrap items-end gap-3 mb-4 bg-surface-container-lowest rounded-xl shadow-sm p-4">
        {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        {params.dir && <input type="hidden" name="dir" value={params.dir} />}
        <div className="relative flex-1 min-w-[220px]">
          <label className="field-label" htmlFor="q">Recherche</label>
          <Icon name="search" className="absolute start-3 bottom-3 text-outline text-[20px]" />
          <input id="q" name="q" defaultValue={q} placeholder="Réf., nom, véhicule..." className="field ps-10" />
        </div>
        <div>
          <label className="field-label" htmlFor="cat">Catégorie</label>
          <select id="cat" name="cat" defaultValue={cat ?? ""} className="field">
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.fr}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="state">État</label>
          <select id="state" name="state" defaultValue={state ?? ""} className="field">
            <option value="">Tous</option>
            {Object.entries(states).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
          </select>
        </div>
        <button className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase">Filtrer</button>
        {(q || cat || state) && (
          <Link href="/admin/produits" className="h-11 px-3 flex items-center font-label-metric text-label-metric text-on-surface-variant hover:text-primary">Effacer</Link>
        )}
      </form>

      {/* Row checkboxes point at this form through their `form` attribute (forms can't be nested in the table). */}
      <form id="bulk" action={bulkUpdateProducts} className="flex flex-wrap items-center gap-2 mb-3 font-body-sm text-body-sm">
        <span className="text-on-surface-variant">Sélection :</span>
        {[
          ["show", "visibility", "Afficher"],
          ["hide", "visibility_off", "Masquer"],
          ["feature", "star", "Mettre sur l'accueil"],
          ["unfeature", "star_outline", "Retirer de l'accueil"],
        ].map(([action, icon, label]) => (
          <button key={action} name="action" value={action} className="h-9 px-3 rounded-lg bg-surface-container-lowest shadow-sm text-primary font-label-metric text-label-metric flex items-center gap-1.5 hover:bg-surface-container">
            <Icon name={icon} className="text-[18px]" /> {label}
          </button>
        ))}
      </form>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full font-body-sm text-body-sm">
          <thead className="bg-primary text-on-primary font-label-code text-label-code uppercase">
            <tr>
              <th className="ps-4 py-3 w-8"><SelectAll form="bulk" /></th>
              {header("")}
              {header("Réf.", "ref")}
              {header("Nom", "name")}
              {header("Catégorie", "category")}
              {header("Prix", "price")}
              {header("Stock", "stock")}
              {header("État")}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-on-surface-variant">Aucun produit.</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low">
                <td className="ps-4 py-2"><input type="checkbox" name="ids" value={p.id} form="bulk" aria-label={`Sélectionner ${p.ref}`} className="w-4 h-4 accent-secondary-container" /></td>
                <td className="px-4 py-2">{p.image && <img src={p.image} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded object-cover" />}</td>
                <td className="px-4 py-2 font-bold"><Link href={`/admin/produits/${p.id}`} className="text-secondary">{p.ref}</Link></td>
                <td className="px-4 py-2">
                  <Link href={`/admin/produits/${p.id}`} className="text-primary hover:underline">{p.nameFr}</Link>
                  <div className="text-outline" dir="rtl">{p.nameAr}</div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span>{labelOf(categories, p.category, "fr")}</span>
                    {p.kind === "combo" && <span className="px-1.5 py-0.5 rounded bg-secondary-container text-primary text-[10px] font-bold uppercase">Combo</span>}
                  </div>
                  <div className="text-[11px] text-outline">{labelOf(applications, p.application, "fr")}</div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{formatPrice(p.priceMillimes)} TND</td>
                <td className="px-4 py-2">
                  <form action={updateStock} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="stock"
                      type="number"
                      min={0}
                      defaultValue={p.stock}
                      aria-label={`Stock ${p.ref}`}
                      className={`w-20 h-9 px-2 rounded-lg border border-outline-variant bg-surface-container-lowest ${p.stock === 0 ? "text-error font-bold" : p.stock <= LOW_STOCK ? "text-secondary font-bold" : ""}`}
                    />
                    <button title="Enregistrer le stock" className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-surface-container">
                      <Icon name="check" className="text-[18px]" />
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2 space-x-1">
                  {!p.active && <span className="px-2 py-0.5 rounded bg-surface-container-high text-[11px]">Masqué</span>}
                  {p.featured && <span className="px-2 py-0.5 rounded bg-secondary-container text-primary text-[11px]">Accueil</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination path="/admin/produits" params={params} page={page} total={total} pageSize={ADMIN_PRODUCT_PAGE_SIZE} />
    </>
  );
}
