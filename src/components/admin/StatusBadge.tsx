type Statuses = Record<string, { label: string; className: string }>;

export function StatusBadge({ statuses, value }: { statuses: Statuses; value: string }) {
  const status = statuses[value];
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-label-code text-label-code font-bold whitespace-nowrap ${status?.className ?? ""}`}>
      {status?.label ?? value}
    </span>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">{title}</h1>
      {children}
    </div>
  );
}
