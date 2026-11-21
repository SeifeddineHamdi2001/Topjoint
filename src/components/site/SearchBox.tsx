"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { currency } from "@/config/catalog";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";

type Result = { slug: string; ref: string; name: string; image: string; price: string; cc: number | null; inStock: boolean };

type Props = {
  lang: Locale;
  t: Dictionary["search"];
  placeholder: string;
  defaultValue?: string;
  className?: string;
};

/**
 * Search input (name="q") with live results under it. Pressing Enter submits the
 * surrounding form, or goes to the catalogue when there is none.
 */
export function SearchBox({ lang, t, placeholder, defaultValue = "", className = "" }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?lang=${lang}&q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = (await res.json()) as { results: Result[]; total: number };
        setResults(data.results);
        setTotal(data.total);
        setActive(-1);
      } catch {
        // aborted by the next keystroke
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, lang]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const allHref = `/${lang}/produits?q=${encodeURIComponent(q.trim())}`;
  const showPanel = open && q.trim().length >= 2;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (active >= 0 && results[active]) {
        e.preventDefault();
        setOpen(false);
        router.push(`/${lang}/produits/${results[active].slug}`);
      } else if (!e.currentTarget.form) {
        e.preventDefault();
        setOpen(false);
        router.push(allHref);
      }
    }
  }

  return (
    <div ref={wrapper} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Icon name="search" className="absolute start-3 text-outline text-[20px]" />
        <input
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-autocomplete="list"
          className="w-full h-11 ps-10 pe-4 bg-surface-container-low border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:bg-surface-container-lowest transition-all"
        />
      </div>
      {showPanel && (
        <div role="listbox" className="absolute z-50 top-full mt-1 inset-x-0 bg-surface-container-lowest rounded-xl shadow-[0_2px_4px_rgba(20,43,69,0.06),0_8px_16px_rgba(20,43,69,0.08)] border border-outline-variant/50 overflow-hidden">
          {loading && results.length === 0 && <div className="px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">{t.loading}</div>}
          {!loading && results.length === 0 && <div className="px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">{t.noResults}</div>}
          {results.map((r, i) => (
            <Link
              key={r.slug}
              href={`/${lang}/produits/${r.slug}`}
              onClick={() => setOpen(false)}
              role="option"
              aria-selected={i === active}
              className={`flex items-center gap-3 px-3 py-2 ${i === active ? "bg-surface-container" : "hover:bg-surface-container-low"}`}
            >
              <span className="w-11 h-11 shrink-0 rounded overflow-hidden bg-surface-container-low">
                {r.image && <img src={r.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-label-metric text-label-metric text-primary truncate">{r.name}</span>
                <span className="block font-label-code text-label-code text-on-surface-variant">
                  <span dir="ltr">{r.ref}</span>
                  {r.cc && ` · ${r.cc} cc`}
                </span>
              </span>
              <span className="font-label-metric text-label-metric text-primary whitespace-nowrap">
                {r.price} <span className="font-label-code text-[10px]">{currency[lang]}</span>
              </span>
            </Link>
          ))}
          {total > results.length && (
            <Link href={allHref} onClick={() => setOpen(false)} className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40 font-label-code text-label-code font-bold text-secondary hover:bg-surface-container-low">
              {t.seeAll} ({total})
              <Icon name="arrow_forward" className="text-[16px]" flip />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
