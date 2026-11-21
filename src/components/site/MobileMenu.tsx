"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";
import { SearchBox } from "./SearchBox";

type Item = { href: string; label: string };

type Props = {
  lang: Locale;
  items: Item[];
  menuLabel: string;
  searchAction: string;
  searchPlaceholder: string;
  searchT: Dictionary["search"];
};

export function MobileMenu({ lang, items, menuLabel, searchAction, searchPlaceholder, searchT }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-11 w-11 rounded-lg bg-primary text-on-primary flex items-center justify-center"
      >
        <Icon name={open ? "close" : "menu"} />
      </button>
      {open && (
        <div className="absolute top-full inset-x-0 bg-surface-container-lowest border-t border-outline-variant/40 shadow-lg p-4 space-y-3">
          <form action={searchAction}>
            <SearchBox lang={lang} t={searchT} placeholder={searchPlaceholder} />
          </form>
          <nav className="flex flex-col">
            {items.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-3 font-label-metric text-label-metric uppercase tracking-wider text-primary border-b border-outline-variant/30"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
