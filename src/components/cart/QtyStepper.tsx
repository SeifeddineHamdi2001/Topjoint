"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  labels?: { decrease?: string; increase?: string; quantity?: string };
  className?: string;
};

const sizes = {
  sm: { box: "h-8", button: "w-6", input: "w-8 text-[11px]", glyph: "text-[15px]" },
  md: { box: "h-10", button: "w-7", input: "w-9 text-xs", glyph: "text-[17px]" },
  lg: { box: "h-12", button: "w-8", input: "w-12 text-sm", glyph: "text-[19px]" },
} as const;

/**
 * Quantity control with − / + buttons AND a free-text field, so the customer can
 * either tap or type the exact number. The value is clamped on blur / Enter.
 */
export function QtyStepper({ value, onChange, min = 1, max = 999, size = "md", labels, className = "" }: Props) {
  const [draft, setDraft] = useState(String(value));
  const classes = sizes[size];

  // Keep the field in sync when the value changes from the buttons or from the cart.
  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`flex items-center bg-surface-container rounded-lg shrink-0 ${classes.box} ${className}`}>
      <button
        type="button"
        aria-label={labels?.decrease ?? "−"}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={`${classes.button} h-full flex items-center justify-center ${classes.glyph} font-bold text-primary hover:text-secondary disabled:opacity-40 disabled:hover:text-primary`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={labels?.quantity ?? "Quantité"}
        value={draft}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d]/g, "").slice(0, 4);
          setDraft(raw);
          const parsed = Number.parseInt(raw, 10);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
        }}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        className={`${classes.input} h-full min-w-0 bg-transparent text-center font-label-metric font-bold text-primary focus:outline-none`}
      />
      <button
        type="button"
        aria-label={labels?.increase ?? "+"}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={`${classes.button} h-full flex items-center justify-center ${classes.glyph} font-bold text-primary hover:text-secondary disabled:opacity-40 disabled:hover:text-primary`}
      >
        +
      </button>
    </div>
  );
}
