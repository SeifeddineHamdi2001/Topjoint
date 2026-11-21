import { NextResponse, type NextRequest } from "next/server";
import { formatPrice, startingPriceMillimes } from "@/config/catalog";
import { db, textSearch, toInt32 } from "@/lib/db";
import { clientIpFromHeaders, consumeMemoryLimit } from "@/lib/rateLimit";

const SEARCH_TAKE = 6;

// Live search used by the header search box: GET /api/search?q=majesty&lang=fr
export async function GET(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  if (!consumeMemoryLimit(`search_ip:${ip}`, 60, 60_000)) {
    return NextResponse.json({ results: [], total: 0 }, { status: 429 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const lang = request.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "fr";
  if (q.length < 2) return NextResponse.json({ results: [], total: 0 });

  const n = toInt32(Number.parseInt(q, 10), 1);
  const where = {
    active: true,
    OR: [
      { ref: textSearch(q) },
      { nameFr: textSearch(q) },
      { nameAr: textSearch(q) },
      { compatibility: textSearch(q) },
      ...(n !== null ? [{ cc: n }] : []),
    ],
  };

  const products = await db.product.findMany({
    where,
    take: SEARCH_TAKE,
    orderBy: { featured: "desc" },
    include: { variants: true },
  });
  const total = products.length < SEARCH_TAKE ? products.length : await db.product.count({ where });

  return NextResponse.json(
    {
      total,
      results: products.map((p) => ({
        slug: p.slug,
        ref: p.ref,
        name: lang === "ar" ? p.nameAr : p.nameFr,
        image: p.image,
        price: formatPrice(startingPriceMillimes(p)),
        cc: p.cc,
        inStock: p.stock > 0,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
  );
}
