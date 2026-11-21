import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/config/site";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const products = await db.product
    .findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true, image: true },
      orderBy: { updatedAt: "desc" },
    })
    .catch(() => []);

  const staticEntries: MetadataRoute.Sitemap = [
    ...(["fr", "ar"] as const).map((lang) => ({
      url: `${siteUrl}/${lang}`,
      changeFrequency: "weekly" as const,
      priority: 1,
      alternates: {
        languages: {
          fr: `${siteUrl}/fr`,
          ar: `${siteUrl}/ar`,
        },
      },
    })),
    ...(["fr", "ar"] as const).map((lang) => ({
      url: `${siteUrl}/${lang}/produits`,
      changeFrequency: "daily" as const,
      priority: 0.9,
      alternates: {
        languages: {
          fr: `${siteUrl}/fr/produits`,
          ar: `${siteUrl}/ar/produits`,
        },
      },
    })),
    ...(["fr", "ar"] as const).map((lang) => ({
      url: `${siteUrl}/${lang}/confidentialite`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
      alternates: {
        languages: {
          fr: `${siteUrl}/fr/confidentialite`,
          ar: `${siteUrl}/ar/confidentialite`,
        },
      },
    })),
  ];

  const productEntries: MetadataRoute.Sitemap = products.flatMap((product) => {
    const absImage = product.image
      ? product.image.startsWith("http")
        ? product.image
        : `${siteUrl}${product.image}`
      : undefined;
    const alternates = {
      languages: {
        fr: `${siteUrl}/fr/produits/${product.slug}`,
        ar: `${siteUrl}/ar/produits/${product.slug}`,
      },
    };
    return (["fr", "ar"] as const).map((lang) => ({
      url: `${siteUrl}/${lang}/produits/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates,
      ...(absImage && { images: [absImage] }),
    }));
  });

  return [...staticEntries, ...productEntries];
}
