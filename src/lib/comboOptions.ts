import "server-only";
import { db } from "./db";

export type ComboComponentOption = {
  id: number;
  ref: string;
  nameFr: string;
  nameAr: string;
  image: string;
  priceMillimes: number;
  variants: { mm: string; priceMillimes: number }[];
};

/**
 * Products the admin can attach to a combo: standard (non-combo) culasse and
 * chemise articles with their priced épaisseurs. Inactive products stay
 * selectable so an existing combo can still be edited after one of its
 * components is hidden.
 */
export async function getComboComponentOptions() {
  const products = await db.product.findMany({
    where: { kind: "standard", category: { in: ["culasse", "chemise"] } },
    select: {
      id: true,
      ref: true,
      nameFr: true,
      nameAr: true,
      image: true,
      category: true,
      priceMillimes: true,
      variants: { select: { mm: true, priceMillimes: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ category: "asc" }, { ref: "asc" }],
  });

  const toOption = ({ id, ref, nameFr, nameAr, image, priceMillimes, variants }: (typeof products)[number]): ComboComponentOption => ({
    id,
    ref,
    nameFr,
    nameAr,
    image: image ?? "",
    priceMillimes,
    variants,
  });

  return {
    culasses: products.filter((product) => product.category === "culasse").map(toOption),
    chemises: products.filter((product) => product.category === "chemise").map(toOption),
  };
}
