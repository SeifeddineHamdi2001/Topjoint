import Link from "next/link";
import { getDictionary } from "@/i18n";

// not-found receives no params; the French copy is followed by the Arabic one.
export default function NotFound() {
  const fr = getDictionary("fr");
  const ar = getDictionary("ar");
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
      <div className="font-display text-display text-primary">404</div>
      <h1 className="font-headline-md text-headline-md text-primary">{fr.notFound.title}</h1>
      <p className="font-headline-sm text-headline-sm text-on-surface-variant" dir="rtl">{ar.notFound.title}</p>
      <div className="flex justify-center gap-3 pt-4">
        <Link href="/fr" className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center">
          {fr.notFound.back}
        </Link>
        <Link href="/ar" className="h-11 px-5 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric font-bold inline-flex items-center">
          {ar.notFound.back}
        </Link>
      </div>
    </div>
  );
}
