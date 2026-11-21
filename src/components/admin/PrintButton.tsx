"use client";

import { Icon } from "@/components/Icon";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="print:hidden h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase flex items-center gap-2">
      <Icon name="print" className="text-[18px]" /> Imprimer
    </button>
  );
}
