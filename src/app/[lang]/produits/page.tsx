import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { applications, categories, ccOptions } from "@/config/catalog";
import { isLocale, type Locale } from "@/config/site";
import { getDictionary } from "@/i18n";
import { getCachedCatalogFacets } from "@/lib/catalogCache";
import { db, textSearch, toInt32 } from "@/lib/db";
import { resolveProductVariants } from "@/lib/variants";
import { Icon } from "@/components/Icon";
import { FilterDisclosure } from "@/components/site/FilterDisclosure";
import { ProductCard } from "@/components/site/ProductCard";
import { SearchBox } from "@/components/site/SearchBox";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type SearchParams = { q?: string; cat?: string; app?: string; kind?: string; cc?: string; stock?: string; sort?: string; page?: string };
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "fr").catalog.title };
}

const sorts: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  recent: { createdAt: "desc" },
  priceAsc: { priceMillimes: "asc" },
  priceDesc: { priceMillimes: "desc" },
  name: { nameFr: "asc" },
};

export default async function CatalogPage({ params, searchParams }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "fr";
  const t = getDictionary(lang);
  const sp = await searchParams;
  const base = `/${lang}/produits`;

  const q = (sp.q ?? "").trim().slice(0, 100);
  const cat = sp.cat?.trim() ? sp.cat.trim().slice(0, 40) : undefined;
  const app = sp.app?.trim() ? sp.app.trim().slice(0, 40) : undefined;
  const kind = sp.kind === "combo" ? "combo" : undefined;
  const ccs = (sp.cc ?? "")
    .split(",")
    .map((v) => toInt32(Number(v), 1))
    .filter((n): n is number => n !== null);
  const stock = sp.stock === "1" || sp.stock === "0" ? sp.stock : undefined; // 1 = in stock, 0 = on order
  const sort = sp.sort && sp.sort in sorts ? sp.sort : "recent";
  const page = Math.min(10_000, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const qNumber = toInt32(Number.parseInt(q, 10), 1);

  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(cat && { category: cat }),
    ...(app && { application: app }),
    ...(kind && { kind: "combo" }),
    ...(ccs.length && { cc: { in: ccs } }),
    ...(stock === "1" && { stock: { gt: 0 } }),
    ...(stock === "0" && { stock: 0 }),
    ...(q && {
      OR: [
        { ref: textSearch(q) },
        { nameFr: textSearch(q) },
        { nameAr: textSearch(q) },
        { compatibility: textSearch(q) },
        { dimensions: textSearch(q) },
        ...(qNumber !== null ? [{ cc: qNumber }] : []),
      ],
    }),
  };

  const [total, products, facets] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: sorts[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        variants: { orderBy: { position: "asc" } },
        comboCulasse: { select: { priceMillimes: true, variants: { select: { mm: true, priceMillimes: true } } } },
        comboChemise: { select: { priceMillimes: true, variants: { select: { mm: true, priceMillimes: true } } } },
      },
    }),
    getCachedCatalogFacets(),
  ]);
  const { inStock, onOrder, comboCount, byCategory, byApplication, byCc } = facets;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hydratedProducts = products.map((p) => ({ ...p, variants: resolveProductVariants(p) }));
  const countOf = (key: string) => byCategory.find((c) => c.category === key)?._count ?? 0;
  const countApp = (key: string) => byApplication.find((c) => c.application === key)?._count ?? 0;
  const countCc = (value: number) => byCc.find((c) => c.cc === value)?._count ?? 0;

  const current = {
    q: q || undefined,
    cat,
    app,
    kind,
    cc: ccs.length ? ccs.join(",") : undefined,
    stock,
    sort: sort === "recent" ? undefined : sort,
  };
  const link = (patch: Partial<SearchParams>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `${base}?${s}` : base;
  };
  const toggleCc = (value: number) => {
    const set = ccs.includes(value) ? ccs.filter((c) => c !== value) : [...ccs, value].sort((a, b) => a - b);
    return link({ cc: set.length ? set.join(",") : undefined, page: undefined });
  };

  // Chips for every active filter, each linking to the same page without it.
  const chips = [
    q && { label: `${t.catalog.searchChip} : « ${q} »`, href: link({ q: undefined, page: undefined }) },
    stock && { label: stock === "1" ? t.catalog.inStockNow : t.catalog.onOrder, href: link({ stock: undefined, page: undefined }) },
    cat && { label: categories.find((c) => c.key === cat)?.[lang] ?? cat, href: link({ cat: undefined, page: undefined }) },
    app && { label: applications.find((a) => a.key === app)?.[lang] ?? app, href: link({ app: undefined, page: undefined }) },
    kind && { label: t.catalog.combos, href: link({ kind: undefined, page: undefined }) },
    ...ccs.map((value) => ({ label: `${value} cc`, href: toggleCc(value) })),
  ].filter(Boolean) as { label: string; href: string }[];

  const checkRow = (checked: boolean, label: string, count: number, href: string) => (
    <Link key={label} href={href} className="flex items-center justify-between gap-2 py-1.5 font-body-sm text-body-sm hover:text-primary">
      <span className="flex items-center gap-2">
        <Icon name={checked ? "check_box" : "check_box_outline_blank"} className={checked ? "text-secondary" : "text-outline"} />
        {label}
      </span>
      <span className="px-1.5 rounded bg-surface-container text-on-surface-variant font-label-code text-label-code">{count}</span>
    </Link>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <nav className="flex items-center gap-2 font-label-code text-label-code text-on-surface-variant mb-6">
        <Link href={`/${lang}`} className="hover:text-primary">{t.header.nav.home}</Link>
        <Icon name="chevron_right" className="text-[16px]" flip />
        <span className="text-primary font-bold">{t.catalog.breadcrumb}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div className="max-w-3xl">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary font-bold">{t.catalog.title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">{t.catalog.text}</p>
        </div>
        <div className="grid grid-cols-3 gap-px bg-outline-variant/50 rounded-xl overflow-hidden border border-outline-variant/50 shrink-0">
          {[
            [t.catalog.inStockCount, String(inStock)],
            [t.catalog.shipping, t.catalog.shippingValue],
            [t.catalog.currencyLabel, t.catalog.currencyValue],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface-container-lowest px-3 sm:px-4 py-3">
              <div className="font-label-code text-label-code uppercase text-on-surface-variant">{label}</div>
              <div className="font-label-metric text-label-metric text-primary mt-1">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <form action={base} className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl bg-surface-container-lowest shadow-sm mb-4">
        {cat && <input type="hidden" name="cat" value={cat} />}
        {app && <input type="hidden" name="app" value={app} />}
        {kind && <input type="hidden" name="kind" value={kind} />}
        {current.cc && <input type="hidden" name="cc" value={current.cc} />}
        {stock && <input type="hidden" name="stock" value={stock} />}
        <SearchBox lang={lang} t={t.search} placeholder={t.catalog.searchPlaceholder} defaultValue={q} className="flex-1" />
        <select name="sort" defaultValue={sort} aria-label={t.catalog.sort} className="field sm:w-56">
          {Object.entries(t.catalog.sortOptions).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase flex items-center justify-center gap-2 whitespace-nowrap">
          <Icon name="inventory_2" className="text-[18px]" />
          {total} {t.catalog.results}
        </button>
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 font-label-code text-label-code">
          <span className="text-on-surface-variant uppercase font-bold">{t.catalog.activeFilters}</span>
          {chips.map((chip) => (
            <Link key={chip.label} href={chip.href} className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-primary font-semibold hover:bg-surface-container-high">
              {chip.label}
              <Icon name="close" className="text-[14px]" />
            </Link>
          ))}
          <Link href={base} className="text-secondary font-bold hover:underline ms-1">{t.catalog.clearAll}</Link>
        </div>
      )}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-primary text-on-primary p-4">
        <Icon name="auto_awesome" className="text-secondary-container text-2xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-label-metric text-label-metric font-bold uppercase tracking-wide">{t.catalog.comboTitle}</div>
          <p className="font-body-sm text-body-sm text-on-primary-container">{t.catalog.comboText}</p>
        </div>
        <Link href={link({ kind: "combo", cat: undefined, app: undefined, page: undefined })} className="h-9 px-3 rounded-lg bg-secondary-container text-primary font-label-code text-label-code font-bold uppercase inline-flex items-center justify-center gap-1 shrink-0">
          {t.catalog.comboCta}
          <Icon name="arrow_forward" className="text-[16px]" flip />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
        <aside className="space-y-6 lg:sticky lg:top-[180px] self-start bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <FilterDisclosure title={t.catalog.filters}>
            <div className="hidden lg:flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2">
                <Icon name="tune" /> {t.catalog.filters}
              </span>
              <Link href={base} className="font-label-code text-label-code text-outline hover:text-primary">{t.catalog.reset}</Link>
            </div>
            <div>
              <div className="field-label">{t.catalog.availability}</div>
              {checkRow(stock === "1", t.catalog.inStockNow, inStock, link({ stock: stock === "1" ? undefined : "1", page: undefined }))}
              {checkRow(stock === "0", t.catalog.onOrder, onOrder, link({ stock: stock === "0" ? undefined : "0", page: undefined }))}
            </div>
            <div>
              <div className="field-label">{t.catalog.articleKind}</div>
              {checkRow(kind === "combo", t.catalog.combos, comboCount, link({ kind: kind === "combo" ? undefined : "combo", page: undefined }))}
            </div>
            <div>
              <div className="field-label">{t.catalog.category}</div>
              {categories.map((c) => (
                <Link
                  key={c.key}
                  href={link({ cat: cat === c.key ? undefined : c.key, page: undefined })}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-body-sm text-body-sm transition-colors ${cat === c.key ? "bg-surface-container text-primary font-bold" : "hover:bg-surface-container-low"}`}
                >
                  {c[lang]}
                  <span className="px-1.5 rounded bg-surface-container-high text-on-surface-variant font-label-code text-label-code">{countOf(c.key)}</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="field-label">{t.catalog.application}</div>
              {applications.map((a) => (
                <Link
                  key={a.key}
                  href={link({ app: app === a.key ? undefined : a.key, page: undefined })}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-body-sm text-body-sm transition-colors ${app === a.key ? "bg-surface-container text-primary font-bold" : "hover:bg-surface-container-low"}`}
                >
                  {a[lang]}
                  <span className="px-1.5 rounded bg-surface-container-high text-on-surface-variant font-label-code text-label-code">{countApp(a.key)}</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="field-label">{t.catalog.cc}</div>
              {ccOptions.map((value) => checkRow(ccs.includes(value), `${value} cc`, countCc(value), toggleCc(value)))}
            </div>
            <div className="rounded-xl bg-primary text-on-primary p-5 space-y-3">
              <Icon name="architecture" className="text-secondary-container text-3xl" />
              <div className="font-headline-sm text-headline-sm font-bold">{t.catalog.customTitle}</div>
              <p className="font-body-sm text-body-sm text-on-primary-container">{t.catalog.customText}</p>
              <Link
                href={`/${lang}#contact-devis`}
                className="h-10 px-4 rounded-lg bg-secondary-container text-primary font-label-code text-label-code font-bold uppercase inline-flex items-center gap-2"
              >
                {t.catalog.customCta}
                <Icon name="arrow_forward" className="text-[16px]" flip />
              </Link>
            </div>
          </FilterDisclosure>
        </aside>

        <div>
          {hydratedProducts.length === 0 ? (
            <div className="p-10 rounded-xl bg-surface-container-lowest text-center text-on-surface-variant">{t.catalog.empty}</div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
              {hydratedProducts.map((product) => (
                <ProductCard key={product.id} product={product} lang={lang} t={t.product} />
              ))}
            </div>
          )}
          {pages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-10 font-label-metric text-label-metric">
              {page > 1 && (
                <Link href={link({ page: String(page - 1) })} className="h-10 px-4 rounded-lg bg-surface-container-lowest flex items-center">
                  {t.catalog.previous}
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={link({ page: n === 1 ? undefined : String(n) })}
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${n === page ? "bg-primary text-on-primary" : "bg-surface-container-lowest"}`}
                >
                  {n}
                </Link>
              ))}
              {page < pages && (
                <Link href={link({ page: String(page + 1) })} className="h-10 px-4 rounded-lg bg-surface-container-lowest flex items-center">
                  {t.catalog.next}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
