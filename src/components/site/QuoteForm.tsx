"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { submitQuote, type FormState } from "@/app/[lang]/actions";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";

const initial: FormState = { status: "idle" };

export function QuoteForm({ lang, t }: { lang: Locale; t: Dictionary["form"] }) {
  const [state, action, pending] = useActionState(submitQuote, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="locale" value={lang} />
      {/* Honeypot for bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="q-name" className="field-label">{t.name}</label>
          <input id="q-name" name="name" required maxLength={120} placeholder={t.namePh} className="field" />
        </div>
        <div>
          <label htmlFor="q-company" className="field-label">{t.company}</label>
          <input id="q-company" name="company" maxLength={160} placeholder={t.companyPh} className="field" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="q-email" className="field-label">{t.email}</label>
          <input id="q-email" name="email" type="email" required dir="ltr" placeholder="contact@entreprise.tn" className="field text-start" />
        </div>
        <div>
          <label htmlFor="q-phone" className="field-label">{t.phone}</label>
          <input id="q-phone" name="phone" type="tel" required dir="ltr" placeholder="+216 -- --- ---" className="field text-start" />
        </div>
      </div>
      <div>
        <label htmlFor="q-subject" className="field-label">{t.subject}</label>
        <select id="q-subject" name="subject" required className="field">
          {Object.entries(t.subjects).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="q-message" className="field-label">{t.message}</label>
        <textarea id="q-message" name="message" required rows={4} maxLength={5000} placeholder={t.messagePh} className="field h-auto py-3" />
      </div>
      <div>
        <label htmlFor="q-attachment" className="field-label">{t.attachment}</label>
        <input
          id="q-attachment"
          name="attachment"
          type="file"
          accept=".pdf,.dxf,.dwg,.step,.stp,.jpg,.jpeg,.png,.webp"
          aria-describedby="q-attachment-hint"
          className="block w-full font-body-sm text-body-sm file:me-3 file:rounded-lg file:border-0 file:bg-surface-container file:px-3 file:py-2 file:font-bold file:text-primary"
        />
        <p id="q-attachment-hint" className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{t.attachmentHint}</p>
      </div>
      <label className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
        <input id="q-consent" name="consent" type="checkbox" required className="mt-1 w-4 h-4 shrink-0" />
        <span>
          {t.consentLabel}
          <Link href={`/${lang}/confidentialite`} className="text-primary font-semibold underline hover:text-secondary">
            {t.consentLink}
          </Link>
          .
        </span>
      </label>
      {state.status === "error" && (
        <p role="alert" className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {t.errors[(state.error ?? "server") as keyof typeof t.errors] ?? t.errors.server}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="p-3 rounded-lg bg-primary-fixed text-on-primary-fixed font-body-sm text-body-sm flex items-center gap-2">
          <Icon name="check_circle" className="text-[20px]" />
          {t.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 rounded-lg bg-secondary-container hover:bg-secondary-fixed disabled:opacity-60 text-primary font-label-metric text-label-metric uppercase tracking-wider font-bold flex items-center justify-center gap-2 shadow-md transition-colors mt-2"
      >
        <Icon name="send" className="text-[20px]" flip />
        {pending ? t.sending : t.submit}
      </button>
    </form>
  );
}
