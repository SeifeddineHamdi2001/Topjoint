import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { fr } from "@/i18n/fr";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: fr.meta.title,
    short_name: site.name,
    description: fr.meta.description,
    start_url: "/fr",
    display: "standalone",
    background_color: "#f7fafd",
    theme_color: "#00162e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
