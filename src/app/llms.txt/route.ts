import { applications, categories, formatPrice, startingPriceMillimes } from "@/config/catalog";
import { quantityTiers } from "@/config/pricing";
import { getSiteUrl, site } from "@/config/site";
import { db } from "@/lib/db";
import { getShopSettings } from "@/lib/settings";
import { resolveProductVariants } from "@/lib/variants";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getSiteUrl();
  const [settings, products] = await Promise.all([
    getShopSettings().catch(() => null),
    db.product
      .findMany({
        where: { active: true },
        orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
        take: 50,
        include: {
          variants: { orderBy: { position: "asc" } },
          comboCulasse: { select: { priceMillimes: true, variants: { select: { mm: true, priceMillimes: true } } } },
          comboChemise: { select: { priceMillimes: true, variants: { select: { mm: true, priceMillimes: true } } } },
        },
      })
      .catch(() => []),
  ]);

  const deliveryFee = settings ? formatPrice(settings.deliveryFeeMillimes) : "7.000";
  const freeFrom =
    settings && settings.freeDeliveryFromMillimes > 0
      ? `Free delivery from ${formatPrice(settings.freeDeliveryFromMillimes)} TND`
      : "No automatic free-delivery threshold";

  const tierLines = quantityTiers
    .filter((t) => t.discount > 0)
    .map((t) => `- ${t.min}+ items across cart: ${Math.round(t.discount * 100)}% discount`);

  const productLines = products.map((p) => {
    const resolved = { ...p, variants: resolveProductVariants(p) };
    const price = formatPrice(startingPriceMillimes(resolved));
    const stockLabel = p.stock > 0 ? "In stock" : "Made to order";
    return `- [${p.ref}] ${p.nameFr} / ${p.nameAr} — from ${price} TND (${stockLabel}) — ${siteUrl}/fr/produits/${p.slug}`;
  });

  const lines = [
    `# ${site.name}`,
    "",
    "> Tunisian industrial gasket workshop and bilingual (French / Arabic) e-commerce store specializing in standard motor gaskets and custom CNC/waterjet gasket manufacturing.",
    "",
    "## Key Pages",
    `- [French Homepage](${siteUrl}/fr): Overview, services, custom quote form, workshop contact`,
    `- [Arabic Homepage](${siteUrl}/ar): Arabic RTL storefront and quote request form`,
    `- [French Product Catalogue](${siteUrl}/fr/produits): Searchable standard gaskets and culasse+chemise combos`,
    `- [Arabic Product Catalogue](${siteUrl}/ar/produits): Arabic RTL product catalogue`,
    `- [Privacy Policy (FR)](${siteUrl}/fr/confidentialite) | [Privacy Policy (AR)](${siteUrl}/ar/confidentialite)`,
    `- [Sitemap](${siteUrl}/sitemap.xml)`,
    "",
    "## Contact & Workshop",
    `- Phone & WhatsApp: ${site.phone} (https://wa.me/${site.whatsapp})`,
    "- Address: Sidi Ameur, Route R100, Sahline, Monastir, Tunisia",
    `- Google Maps: ${site.mapsUrl}`,
    "- Hours: Monday - Saturday, 08:00 - 18:00 (Africa/Tunis)",
    "- Payment: Cash on delivery (COD) in Tunisian Dinars (TND), phone confirmation before shipping across Tunisia (24-48h)",
    "",
    "## Capabilities & Product Scope",
    `- Gasket categories: ${categories.map((c) => `${c.fr} (${c.ar})`).join(", ")}`,
    `- Applications: ${applications.map((a) => `${a.fr} (${a.ar})`).join(", ")}`,
    "- Custom manufacturing: Precision laser / CNC / waterjet cutting (±0.05 mm tolerance) from technical drawings (PDF, DXF, DWG, STEP), worn gasket samples, or dimensions.",
    `- Delivery fee: ${deliveryFee} TND (${freeFrom})`,
    ...(tierLines.length ? ["- Cart volume discounts:", ...tierLines.map((l) => `  ${l}`)] : []),
    "",
    ...(productLines.length
      ? [`## Featured & Active Catalogue (${productLines.length} shown)`, ...productLines]
      : ["## Active Catalogue", `- Browse live availability at ${siteUrl}/fr/produits`]),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
