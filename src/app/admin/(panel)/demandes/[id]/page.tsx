import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, quoteStatuses, subjectLabels, whatsappUrl } from "@/config/admin";
import { requireOwner } from "@/lib/auth";
import { db, toInt32 } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { PageTitle, StatusBadge } from "@/components/admin/StatusBadge";
import { deleteQuote, markQuoteInProgress, updateQuote } from "../../../actions";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const quote = await db.quoteRequest.findUnique({ where: { id: toInt32(Number(id), 1) ?? 0 } });
  if (!quote) notFound();

  const isArabic = quote.locale === "ar";

  return (
    <>
      <Link href="/admin/demandes" className="inline-flex items-center gap-1 font-label-code text-label-code text-on-surface-variant mb-3">
        <Icon name="arrow_back" className="text-[16px]" /> Demandes
      </Link>
      <PageTitle title={`Demande #${quote.id}`}>
        <div className="flex items-center gap-3">
          {quote.status === "NEW" && (
            <form action={markQuoteInProgress}>
              <input type="hidden" name="id" value={quote.id} />
              <button className="h-9 px-3 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold">
                Marquer comme en cours
              </button>
            </form>
          )}
          <StatusBadge statuses={quoteStatuses} value={quote.status} />
        </div>
      </PageTitle>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest rounded-xl shadow-sm p-6">
            <div className="font-label-code text-label-code uppercase text-secondary font-bold mb-1">{subjectLabels[quote.subject] ?? quote.subject}</div>
            <div className="font-body-sm text-body-sm text-outline mb-4">
              Reçue le {formatDate(quote.createdAt)} · formulaire en {isArabic ? "arabe" : "français"}
            </div>
            <p dir={isArabic ? "rtl" : "ltr"} className="font-body-md text-body-md whitespace-pre-line leading-relaxed bg-surface-container-low rounded-lg p-4">
              {quote.message}
            </p>
            {quote.attachmentPath && (
              <a
                href={`/api/admin/files/${quote.attachmentPath}`}
                className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric font-bold"
              >
                <Icon name="download" className="text-[18px]" />
                {quote.attachmentName}
              </a>
            )}
          </section>

          <form action={updateQuote} className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-4">
            <input type="hidden" name="id" value={quote.id} />
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Suivi interne</h2>
            <div>
              <label htmlFor="status" className="field-label">Statut</label>
              <select id="status" name="status" defaultValue={quote.status} className="field">
                {Object.entries(quoteStatuses).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="adminNote" className="field-label">Note interne (prix proposé, délai, suivi...)</label>
              <textarea id="adminNote" name="adminNote" rows={4} defaultValue={quote.adminNote ?? ""} className="field h-auto py-3" />
            </div>
            <button className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase">Enregistrer</button>
          </form>
        </div>

        <aside className="space-y-6">
          <section className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-3">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Client</h2>
            <div className="font-label-metric text-label-metric">{quote.name}</div>
            {quote.company && <div className="font-body-sm text-body-sm text-on-surface-variant">{quote.company}</div>}
            <div className="font-body-sm text-body-sm" dir="ltr">{quote.phone}</div>
            <div className="font-body-sm text-body-sm" dir="ltr">{quote.email}</div>
            <div className="grid gap-2 pt-2">
              <a href={whatsappUrl(quote.phone)} target="_blank" rel="noopener noreferrer" className="h-10 rounded-lg bg-secondary-container text-primary font-label-metric text-label-metric font-bold flex items-center justify-center gap-2">
                <Icon name="chat" className="text-[18px]" /> WhatsApp
              </a>
              <a href={`tel:${quote.phone.replace(/\s/g, "")}`} className="h-10 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric font-bold flex items-center justify-center gap-2">
                <Icon name="call" className="text-[18px]" /> Appeler
              </a>
              <a
                href={`mailto:${quote.email}?subject=${encodeURIComponent(`Votre demande #${quote.id} — Top Joint`)}`}
                className="h-10 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric font-bold flex items-center justify-center gap-2"
              >
                <Icon name="mail" className="text-[18px]" /> Répondre par e-mail
              </a>
            </div>
          </section>
          <form action={deleteQuote}>
            <input type="hidden" name="id" value={quote.id} />
            <button className="w-full h-10 rounded-lg border border-error text-error font-label-metric text-label-metric font-bold flex items-center justify-center gap-2">
              <Icon name="delete" className="text-[18px]" /> Supprimer la demande
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
