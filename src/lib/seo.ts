import type { Locale } from "@/config/site";

/** Serializes JSON-LD safely inside HTML `<script>` tags by escaping `<`. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Localized canonical and hreflang alternates relative to metadataBase. */
export function localeAlternates(lang: Locale, pathSuffix = "") {
  const suffix = pathSuffix === "" || pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
  return {
    canonical: `/${lang}${suffix}`,
    languages: {
      fr: `/fr${suffix}`,
      ar: `/ar${suffix}`,
      "x-default": `/fr${suffix}`,
    },
  };
}
