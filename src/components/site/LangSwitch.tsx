"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/config/site";
import { Icon } from "../Icon";

/** Links to the same page in the other language. */
export function LangSwitch({ lang, label, className = "" }: { lang: Locale; label: string; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const other: Locale = lang === "fr" ? "ar" : "fr";
  const target = pathname.replace(/^\/(fr|ar)(?=\/|$)/, `/${other}`) + (search ? `?${search}` : "");
  return (
    <Link href={target} hrefLang={other} className={`flex items-center gap-1.5 hover:text-secondary-fixed transition-colors ${className}`}>
      <Icon name="translate" className="text-[15px]" />
      <span>{label}</span>
    </Link>
  );
}
