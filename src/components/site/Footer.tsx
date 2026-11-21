import Link from "next/link";
import { categories } from "@/config/catalog";
import { site, type Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";
import { Logo } from "./Logo";

export function Footer({ lang, t, logoImage = "" }: { lang: Locale; t: Dictionary; logoImage?: string }) {
  const base = `/${lang}`;
  return (
    <footer className="w-full bg-primary-container text-on-primary-container">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-4">
          <Logo name={site.name} inverted image={logoImage} />
          <p className="font-body-sm text-body-sm leading-relaxed">{t.footer.about}</p>
          <div className="pt-2 flex flex-col gap-1 font-label-code text-label-code">
            <span className="text-secondary-fixed">{t.footer.tolerance}</span>
            <span>DIN • ASME • ISO 9001</span>
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="font-headline-sm text-headline-sm text-on-primary uppercase tracking-wider">{t.footer.products}</h4>
          <ul className="space-y-2.5 font-body-sm text-body-sm">
            {categories.map((c) => (
              <li key={c.key}>
                <Link href={`${base}/produits?cat=${c.key}`} className="hover:text-on-primary transition-colors">
                  {c[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="font-headline-sm text-headline-sm text-on-primary uppercase tracking-wider">{t.footer.services}</h4>
          <ul className="space-y-2.5 font-body-sm text-body-sm">
            {t.footer.serviceLinks.map((label) => (
              <li key={label}>
                <Link href={`${base}#contact-devis`} className="hover:text-on-primary transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="font-headline-sm text-headline-sm text-on-primary uppercase tracking-wider">{t.footer.workshop}</h4>
          <div className="space-y-3 font-body-sm text-body-sm">
            <p className="flex items-start gap-2">
              <Icon name="location_on" className="text-[18px] text-secondary-container mt-0.5" />
              {t.contact.address}
            </p>
            <p className="flex items-center gap-2">
              <Icon name="call" className="text-[18px] text-secondary-container" />
              <span dir="ltr">
                {site.phone} / {site.phone2}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Icon name="mail" className="text-[18px] text-secondary-container" />
              <a href={`mailto:${site.email}`} className="hover:text-on-primary">
                {site.email}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Icon name="schedule" className="text-[18px] text-secondary-container" />
              {t.footer.hours}
            </p>
          </div>
        </div>
      </div>
      <div className="w-full bg-primary">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-label-code text-label-code">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {t.footer.legal.map((label, i) =>
              i === 1 ? (
                <Link key={label} href={`${base}/confidentialite`} className="hover:text-on-primary underline underline-offset-4 transition-colors">
                  {label}
                </Link>
              ) : (
                <span key={label}>{label}</span>
              ),
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>
              © {new Date().getFullYear()} {site.name.toUpperCase()}. {t.footer.rights}
            </span>
            <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary font-bold text-[10px]">TND</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
