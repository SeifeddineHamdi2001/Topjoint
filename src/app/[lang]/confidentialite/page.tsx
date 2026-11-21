import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, site } from "@/config/site";
import { getDictionary } from "@/i18n";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).privacy.title };
}

export default async function PrivacyPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).privacy;

  return (
    <section className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <p className="font-label-code text-label-code uppercase text-secondary font-bold">{t.subtitle}</p>
        <h1 className="font-headline-lg text-headline-lg text-primary font-bold">{t.title}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t.intro}</p>
      </header>

      <div className="space-y-4">
        {t.sections.map((section) => (
          <article key={section.title} className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-2">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{section.title}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{section.body}</p>
          </article>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="font-body-sm text-body-sm text-on-surface-variant">
          <span className="font-bold text-primary me-2">{t.contactLabel}</span>
          <a href={`mailto:${site.email}`} className="underline hover:text-primary">{site.email}</a>
          {" · "}
          <span dir="ltr">{site.phone}</span>
        </div>
        <Link href={`/${lang}`} className="inline-flex h-10 px-4 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold items-center">
          {t.back}
        </Link>
      </div>
    </section>
  );
}
