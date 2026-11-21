import type { Metadata } from "next";
import { isLocale, type Locale } from "@/config/site";
import { getDictionary } from "@/i18n";
import { getShopSettings } from "@/lib/settings";
import { CheckoutView } from "@/components/cart/CheckoutView";

// Delivery fee comes from the admin settings, so always render with the current values.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "fr").cart.checkoutTitle, robots: { index: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "fr";
  const t = getDictionary(lang);
  const { deliveryFeeMillimes, freeDeliveryFromMillimes } = await getShopSettings();
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary font-bold mb-8">{t.cart.checkoutTitle}</h1>
      <CheckoutView lang={lang} t={t.cart} productT={t.product} phoneError={t.form.errors.phone} delivery={{ deliveryFeeMillimes, freeDeliveryFromMillimes }} />
    </div>
  );
}
