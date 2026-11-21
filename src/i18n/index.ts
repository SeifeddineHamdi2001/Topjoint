import type { Locale } from "@/config/site";
import { ar } from "./ar";
import { fr, type Dictionary } from "./fr";

const dictionaries: Record<Locale, Dictionary> = { fr, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
