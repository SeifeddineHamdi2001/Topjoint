import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/config/site";
import { SESSION_COOKIE, staffCanAccess, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.redirect(new URL("/admin/login", request.url));
    // Staff only handle orders. Pages and actions also call requireOwner(), which is the real check.
    if (session.role === "staff" && !staffCanAccess(pathname)) return NextResponse.redirect(new URL("/admin/commandes", request.url));
    return NextResponse.next();
  }

  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();

  // No language in the URL: pick Arabic for Arabic browsers, French otherwise.
  const accept = request.headers.get("accept-language") ?? "";
  const locale = /^ar\b/i.test(accept) ? "ar" : defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals, metadata/app icons, and static files (anything with a dot).
  matcher: ["/((?!api|_next|icon|apple-icon|opengraph-image|twitter-image|.*\\..*).*)"],
};
