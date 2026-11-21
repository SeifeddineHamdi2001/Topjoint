import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { applications, categories, currency, formatPrice, formatThickness, labelOf, startingPriceMillimes } from "@/config/catalog";
import { isLocale, type Locale } from "@/config/site";
import { getDictionary } from "@/i18n";
import { toCartProduct } from "@/lib/cartProduct";
import { db } from "@/lib/db";
import { resolveProductVariants } from "@/lib/variants";
import { ProductBuyBox } from "@/components/cart/ProductBuyBox";
import { Icon } from "@/components/Icon";
import { ProductCard } from "@/components/site/ProductCard";
import { MetaViewContent } from "@/components/site/MetaViewContent";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams?: Promise<{ fromCombo?: string }> };

const variantsOrder = { variants: { orderBy: { position: "asc" as const } } };

const componentSelect = {
  id: true,
  ref: true,
  nameFr: true,
  nameAr: true,
  slug: true,
  image: true,
  priceMillimes: true,
  variants: { select: { mm: true, priceMillimes: true }, orderBy: { position: "asc" as const } },
} as const;

const comboInclude = {
  ...variantsOrder,
  comboCulasse: { select: componentSelect },
  comboChemise: { select: componentSelect },
} as const;

const load = cache(async (slug: string) => {
  return db.product.findFirst({ where: { slug, active: true }, include: comboInclude });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const product = await load(slug);
  if (!product) return {};
  return { title: lang === "ar" ? product.nameAr : product.nameFr };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : "fr";
  const t = getDictionary(lang);
  const product = await load(slug);
  if (!product) notFound();

  const sp = searchParams ? await searchParams : undefined;
  const fromComboSlug = sp?.fromCombo;

  const isCombo = product.kind === "combo";
  const components = [product.comboCulasse, product.comboChemise].filter((component): component is NonNullable<typeof component> => Boolean(component));
  const separateTotal = components.reduce((sum, component) => sum + startingPriceMillimes(component), 0);
  const savings = Math.max(0, separateTotal - startingPriceMillimes(product));

  const [related, componentCombos, parentComboFromParam] = await Promise.all([
    db.product.findMany({
      where: isCombo
        ? { active: true, kind: "combo", id: { not: product.id } }
        : { active: true, category: product.category, id: { not: product.id } },
      take: 3,
      orderBy: { updatedAt: "desc" },
      include: variantsOrder,
    }),
    !isCombo
      ? db.product.findMany({
          where: {
            active: true,
            kind: "combo",
            OR: [{ comboCulasseId: product.id }, { comboChemiseId: product.id }],
          },
          take: 3,
          orderBy: { updatedAt: "desc" },
          include: variantsOrder,
        })
      : Promise.resolve([]),
    fromComboSlug && !isCombo
      ? db.product.findFirst({
          where: { slug: fromComboSlug, active: true, kind: "combo" },
          select: { id: true, slug: true, nameFr: true, nameAr: true, ref: true, image: true },
        })
      : Promise.resolve(null),
  ]);

  const activeParentCombo = parentComboFromParam ?? componentCombos[0];

  const name = lang === "ar" ? product.nameAr : product.nameFr;
  const description = lang === "ar" ? product.descriptionAr : product.descriptionFr;
  const inStock = product.stock > 0;
  const variants = resolveProductVariants(product);
  const variantLabel = isCombo ? t.product.comboVariants : t.product.thickness;
  const variantTile = variants.length ? variants.map((variant) => formatThickness(variant.mm, lang)).join(" / ") : "";
  const tiles: [string, string][] = [
    [t.product.cc, product.cc ? `${product.cc} cc` : ""],
    [variantLabel, variantTile],
    [t.product.material, product.material],
    [t.product.compatibility, product.compatibility],
    [t.product.dimensions, product.dimensions],
    [t.product.application, labelOf(applications, product.application, lang)],
  ].filter(([, value]) => value) as [string, string][];
  const specs: [string, string][] = [
    [t.product.category, labelOf(categories, product.category, lang)],
    ...(isCombo && components.length
      ? ([[t.product.comboIncludes, components.map((component) => component.ref).join(" + ")]] as [string, string][])
      : []),
    ...tiles,
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <MetaViewContent productRef={product.ref} priceTnd={startingPriceMillimes(product) / 1000} />
      <nav className="flex flex-wrap items-center gap-2 font-label-code text-label-code uppercase text-on-surface-variant mb-6">
        <Link href={`/${lang}`} className="hover:text-primary">{t.header.nav.home}</Link>
        <Icon name="chevron_right" className="text-[16px]" flip />
        <Link href={`/${lang}/produits`} className="hover:text-primary">{t.header.nav.products}</Link>
        {activeParentCombo && (
          <>
            <Icon name="chevron_right" className="text-[16px]" flip />
            <Link href={`/${lang}/produits/${activeParentCombo.slug}`} className="hover:text-primary">
              {lang === "ar" ? activeParentCombo.nameAr : activeParentCombo.nameFr}
            </Link>
          </>
        )}
        <Icon name="chevron_right" className="text-[16px]" flip />
        <span className="text-primary font-bold">{name}</span>
      </nav>

      {activeParentCombo && (
        <div className="mb-6 p-4 rounded-xl border border-secondary-container bg-secondary-fixed/25 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-secondary-container text-primary flex items-center justify-center shrink-0">
              <Icon name="inventory_2" className="text-[20px]" />
            </span>
            <div>
              <span className="block font-label-code text-label-code uppercase tracking-wider text-secondary font-bold">
                {t.product.partOfCombo}
              </span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                {lang === "ar" ? activeParentCombo.nameAr : activeParentCombo.nameFr}
              </span>
            </div>
          </div>
          <Link
            href={`/${lang}/produits/${activeParentCombo.slug}`}
            className="h-10 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center gap-2 transition-colors shrink-0"
          >
            <Icon name="arrow_back" className="text-[18px]" flip />
            {t.product.backToCombo}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-7">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
            <div className="rounded-lg overflow-hidden bg-surface-container-low aspect-square">
              {product.image && <img src={product.image} alt={name} fetchPriority="high" decoding="async" className="w-full h-full object-contain" />}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 font-label-code text-label-code">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-secondary font-bold uppercase">{labelOf(categories, product.category, lang)}</span>
                {isCombo && <span className="px-2 py-0.5 rounded bg-secondary-container text-primary font-bold uppercase">{t.product.comboBadge}</span>}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-bold" dir="ltr">{t.product.ref} {product.ref}</span>
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">{name}</h1>
            <div className={`flex items-center gap-2 font-label-code text-label-code font-semibold ${inStock ? "text-on-primary-fixed-variant" : "text-outline"}`}>
              <span className={`w-2 h-2 rounded-full ${inStock ? "bg-secondary-container" : "bg-outline-variant"}`} />
              {inStock ? t.product.inStock : t.product.outOfStock}
            </div>
            {tiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {tiles.map(([label, value]) => (
                  <div key={label} className="p-3 rounded-lg bg-surface-container-low">
                    <div className="font-label-code text-label-code uppercase text-on-surface-variant">{label}</div>
                    <div className="font-label-metric text-label-metric text-primary mt-1">{value}</div>
                  </div>
                ))}
              </div>
            )}
            <ProductBuyBox lang={lang} product={toCartProduct({ ...product, variants })} t={t.product} />

            {isCombo && components.length > 0 && (
              <div className="rounded-xl border border-secondary-container bg-secondary-fixed/20 p-4 space-y-3">
                <div>
                  <div className="font-label-code text-label-code uppercase tracking-wider text-secondary font-bold">{t.product.comboEyebrow}</div>
                  <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{t.product.comboIncludes}</h2>
                </div>
                <div className="space-y-2">
                  {components.map((component) => (
                    <Link
                      key={component.id}
                      href={`/${lang}/produits/${component.slug}?fromCombo=${encodeURIComponent(product.slug)}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                    >
                      <span className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-low shrink-0">
                        {component.image && <img src={component.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-label-code text-label-code text-secondary font-bold" dir="ltr">{component.ref}</span>
                        <span className="block font-label-metric text-label-metric text-primary leading-snug line-clamp-2">
                          {lang === "ar" ? component.nameAr : component.nameFr}
                        </span>
                        <span className="block sm:hidden font-label-code text-label-code text-on-surface-variant mt-0.5">
                          {formatPrice(startingPriceMillimes(component))} {currency[lang]}
                        </span>
                      </span>
                      <span className="hidden sm:block font-label-metric text-label-metric text-primary whitespace-nowrap">
                        {formatPrice(startingPriceMillimes(component))} {currency[lang]}
                      </span>
                    </Link>
                  ))}
                </div>
                {separateTotal > 0 && (
                  <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-secondary-container/60 font-body-sm text-body-sm">
                    <span className="text-on-surface-variant">{t.product.comboSeparately}</span>
                    <span className="text-primary">{formatPrice(separateTotal)} {currency[lang]}</span>
                  </div>
                )}
                {savings > 0 && (
                  <p className="text-end font-label-metric text-label-metric text-secondary font-bold">
                    {t.product.comboSave} {formatPrice(savings)} {currency[lang]}
                  </p>
                )}
              </div>
            )}

            <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant">
              {t.product.perks.map((perk, i) => (
                <li key={perk} className="flex items-center gap-2">
                  <Icon name={["local_shipping", "payments", "support_agent"][i]} className="text-[18px] text-secondary" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-primary text-on-primary rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-secondary-container text-primary flex items-center justify-center">
                <Icon name="architecture" />
              </span>
              <span className="font-headline-sm text-headline-sm font-bold">{t.product.customTitle}</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-primary-container">{t.product.customText}</p>
            <Link
              href={`/${lang}#contact-devis`}
              className="h-11 px-4 rounded-lg bg-surface-container-lowest text-primary font-label-metric text-label-metric font-bold uppercase flex items-center justify-between"
            >
              {t.product.customCta}
              <Icon name="arrow_forward" className="text-[18px]" flip />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 bg-surface-container-lowest rounded-xl p-5 sm:p-6 md:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="font-headline-md text-headline-md text-primary font-bold mb-4">{t.product.specs}</h2>
          <dl className="space-y-2">
            {specs.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3 rounded-lg bg-surface-container-low font-body-sm text-body-sm">
                <dt className="text-on-surface-variant">{label}</dt>
                <dd className="text-primary font-bold text-end">{value}</dd>
              </div>
            ))}
            {variants.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-surface-container-low font-body-sm text-body-sm">
                <dt className="text-on-surface-variant mb-2">{isCombo ? t.product.comboVariants : t.product.thicknessPrice}</dt>
                <dd className="space-y-1">
                  {variants.map((variant) => (
                    <div key={variant.mm} className="flex justify-between gap-3">
                      <span className="text-primary font-bold">{formatThickness(variant.mm, lang)}</span>
                      <span className="text-primary font-bold whitespace-nowrap">{formatPrice(variant.priceMillimes)} {currency[lang]}</span>
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
        {description && (
          <div>
            <h2 className="font-headline-md text-headline-md text-primary font-bold mb-4">{t.product.description}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line">{description}</p>
          </div>
        )}
      </div>

      {!isCombo && componentCombos.length > 0 && (
        <section className="mt-12 rounded-xl bg-primary text-on-primary p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="font-label-code text-label-code uppercase tracking-wider text-secondary-fixed font-bold mb-1">{t.product.comboEyebrow}</div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-primary font-bold">{t.product.comboTitle}</h2>
              <p className="font-body-sm text-body-sm text-on-primary-container mt-1">{t.product.comboText}</p>
            </div>
            <Link
              href={`/${lang}/produits?kind=combo`}
              className="h-10 px-4 rounded-lg bg-secondary-container text-primary font-label-code text-label-code font-bold uppercase inline-flex items-center justify-center gap-2 shrink-0"
            >
              {t.product.comboSeeAll}
              <Icon name="arrow_forward" className="text-[16px]" flip />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            {componentCombos.map((combo) => (
              <ProductCard key={combo.id} product={combo} lang={lang} t={t.product} />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">{t.product.related}</h2>
            <Link
              href={isCombo ? `/${lang}/produits?kind=combo` : `/${lang}/produits?cat=${product.category}`}
              className="font-label-code text-label-code font-bold uppercase text-primary flex items-center gap-1"
            >
              {t.product.seeAll}
              <Icon name="chevron_right" className="text-[16px]" flip />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            {related.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} lang={lang} t={t.product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
