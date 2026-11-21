"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../Icon";

/**
 * Filter panel that is collapsed behind a "Filtres" summary on mobile and
 * always open in the desktop sidebar. A plain <details> cannot be forced open
 * by `lg:block` alone (the browser hides closed details content), hence the
 * small media-query effect.
 */
export function FilterDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      if (ref.current) ref.current.open = media.matches;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <details ref={ref} className="group">
      <summary className="lg:hidden flex items-center justify-between gap-2 p-4 cursor-pointer list-none">
        <span className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2">
          <Icon name="tune" /> {title}
        </span>
        <Icon name="expand_more" className="text-outline transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-4 lg:p-5 border-t lg:border-0 border-outline-variant/40 space-y-6">{children}</div>
    </details>
  );
}
