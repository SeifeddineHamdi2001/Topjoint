"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

export default function LocaleError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const pathname = usePathname();
  const isAr = pathname?.startsWith("/ar") ?? false;
  const lang = isAr ? "ar" : "fr";

  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20">
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-error-container text-error flex items-center justify-center">
          <Icon name="error" className="text-[28px]" />
        </div>
        <h1 className="font-headline-md text-headline-md text-primary font-bold">
          {isAr ? "حدث خطأ غير متوقع" : "Une erreur est survenue"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {isAr
            ? "تعذّر تحميل هذه الصفحة مؤقتًا. يرجى إعادة المحاولة أو العودة إلى الرئيسية."
            : "Cette page n'a pas pu être chargée momentanément. Vous pouvez réessayer ou revenir à l'accueil."}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 px-5 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center gap-2 transition-colors"
          >
            <Icon name="refresh" className="text-[18px]" />
            {isAr ? "إعادة المحاولة" : "Réessayer"}
          </button>
          <Link
            href={`/${lang}`}
            className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center gap-2 transition-colors"
          >
            <Icon name="home" className="text-[18px]" />
            {isAr ? "العودة إلى الرئيسية" : "Retour à l'accueil"}
          </Link>
        </div>
      </div>
    </div>
  );
}
