import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cairo, Geist, Hanken_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import { isLocale, locales } from "@/config/site";
import { getDictionary } from "@/i18n";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MetaPixel } from "@/components/site/MetaPixel";
import { getShopSettings } from "@/lib/settings";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-hanken", display: "swap" });
const cairo = Cairo({ subsets: ["arabic"], weight: ["600", "700", "800"], variable: "--font-cairo", display: "swap" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-ar", display: "swap" });

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: { default: t.meta.title, template: `%s — Top Joint` },
    description: t.meta.description,
    alternates: { languages: { fr: "/fr", ar: "/ar" } },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  // Tracking and branding must never take the shop down: null settings fall back to defaults.
  const settings = await getShopSettings().catch(() => null);

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={`${geist.variable} ${hanken.variable} ${cairo.variable} ${plexAr.variable}`}>
      <body className="bg-background font-body-md text-body-md text-on-surface antialiased">
        <CartProvider>
          <Header lang={lang} t={t} logoImage={settings?.logoImage ?? ""} />
          <main className="w-full pt-[116px] lg:pt-[160px] bg-background min-h-screen">{children}</main>
          <Footer lang={lang} t={t} logoImage={settings?.logoImage ?? ""} />
          <CartDrawer lang={lang} t={t.cart} productT={t.product} />
        </CartProvider>
        {settings?.metaPixelId && <MetaPixel pixelId={settings.metaPixelId} capi={Boolean(settings.metaAccessToken)} />}
      </body>
    </html>
  );
}
