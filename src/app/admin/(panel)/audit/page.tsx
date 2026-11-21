import type { Prisma } from "@prisma/client";
import { PAGE_SIZE, dateRange, formatDate, pageOf } from "@/config/admin";
import { requireOwner } from "@/lib/auth";
import { db, textSearch } from "@/lib/db";
import { PageTitle } from "@/components/admin/StatusBadge";
import { FilterBar, Pagination } from "@/components/admin/ListControls";

export const metadata = { title: "Journal d'audit" };

type Props = { searchParams: Promise<{ q?: string; from?: string; to?: string; page?: string }> };

export default async function AuditPage({ searchParams }: Props) {
  await requireOwner();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageOf(sp.page);

  const where: Prisma.AuditLogWhereInput = {
    ...dateRange(sp.from, sp.to),
    ...(q && {
      OR: [
        { action: textSearch(q) },
        { actorEmail: textSearch(q) },
        { target: textSearch(q) },
        { ip: textSearch(q) },
        { detail: textSearch(q) },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
  ]);

  const params = { q: q || undefined, from: sp.from, to: sp.to };

  return (
    <>
      <PageTitle title="Journal d'audit sécurité" />
      <FilterBar path="/admin/audit" q={q} from={sp.from} to={sp.to} placeholder="Action, acteur, cible, IP, détail..." />

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-start font-body-sm text-body-sm">
          <thead className="bg-primary text-on-primary font-label-code text-label-code uppercase">
            <tr>
              {["Date", "Action", "Acteur", "Cible", "IP", "Détail"].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Aucun événement enregistré.</td></tr>
            )}
            {logs.map((entry) => (
              <tr key={entry.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                <td className="px-4 py-3 font-label-code text-label-code font-bold text-primary whitespace-nowrap">{entry.action}</td>
                <td className="px-4 py-3">
                  <div>{entry.actorEmail ?? "—"}</div>
                  {entry.actorRole && <div className="font-label-code text-label-code text-outline">{entry.actorRole}</div>}
                </td>
                <td className="px-4 py-3 font-label-code text-label-code whitespace-nowrap">{entry.target ?? "—"}</td>
                <td className="px-4 py-3 font-label-code text-label-code whitespace-nowrap" dir="ltr">{entry.ip ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface-variant break-words max-w-md">{entry.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination path="/admin/audit" params={params} page={page} total={total} pageSize={PAGE_SIZE} />
    </>
  );
}
