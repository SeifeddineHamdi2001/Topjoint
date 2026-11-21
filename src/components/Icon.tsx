type Props = { name: string; className?: string; flip?: boolean };

/** Material Symbols icon. `flip` mirrors directional icons in Arabic. */
export function Icon({ name, className = "", flip = false }: Props) {
  return (
    <span aria-hidden className={`material-symbols-outlined ${flip ? "flip-rtl" : ""} ${className}`}>
      {name}
    </span>
  );
}
