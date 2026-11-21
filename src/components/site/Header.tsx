import Link from "next/link";
import { Suspense } from "react";
import { categories } from "@/config/catalog";
import { site, type Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { CartButton } from "../cart/CartButton";
import { Icon } from "../Icon";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";

export function Header({ lang, t, logoImage = "" }: { lang: Locale; t: Dictionary; logoImage?: string }) {
  const base = `/${lang}`;
  const nav = [
    { href: base, label: t.header.nav.home },
    { href: `${base}/produits`, label: t.header.nav.products },
    { href: `${base}#services`, label: t.header.nav.services },
    { href: `${base}#contact-devis`, label: t.header.nav.custom },
    { href: `${base}#contact`, label: t.header.nav.contact },
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(20,43,69,0.06)]">
      <div className="w-full bg-primary text-on-primary">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-9 flex items-center justify-between font-label-code text-label-code">
          <div className="flex items-center gap-6">
            <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5" dir="ltr">
              <Icon name="call" className="text-[15px] text-secondary-container" />
              {site.phone}
            </a>
            <a
              href={`https://wa.me/${site.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-on-primary-container hover:text-on-primary"
            >
              <Icon name="chat" className="text-[15px] text-secondary-container" />
              {t.topbar.whatsapp}
            </a>
            <span className="hidden lg:flex items-center gap-1.5 text-on-primary-container">
              <Icon name="schedule" className="text-[15px]" />
              {t.topbar.hours}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden md:flex items-center gap-1 text-secondary-fixed">
              <Icon name="local_shipping" className="text-[14px]" />
              {t.topbar.shipping}
            </span>
            <Suspense>
              <LangSwitch lang={lang} label={t.header.switchLang} className="text-on-primary font-bold" />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="relative h-20 max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between gap-4 lg:gap-6">
        <Link href={base}>
          <Logo name={site.name} tagline={t.header.tagline} image={logoImage} />
        </Link>
        <form action={`${base}/produits`} className="flex-1 max-w-xl mx-4 hidden md:block">
          <SearchBox lang={lang} t={t.search} placeholder={t.header.searchPlaceholder} />
        </form>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <CartButton lang={lang} label={t.header.cart} />
          <Link
            href={`${base}#contact-devis`}
            className="hidden sm:flex h-11 px-5 rounded-lg bg-secondary-container text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold items-center gap-2 hover:bg-secondary-fixed transition-colors shadow-sm"
          >
            <Icon name="architecture" className="text-[18px]" />
            {t.header.quote}
          </Link>
          <Link
            href="/admin"
            title={t.header.admin}
            aria-label={t.header.admin}
            className="hidden sm:flex w-9 h-9 rounded-full bg-primary items-center justify-center shrink-0 hover:bg-primary-container transition-colors"
          >
            <Icon name="person" className="text-on-primary text-[18px]" />
          </Link>
          <MobileMenu
            lang={lang}
            items={[...nav, { href: "/admin", label: t.header.admin }]}
            menuLabel={t.header.menu}
            searchAction={`${base}/produits`}
            searchPlaceholder={t.header.searchPlaceholder}
            searchT={t.search}
          />
        </div>
      </div>

      <div className="hidden lg:block w-full bg-surface-container-lowest border-t border-outline-variant/30">
        <div className="max-w-7xl mx-auto px-6 h-11 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="px-3 py-1.5 whitespace-nowrap font-label-code text-label-code uppercase tracking-wider text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden 2xl:flex items-center gap-4 whitespace-nowrap text-outline font-label-code text-label-code">
            <span className="text-outline-variant">|</span>
            {categories.map((c) => (
              <Link key={c.key} href={`${base}/produits?cat=${c.key}`} className="hover:text-primary transition-colors">
                {c[lang]}
              </Link>
            ))}
            <Link href={`${base}#contact-devis`} className="text-secondary hover:underline font-semibold">
              {t.header.customPlans}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
