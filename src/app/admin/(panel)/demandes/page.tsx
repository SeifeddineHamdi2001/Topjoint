import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PAGE_SIZE, dateRange, formatDate, isQuoteStatus, pageOf, quoteStatuses, subjectLabels } from "@/config/admin";
import { requireOwner } from "@/lib/auth";
import { db, textSearch } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { PageTitle, StatusBadge } from "@/components/admin/StatusBadge";
import { FilterBar, Pagination, StatusTabs } from "@/components/admin/ListControls";

export const metadata = { title: "Demandes de devis" };

type Props = { searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; subject?: string; page?: string }> };

export default async function QuotesPage({ searchParams }: Props) {
  await requireOwner();
  const sp = await searchParams;
  const status = isQuoteStatus(sp.status) ? sp.status : undefined;
  const subject = sp.subject && Object.hasOwn(subjectLabels, sp.subject) ? sp.subject : undefined;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageOf(sp.page);

  const where: Prisma.QuoteRequestWhereInput = {
    ...(status && { status }),
    ...(subject && { subject }),
    ...dateRange(sp.from, sp.to),
    ...(q && { OR: [{ name: textSearch(q) }, { email: textSearch(q) }, { phone: textSearch(q) }, { company: textSearch(q) }, { message: textSearch(q) }] }),
  };
  const [quotes, total] = await Promise.all([
    db.quoteRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.quoteRequest.count({ where }),
  ]);

  const params = { status, subject, q: q || undefined, from: sp.from, to: sp.to };

  return (
    <>
      <PageTitle title="Demandes de devis & contact" />
      <StatusTabs path="/admin/demandes" params={params} statuses={quoteStatuses} current={status} />
      <FilterBar path="/admin/demandes" q={q} from={sp.from} to={sp.to} placeholder="Nom, société, e-mail, téléphone, message..." hidden={{ status }}>
        <div>
          <label className="field-label" htmlFor="subject">Sujet</label>
          <select id="subject" name="subject" defaultValue={subject ?? ""} className="field">
            <option value="">Tous</option>
            {Object.entries(subjectLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </FilterBar>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-start font-body-sm text-body-sm">
          <thead className="bg-primary text-on-primary font-label-code text-label-code uppercase">
            <tr>
              {["#", "Date", "Client", "Contact", "Sujet", "Langue", "Fichier", "Statut"].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-on-surface-variant">Aucune demande.</td></tr>
            )}
            {quotes.map((quote) => (
              <tr key={quote.id} className={`border-b border-outline-variant/40 hover:bg-surface-container-low ${quote.status === "NEW" ? "font-semibold" : ""}`}>
                <td className="px-4 py-3"><Link href={`/admin/demandes/${quote.id}`} className="text-secondary font-bold">{quote.id}</Link></td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(quote.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/demandes/${quote.id}`} className="text-primary hover:underline">{quote.name}</Link>
                  {quote.company && <div className="text-outline">{quote.company}</div>}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  <div>{quote.phone}</div>
                  <div className="text-outline">{quote.email}</div>
                </td>
                <td className="px-4 py-3">{subjectLabels[quote.subject] ?? quote.subject}</td>
                <td className="px-4 py-3 uppercase">{quote.locale}</td>
                <td className="px-4 py-3">{quote.attachmentPath ? <Icon name="attach_file" className="text-primary" /> : "—"}</td>
                <td className="px-4 py-3"><StatusBadge statuses={quoteStatuses} value={quote.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination path="/admin/demandes" params={params} page={page} total={total} pageSize={PAGE_SIZE} />
    </>
  );
}
