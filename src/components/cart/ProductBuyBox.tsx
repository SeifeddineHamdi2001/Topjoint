"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { currency, formatPrice, formatThickness } from "@/config/catalog";
import { quantityTiers } from "@/config/pricing";
import type { Locale } from "@/config/site";
import type { Dictionary } from "@/i18n";
import { Icon } from "../Icon";
import { useCart, type CartProduct } from "./CartProvider";
import { QtyStepper } from "./QtyStepper";

type Props = { lang: Locale; product: CartProduct; t: Dictionary["product"] };

/** Product page purchase panel: price, épaisseur + price, quantity, add / buy now. */
export function ProductBuyBox({ lang, product, t }: Props) {
  const { add } = useCart();
  const router = useRouter();
  const variants = product.variants;
  const isCombo = product.kind === "combo";
  const isCompound = isCombo && variants.some((v) => v.mm.includes("+"));

  const culasseOptions = useMemo(() => {
    if (!isCompound) return [];
    return Array.from(new Set(variants.map((v) => v.mm.split("+")[0]?.trim()).filter(Boolean)));
  }, [variants, isCompound]);

  const chemiseOptions = useMemo(() => {
    if (!isCompound) return [];
    return Array.from(new Set(variants.map((v) => v.mm.split("+")[1]?.trim()).filter(Boolean)));
  }, [variants, isCompound]);

  const [qty, setQty] = useState(1);
  const [selectedCulasse, setSelectedCulasse] = useState(culasseOptions[0] ?? "");
  const [selectedChemise, setSelectedChemise] = useState(chemiseOptions[0] ?? "");
  const [thickness, setThickness] = useState(
    variants.length === 1
      ? variants[0].mm
      : isCompound && culasseOptions.length > 0
        ? variants[0]?.mm ?? ""
        : variants[0]?.mm ?? ""
  );
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!isCompound) return;
    const cul = selectedCulasse || culasseOptions[0];
    const chem = selectedChemise || chemiseOptions[0];
    if (cul) {
      const target = chem ? `${cul} + ${chem}` : cul;
      const match = variants.find((v) => v.mm === target) ?? variants.find((v) => v.mm.startsWith(cul));
      if (match) {
        setThickness(match.mm);
        setMissing(false);
      }
    }
  }, [selectedCulasse, selectedChemise, isCompound, chemiseOptions, culasseOptions, variants]);

  const selected = variants.find((variant) => variant.mm === thickness);
  const unit = selected?.priceMillimes ?? variants[0]?.priceMillimes ?? product.priceMillimes;
  const cur = currency[lang];
  const tier = [...quantityTiers].reverse().find((candidate) => qty >= candidate.min) ?? quantityTiers[0];

  function getVariantForCulasse(opt: string) {
    const targetChemise = selectedChemise || chemiseOptions[0];
    const target = targetChemise ? `${opt} + ${targetChemise}` : opt;
    return variants.find((v) => v.mm === target) ?? variants.find((v) => v.mm.startsWith(opt));
  }

  function getVariantForChemise(opt: string) {
    const targetCulasse = selectedCulasse || culasseOptions[0];
    const target = targetCulasse ? `${targetCulasse} + ${opt}` : opt;
    return variants.find((v) => v.mm === target) ?? variants.find((v) => v.mm.endsWith(opt));
  }

  function submit(buyNow: boolean) {
    if (variants.length > 0 && !thickness) return setMissing(true);
    add(product, qty, thickness, { openDrawer: !buyNow });
    if (buyNow) router.push(`/${lang}/commande`);
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-lg bg-surface-container-low flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="font-display-mobile text-display-mobile text-primary">
            {formatPrice(unit)} <span className="font-label-metric text-label-metric">{cur}</span>
          </span>
          {selected ? (
            <span className="block font-label-code text-label-code text-on-surface-variant mt-1">
              {formatThickness(selected.mm, lang)}
            </span>
          ) : (
            variants.length > 0 && (
              <span className="block font-label-code text-label-code text-secondary font-bold mt-1">
                {isCombo ? t.comboChooseThickness : t.chooseThickness}
              </span>
            )
          )}
        </div>
        <span className="font-label-code text-label-code text-on-surface-variant uppercase">{isCombo ? t.comboPrice : t.unitPrice}</span>
      </div>

      {isCombo && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary-fixed text-on-primary-fixed">
          <Icon name="inventory_2" className="text-[18px] mt-0.5 shrink-0" />
          <p className="font-body-sm text-body-sm leading-snug">{t.comboText}</p>
        </div>
      )}

      {variants.length > 0 && isCompound && (
        <div className="rounded-xl border border-secondary/30 bg-surface-container-lowest p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
            <div className="flex items-center gap-2">
              <Icon name="tune" className="text-secondary text-[20px]" />
              <span className="font-label-metric text-label-metric font-bold text-primary uppercase">
                {t.comboConfigTitle}
              </span>
            </div>
            <span className="font-label-code text-label-code text-secondary uppercase font-bold text-[11px] px-2 py-0.5 rounded bg-secondary-container">
              {t.comboBadge}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-code text-label-code text-on-surface-variant uppercase font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                {t.comboCulasseThickness}
              </span>
              {selectedCulasse && (
                <span className="font-label-code text-label-code text-secondary font-bold">
                  {selectedCulasse} mm
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {culasseOptions.map((opt) => {
                const isSel = selectedCulasse === opt;
                const matchVar = getVariantForCulasse(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedCulasse(opt);
                      setMissing(false);
                    }}
                    className={`min-h-[50px] p-2.5 rounded-lg border text-start transition-all ${
                      isSel
                        ? "border-primary bg-primary text-on-primary shadow-sm"
                        : "border-outline-variant/60 bg-surface-container-lowest text-primary hover:border-primary/50 hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-metric text-label-metric font-bold">{opt} mm</span>
                      {isSel && <Icon name="check" className="text-[16px] text-on-primary" />}
                    </div>
                    {matchVar && (
                      <span className={`block font-label-code text-label-code text-[11px] ${isSel ? "text-on-primary-container" : "text-on-surface-variant"}`}>
                        {formatPrice(matchVar.priceMillimes)} {cur}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {chemiseOptions.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-code text-label-code text-on-surface-variant uppercase font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {t.comboChemiseThickness}
                </span>
                {selectedChemise && (
                  <span className="font-label-code text-label-code text-secondary font-bold">
                    {selectedChemise} mm
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {chemiseOptions.map((opt) => {
                  const isSel = selectedChemise === opt;
                  const matchVar = getVariantForChemise(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSelectedChemise(opt);
                        setMissing(false);
                      }}
                      className={`min-h-[50px] p-2.5 rounded-lg border text-start transition-all ${
                        isSel
                          ? "border-primary bg-primary text-on-primary shadow-sm"
                          : "border-outline-variant/60 bg-surface-container-lowest text-primary hover:border-primary/50 hover:bg-surface-container-low"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-label-metric text-label-metric font-bold">{opt} mm</span>
                        {isSel && <Icon name="check" className="text-[16px] text-on-primary" />}
                      </div>
                      {matchVar && (
                        <span className={`block font-label-code text-label-code text-[11px] ${isSel ? "text-on-primary-container" : "text-on-surface-variant"}`}>
                          {formatPrice(matchVar.priceMillimes)} {cur}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {chemiseOptions.length === 1 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/40">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" className="text-secondary text-[18px]" />
                <span className="font-body-sm text-body-sm text-primary">
                  {t.comboChemiseThickness}
                </span>
              </div>
              <span className="font-label-metric text-label-metric font-bold text-primary">
                {chemiseOptions[0]} mm
              </span>
            </div>
          )}

          {selected && (
            <div className="p-3 rounded-lg bg-secondary-container/40 border border-secondary-container flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="task_alt" className="text-secondary text-[20px] shrink-0" />
                <span className="font-label-code text-label-code text-primary truncate">
                  <span className="font-bold text-secondary uppercase me-1">{t.comboSelectedThickness}</span>
                  {formatThickness(selected.mm, lang)}
                </span>
              </div>
              <span className="font-label-metric text-label-metric font-bold text-primary whitespace-nowrap shrink-0">
                {formatPrice(selected.priceMillimes)} {cur}
              </span>
            </div>
          )}

          {missing && (
            <p className="font-body-sm text-body-sm text-error">
              {t.comboVariantRequired}
            </p>
          )}
        </div>
      )}

      {variants.length > 0 && !isCompound && (
        <div className="rounded-xl border border-secondary/30 bg-surface-container-lowest p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
            <span className="font-label-metric text-label-metric font-bold text-primary uppercase">
              {isCombo ? t.comboChooseThickness : t.chooseThickness}
            </span>
            {selected && (
              <span className="font-label-code text-label-code text-secondary font-bold">
                {selected.mm} mm
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {variants.map((variant) => {
              const isSel = thickness === variant.mm;
              return (
                <button
                  key={variant.mm}
                  type="button"
                  onClick={() => {
                    setThickness(variant.mm);
                    setMissing(false);
                  }}
                  className={`min-h-[50px] p-2.5 rounded-lg border text-start transition-all ${
                    isSel
                      ? "border-primary bg-primary text-on-primary shadow-sm"
                      : "border-outline-variant/60 bg-surface-container-lowest text-primary hover:border-primary/50 hover:bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-label-metric text-label-metric font-bold">{variant.mm} mm</span>
                    {isSel && <Icon name="check" className="text-[16px] text-on-primary" />}
                  </div>
                  <span className={`block font-label-code text-label-code text-[11px] ${isSel ? "text-on-primary-container" : "text-on-surface-variant"}`}>
                    {formatPrice(variant.priceMillimes)} {cur}
                  </span>
                </button>
              );
            })}
          </div>
          {missing && <p className="mt-1 font-body-sm text-body-sm text-error">{isCombo ? t.comboVariantRequired : t.thicknessRequired}</p>}
        </div>
      )}

      <div className="rounded-lg bg-surface-container-low p-3 space-y-2">
        <div className="field-label mb-0">{t.tierTitle}</div>
        <div className="flex flex-wrap gap-2 font-label-code text-label-code">
          <span className={`px-2.5 py-1 rounded font-bold ${tier.discount === 0.2 ? "bg-secondary-container text-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}>
            {t.tier15} · −{Math.round(quantityTiers[1].discount * 100)}%
          </span>
          <span className={`px-2.5 py-1 rounded font-bold ${tier.discount === 0.25 ? "bg-secondary-container text-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}>
            {t.tier30} · −{Math.round(quantityTiers[2].discount * 100)}%
          </span>
        </div>
        <p className="font-body-sm text-[11px] text-on-surface-variant leading-snug">{t.tierHint}</p>
      </div>

      <div className="flex items-stretch gap-2">
        <QtyStepper
          value={qty}
          onChange={setQty}
          size="lg"
          labels={{ quantity: t.quantity, decrease: t.decrease, increase: t.increase }}
        />
        <button
          type="button"
          onClick={() => submit(false)}
          className="flex-1 min-w-0 h-12 rounded-lg bg-secondary-container hover:bg-secondary-fixed text-primary font-label-metric text-label-metric font-bold uppercase flex items-center justify-center gap-2 transition-colors px-2"
        >
          <Icon name="add_shopping_cart" className="text-[20px]" />
          <span className="truncate">{t.addToCart}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => submit(true)}
        className="w-full h-12 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-metric text-label-metric font-bold uppercase flex items-center justify-center gap-2 transition-colors"
      >
        <Icon name="bolt" className="text-[20px]" />
        {t.buyNow}
      </button>
    </div>
  );
}
