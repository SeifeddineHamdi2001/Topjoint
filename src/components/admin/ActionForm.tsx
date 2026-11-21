"use client";

import { useActionState } from "react";
import type { FormResult } from "@/app/admin/actions";

type Props = {
  action: (prev: FormResult, form: FormData) => Promise<FormResult>;
  submitLabel: string;
  className?: string;
  /** Clear the inputs after a successful submit (e.g. "add a staff account"). */
  resetOnSuccess?: boolean;
  children: React.ReactNode;
};

/** Form for a Server Action that returns { error } or { ok }, shown under the fields. */
export function ActionForm({ action, submitLabel, className = "", resetOnSuccess = false, children }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={`space-y-4 ${className}`} key={resetOnSuccess && state.ok ? state.ok : undefined}>
      {children}
      {state.error && <p className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">{state.error}</p>}
      {state.ok && <p className="p-3 rounded-lg bg-primary-fixed text-on-primary-fixed font-body-sm text-body-sm">{state.ok}</p>}
      <button disabled={pending} className="h-11 px-5 rounded-lg bg-primary text-on-primary disabled:opacity-60 font-label-metric text-label-metric font-bold uppercase">
        {pending ? "Enregistrement..." : submitLabel}
      </button>
    </form>
  );
}
