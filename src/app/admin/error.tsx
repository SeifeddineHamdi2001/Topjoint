"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

export default function AdminError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="max-w-lg mx-auto my-16 px-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-error-container text-error flex items-center justify-center">
          <Icon name="error" className="text-[28px]" />
        </div>
        <h1 className="font-headline-md text-headline-md text-primary font-bold">
          Erreur dans l&apos;espace administration
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Une erreur s&apos;est produite lors du traitement de la requête.
          {digest && <span className="block mt-1 font-label-code text-label-code text-outline">Code : {digest}</span>}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => retry()}
            className="h-10 px-4 rounded-lg bg-secondary-container text-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center gap-2"
          >
            <Icon name="refresh" className="text-[18px]" /> Réessayer
          </button>
          <Link
            href="/admin"
            className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase inline-flex items-center gap-2"
          >
            <Icon name="dashboard" className="text-[18px]" /> Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
