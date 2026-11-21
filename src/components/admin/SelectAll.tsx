"use client";

/** Header checkbox that toggles every row checkbox belonging to `form`. */
export function SelectAll({ form }: { form: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      className="w-4 h-4 accent-secondary-container"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${form}"][name="ids"]`).forEach((box) => {
          box.checked = e.target.checked;
        });
      }}
    />
  );
}
