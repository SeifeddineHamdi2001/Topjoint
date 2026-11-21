/** Brand mark: an uploaded logo when set, otherwise the built-in gasket ring placeholder. */
export function Logo({ name, tagline, inverted = false, image = "" }: { name: string; tagline?: string; inverted?: boolean; image?: string }) {
  return (
    <span className="flex items-center gap-3 shrink-0 min-w-0">
      {image ? (
        <img
          src={image}
          alt={name}
          className={`h-9 sm:h-10 w-auto max-w-[100px] sm:max-w-[150px] object-contain shrink-0 rounded ${inverted ? "bg-white/95 p-1" : ""}`}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden>
          <rect width="40" height="40" rx="4" fill={inverted ? "#ffffff" : "#142b45"} />
          <circle cx="20" cy="20" r="11" fill="none" stroke="#fc9430" strokeWidth="5" />
          {[[7, 7], [33, 7], [7, 33], [33, 33]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill={inverted ? "#142b45" : "#ffffff"} />
          ))}
        </svg>
      )}
      <span className="flex flex-col min-w-0">
        <span className={`font-headline-sm text-headline-sm uppercase tracking-tight font-bold leading-tight truncate ${inverted ? "text-on-primary" : "text-primary"}`}>
          {name}
        </span>
        {tagline && (
          <span className={`font-label-code text-label-code uppercase tracking-wider truncate ${inverted ? "text-on-primary-container" : "text-on-surface-variant"}`}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
