import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl, isLocale, site, type Locale } from "@/config/site";
import { getDictionary } from "@/i18n";
import { getCachedFeaturedProducts } from "@/lib/catalogCache";
import { localeAlternates, safeJsonLd } from "@/lib/seo";
import { Icon } from "@/components/Icon";
import { ProductCard } from "@/components/site/ProductCard";
import { QuoteForm } from "@/components/site/QuoteForm";

export const dynamic = "force-dynamic";

const HERO_IMAGE = "/hero.jpg";

// Category cards, in the same order as t.categoriesSection.items.
const CATEGORY_CARDS = [
  { cat: "culasse", image: "/products/p28.jpg", accent: false },
  { cat: "chemise", image: "/products/p30.jpg", accent: false },
  { cat: "chaudier", image: "/products/p35.jpg", accent: false },
  { cat: "carter", image: "/products/p36.jpg", accent: false },
  { cat: "marine", image: "/products/p41.jpg", accent: true },
];

const STAT_ICONS = ["inventory_2", "hardware", "timer", "local_shipping"];
const WHY_ICONS = ["straighten", "all_inclusive", "support_agent", "groups"];
const STEP_ICONS = ["file_upload", "calculate", "verified", "local_shipping"];

function SectionHeading({ eyebrow, title, text, center = false }: { eyebrow: string; title: string; text: string; center?: boolean }) {
  return (
    <div className={center ? "text-center max-w-3xl mx-auto mb-14" : "max-w-3xl mb-12"}>
      <div className="font-label-code text-label-code uppercase tracking-wider text-secondary font-bold mb-2">{eyebrow}</div>
      <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary uppercase font-bold tracking-tight">{title}</h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-2">{text}</p>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "fr";
  const t = getDictionary(lang);
  return {
    title: { absolute: t.meta.title },
    description: t.meta.description,
    alternates: localeAlternates(lang, ""),
  };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "fr";
  const t = getDictionary(lang);
  const base = `/${lang}`;
  const siteUrl = getSiteUrl();

  const featured = await getCachedFeaturedProducts();

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name,
    description: t.meta.description,
    url: `${siteUrl}/${lang}`,
    image: `${siteUrl}/hero.jpg`,
    telephone: site.phone,
    sameAs: [`https://wa.me/${site.whatsapp}`],
    address: {
      "@type": "PostalAddress",
      streetAddress: t.contact.address,
      addressLocality: "Ben Arous",
      addressRegion: "Tunis",
      addressCountry: "TN",
    },
    areaServed: { "@type": "Country", name: "Tunisia" },
    openingHours: "Mo-Sa 08:00-18:00",
    priceRange: "TND",
  };

  return (
    <div className="flex flex-col w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }} />
      {/* HERO */}
      <section className="relative w-full overflow-hidden bg-primary text-on-primary">
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #b2c8e9 1px, transparent 0)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute -top-32 end-0 w-96 h-96 rounded-full bg-secondary-container/10 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tertiary-container/80 text-secondary-fixed font-label-code text-label-code uppercase w-fit">
                <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
                {t.hero.badge}
              </div>
              <h1 className="font-display-mobile text-display-mobile md:font-display md:text-display text-on-primary tracking-tight font-extrabold uppercase">
                {t.hero.titleA}
                <span className="text-secondary-container">{t.hero.titleB}</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-primary-container max-w-2xl leading-relaxed">{t.hero.text}</p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href={`${base}/produits`}
                  className="h-12 px-6 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold inline-flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <Icon name="shopping_bag" className="text-[20px]" />
                  {t.hero.ctaProducts}
                </Link>
                <a
                  href="#contact-devis"
                  className="h-12 px-6 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold inline-flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Icon name="architecture" className="text-[20px]" />
                  {t.hero.ctaQuote}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {t.hero.pills.map((pill, i) => (
                  <span key={pill} className="contents">
                    {i > 0 && <span className="text-on-primary-container font-label-code text-label-code">•</span>}
                    <span className="px-3 py-1 rounded bg-tertiary-container text-on-tertiary font-label-code text-label-code font-medium">{pill}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-xl overflow-hidden bg-primary-container shadow-2xl">
                <img src={HERO_IMAGE} alt="" fetchPriority="high" decoding="async" className="w-full h-80 object-cover opacity-90 hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-transparent" />
                <div className="absolute bottom-4 inset-x-4 bg-tertiary/80 backdrop-blur-md p-4 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon name="precision_manufacturing" className="text-secondary-container text-3xl" />
                    <div>
                      <div className="font-headline-sm text-headline-sm text-on-primary font-bold">{t.hero.cardTitle}</div>
                      <div className="font-label-code text-label-code text-on-primary-container">{t.hero.cardText}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-secondary-container text-primary font-label-code text-label-code font-bold uppercase whitespace-nowrap">ISO 9001</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full bg-tertiary py-5 relative z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {t.stats.map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-3">
                <Icon name={STAT_ICONS[i]} className="text-secondary-container text-2xl" />
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-primary font-bold leading-none">{stat.value}</div>
                  <div className="font-label-code text-label-code text-on-primary-container mt-1">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="w-full py-20 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <SectionHeading {...t.categoriesSection} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
            {CATEGORY_CARDS.map((card, i) => {
              const item = t.categoriesSection.items[i];
              return (
                <div key={card.cat} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
                  <div className="relative h-44 overflow-hidden bg-surface-container">
                    <img src={card.image} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <span
                      className={`absolute top-3 start-3 px-2 py-0.5 rounded font-label-code text-label-code font-bold uppercase ${card.accent ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary"}`}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-primary font-bold mb-2">{item.title}</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{item.text}</p>
                    </div>
                    <div className="pt-6">
                      <Link
                        href={`${base}/produits?cat=${card.cat}`}
                        className="w-full h-10 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center justify-between px-4 transition-colors"
                      >
                        {card.accent ? t.categoriesSection.discover : t.categoriesSection.see}
                        <Icon name="arrow_forward" className="text-[18px]" flip />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="w-full py-20 bg-background" id="produits-stock">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="font-label-code text-label-code uppercase tracking-wider text-secondary font-bold mb-2">{t.featured.eyebrow}</div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary uppercase font-bold tracking-tight">{t.featured.title}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t.featured.text}</p>
            </div>
          </div>
          {featured.length === 0 ? (
            <div className="p-10 rounded-xl bg-surface-container-lowest text-center text-on-surface-variant">{t.catalog.empty}</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} lang={lang} t={t.product} />
              ))}
            </div>
          )}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low">
            <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="info" className="text-secondary text-[20px]" />
              {t.featured.disclaimer}
            </div>
            <Link
              href={`${base}/produits`}
              className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-metric text-label-metric font-bold uppercase whitespace-nowrap inline-flex items-center gap-2 transition-colors"
            >
              {t.featured.seeCatalog}
              <Icon name="arrow_forward" className="text-[18px]" flip />
            </Link>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="w-full py-20 bg-surface-container-low" id="services">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <SectionHeading {...t.services} center />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-6">
                  <Icon name="shelves" className="text-3xl" />
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-3">{t.services.standard.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed">{t.services.standard.text}</p>
                <ul className="space-y-3 font-body-sm text-body-sm text-on-surface mb-8">
                  {t.services.standard.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <Icon name="check_circle" className="text-secondary-container text-lg mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={`${base}/produits`}
                className="w-full h-12 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center justify-center gap-2 transition-colors"
              >
                {t.services.standard.cta}
                <Icon name="launch" className="text-[18px]" flip />
              </Link>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 end-0 w-32 h-32 bg-secondary-container/10 rounded-es-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
                    <Icon name="carpenter" className="text-3xl" />
                  </div>
                  <span className="px-3 py-1 rounded bg-secondary-container text-primary font-label-code text-label-code font-bold uppercase tracking-wider">
                    {t.services.custom.badge}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-3">{t.services.custom.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed">{t.services.custom.text}</p>
                <ul className="space-y-3 font-body-sm text-body-sm text-on-surface mb-8">
                  {t.services.custom.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <Icon name="verified" className="text-secondary text-lg mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="#contact-devis"
                className="w-full h-12 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Icon name="architecture" className="text-[18px]" />
                {t.services.custom.cta}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CUSTOM MANUFACTURING BANNER */}
      <section className="w-full py-16 bg-primary text-on-primary relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(#b2c8e9 1px, transparent 1px), linear-gradient(90deg, #b2c8e9 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex px-3 py-1.5 rounded bg-secondary-container text-primary font-label-code text-label-code font-bold uppercase">{t.banner.eyebrow}</div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg uppercase font-bold">{t.banner.title}</h2>
            <p className="font-body-lg text-body-lg text-on-primary-container">{t.banner.text}</p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#contact-devis"
                className="h-12 px-6 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold inline-flex items-center gap-2 transition-colors"
              >
                <Icon name="architecture" className="text-[20px]" />
                {t.banner.ctaQuote}
              </a>
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="h-12 px-6 rounded-lg border border-on-primary-container text-on-primary hover:bg-primary-container font-label-metric text-label-metric uppercase tracking-wider font-bold inline-flex items-center gap-2 transition-colors"
              >
                <Icon name="call" className="text-[20px]" />
                {t.banner.ctaCall}
              </a>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-on-primary-container/40 bg-tertiary-container/60 p-6 font-label-code text-label-code text-on-primary-container" dir="ltr">
              <div className="flex justify-between mb-4 text-secondary-fixed">
                <span>{t.banner.specLabel}</span>
                <span>ISO 2768-m</span>
              </div>
              <svg viewBox="0 0 300 170" className="w-full h-auto" aria-hidden>
                <rect x="40" y="20" width="220" height="130" rx="10" fill="none" stroke="#fc9430" strokeWidth="2" />
                <circle cx="150" cy="85" r="42" fill="none" stroke="#fc9430" strokeWidth="2" />
                {[[62, 42], [238, 42], [62, 128], [238, 128]].map(([x, y]) => (
                  <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="none" stroke="#b2c8e9" strokeWidth="1.5" />
                ))}
                <line x1="108" y1="85" x2="192" y2="85" stroke="#b2c8e9" strokeDasharray="4 3" />
                <text x="150" y="80" fill="#ffdcc3" fontSize="11" textAnchor="middle">Ø 84.0</text>
                <line x1="40" y1="162" x2="260" y2="162" stroke="#b2c8e9" />
                <text x="150" y="158" fill="#b2c8e9" fontSize="10" textAnchor="middle">220.0 mm</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="w-full py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <SectionHeading {...t.why} center />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.why.items.map((item, i) => (
              <div key={item.title} className="p-6 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-5">
                    <Icon name={WHY_ICONS[i]} className="text-3xl" />
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-primary font-bold mb-2">{item.title}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{item.text}</p>
                </div>
                <div className="mt-6 pt-4 font-label-code text-label-code text-secondary font-bold">{item.foot}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="w-full py-20 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <SectionHeading {...t.process} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.process.steps.map((step, i) => {
              const last = i === t.process.steps.length - 1;
              return (
                <div key={step.title} className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div
                      className={`w-10 h-10 rounded-full font-headline-sm text-headline-sm font-bold flex items-center justify-center mb-4 ${last ? "bg-secondary-container text-primary" : "bg-primary text-on-primary"}`}
                    >
                      0{i + 1}
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-primary font-bold mb-2">
                      {i + 1}. {step.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{step.text}</p>
                  </div>
                  <div className={`mt-6 pt-4 flex items-center gap-1.5 font-label-code text-label-code ${last ? "text-secondary font-bold" : "text-on-surface-variant"}`}>
                    <Icon name={STEP_ICONS[i]} className="text-[16px]" />
                    {step.foot}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CONTACT + QUOTE FORM */}
      <section className="w-full py-20 bg-surface-container-low" id="contact-devis">
        <div className="max-w-7xl mx-auto px-4 md:px-6" id="contact">
          <SectionHeading {...t.contact} center />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <Icon name="call" />
                  </div>
                  <div className="flex-1">
                    <div className="font-label-code text-label-code text-on-surface-variant uppercase font-bold">{t.contact.phoneLabel}</div>
                    <div className="font-headline-sm text-headline-sm text-primary font-bold mt-0.5" dir="ltr">
                      <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-secondary transition-colors">
                        {site.phone}
                      </a>
                    </div>
                    <div className="font-body-sm text-body-sm text-outline mt-0.5">{t.contact.phoneHint}</div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                      <Icon name="chat" />
                    </div>
                    <div>
                      <div className="font-headline-sm text-headline-sm text-primary font-bold">{t.contact.whatsappTitle}</div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">{t.contact.whatsappHint}</div>
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${site.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-code text-label-code font-bold uppercase transition-colors"
                  >
                    {t.contact.open}
                  </a>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <Icon name="location_on" />
                  </div>
                  <div>
                    <div className="font-label-code text-label-code text-on-surface-variant uppercase font-bold">{t.contact.addressLabel}</div>
                    <div className="font-body-md text-body-md text-primary font-bold mt-0.5">{t.contact.address}</div>
                    <div className="font-body-sm text-body-sm text-outline mt-0.5">{t.topbar.hours}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm h-56 relative bg-surface-container">
                <iframe
                  title={t.contact.mapLabel}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(site.mapsQuery)}&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
            <div className="lg:col-span-7 bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-md">
              <div className="mb-6">
                <h3 className="font-headline-md text-headline-md text-primary font-bold">{t.form.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{t.form.text}</p>
              </div>
              <QuoteForm lang={lang} t={t.form} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
