import "server-only";
import { db } from "./db";
import { resolveProductVariants } from "./variants";

const CATALOG_CACHE_TTL_MS = 60_000;

async function fetchCatalogFacets() {
  const [inStock, onOrder, comboCount, byCategory, byApplication, byCc] = await Promise.all([
    db.product.count({ where: { active: true, stock: { gt: 0 } } }),
    db.product.count({ where: { active: true, stock: 0 } }),
    db.product.count({ where: { active: true, kind: "combo" } }),
    db.product.groupBy({ by: ["category"], where: { active: true }, _count: true }),
    db.product.groupBy({ by: ["application"], where: { active: true }, _count: true }),
    db.product.groupBy({ by: ["cc"], where: { active: true, cc: { not: null } }, _count: true }),
  ]);
  return { inStock, onOrder, comboCount, byCategory, byApplication, byCc };
}

async function fetchFeaturedProducts() {
  const rawFeatured = await db.product.findMany({
    where: { active: true, featured: true },
    orderBy: { updatedAt: "desc" },
    take: 4,
    include: {
      variants: { orderBy: { position: "asc" } },
      comboCulasse: { select: { priceMillimes: true, variants: { select: { mm: true, priceMillimes: true } } } },
      comboChemise: { select: { priceMillimes: true, variants: { select: { mm: true, priceMillimes: true } } } },
    },
  });
  return rawFeatured.map((p) => ({ ...p, variants: resolveProductVariants(p) }));
}

export type CatalogFacets = Awaited<ReturnType<typeof fetchCatalogFacets>>;
export type FeaturedProductList = Awaited<ReturnType<typeof fetchFeaturedProducts>>;

const globalForCatalog = globalThis as unknown as {
  __catalogFacetsCache?: { value: CatalogFacets; expiresAt: number };
  __catalogFacetsInFlight?: Promise<CatalogFacets>;
  __featuredProductsCache?: { value: FeaturedProductList; expiresAt: number };
  __featuredProductsInFlight?: Promise<FeaturedProductList>;
};

export function invalidateCatalogCache() {
  globalForCatalog.__catalogFacetsCache = undefined;
  globalForCatalog.__catalogFacetsInFlight = undefined;
  globalForCatalog.__featuredProductsCache = undefined;
  globalForCatalog.__featuredProductsInFlight = undefined;
}

export async function getCachedCatalogFacets(): Promise<CatalogFacets> {
  const now = Date.now();
  const cached = globalForCatalog.__catalogFacetsCache;
  if (cached && now < cached.expiresAt) return cached.value;

  if (!globalForCatalog.__catalogFacetsInFlight) {
    globalForCatalog.__catalogFacetsInFlight = fetchCatalogFacets()
      .then((value) => {
        globalForCatalog.__catalogFacetsCache = { value, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        globalForCatalog.__catalogFacetsInFlight = undefined;
      });
  }
  return globalForCatalog.__catalogFacetsInFlight;
}

export async function getCachedFeaturedProducts(): Promise<FeaturedProductList> {
  const now = Date.now();
  const cached = globalForCatalog.__featuredProductsCache;
  if (cached && now < cached.expiresAt) return cached.value;

  if (!globalForCatalog.__featuredProductsInFlight) {
    globalForCatalog.__featuredProductsInFlight = fetchFeaturedProducts()
      .then((value) => {
        globalForCatalog.__featuredProductsCache = { value, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        globalForCatalog.__featuredProductsInFlight = undefined;
      });
  }
  return globalForCatalog.__featuredProductsInFlight;
}
