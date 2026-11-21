import Link from "next/link";
import { listHref as href } from "@/config/admin";
import { Icon } from "@/components/Icon";

type Params = Record<string, string | number | undefined>;

/** Status tabs that keep the other filters (search, dates...) of the list. */
export function StatusTabs({ path, params, statuses, current }: { path: string; params: Params; statuses: Record<string, { label: string }>; current?: string }) {
  const tab = (value?: string) =>
    `px-3 py-1.5 rounded-lg font-label-metric text-label-metric ${value === current ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant hover:text-primary"}`;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Link href={href(path, { ...params, status: undefined, page: undefined })} className={tab(undefined)}>Toutes</Link>
      {Object.entries(statuses).map(([key, s]) => (
        <Link key={key} href={href(path, { ...params, status: key, page: undefined })} className={tab(key)}>{s.label}</Link>
      ))}
    </div>
  );
}

/**
 * GET form with search + date range. `hidden` carries filters that live elsewhere (status tab);
 * `children` adds extra fields (e.g. a select) before the buttons.
 */
export function FilterBar({ path, q, from, to, placeholder, hidden = {}, children }: {
  path: string;
  q: string;
  from?: string;
  to?: string;
  placeholder: string;
  hidden?: Params;
  children?: React.ReactNode;
}) {
  const active = Boolean(q || from || to);
  return (
    <form action={path} className="flex flex-wrap items-end gap-3 mb-5 bg-surface-container-lowest rounded-xl shadow-sm p-4">
      {Object.entries(hidden).map(([key, value]) => value !== undefined && value !== "" && <input key={key} type="hidden" name={key} value={value} />)}
      <div className="relative flex-1 min-w-[220px]">
        <label className="field-label" htmlFor="q">Recherche</label>
        <Icon name="search" className="absolute start-3 bottom-3 text-outline text-[20px]" />
        <input id="q" name="q" defaultValue={q} placeholder={placeholder} className="field ps-10" />
      </div>
      <div>
        <label className="field-label" htmlFor="from">Du</label>
        <input id="from" name="from" type="date" defaultValue={from} className="field" />
      </div>
      <div>
        <label className="field-label" htmlFor="to">Au</label>
        <input id="to" name="to" type="date" defaultValue={to} className="field" />
      </div>
      {children}
      <button className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-metric text-label-metric font-bold uppercase">Filtrer</button>
      {(active || children) && (
        <Link href={href(path, { status: hidden.status })} className="h-11 px-3 flex items-center font-label-metric text-label-metric text-on-surface-variant hover:text-primary">
          Effacer
        </Link>
      )}
    </form>
  );
}

export function Pagination({ path, params, page, total, pageSize }: { path: string; params: Params; page: number; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const button = (target: number, icon: string, disabled: boolean) =>
    disabled ? (
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-outline-variant"><Icon name={icon} className="text-[20px]" /></span>
    ) : (
      <Link href={href(path, { ...params, page: target === 1 ? undefined : target })} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container">
        <Icon name={icon} className="text-[20px]" />
      </Link>
    );
  return (
    <div className="flex items-center justify-between gap-3 mt-4 font-body-sm text-body-sm text-on-surface-variant">
      <span>{first}–{last} sur {total}</span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {button(page - 1, "chevron_left", page <= 1)}
          <span className="font-label-metric text-label-metric">Page {page} / {pages}</span>
          {button(page + 1, "chevron_right", page >= pages)}
        </div>
      )}
    </div>
  );
}
