import type { Metadata } from "next";
import { Cairo, Geist, Hanken_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-hanken" });
// Arabic fonts so Arabic customer messages and product names render properly.
const cairo = Cairo({ subsets: ["arabic"], weight: ["600", "700"], variable: "--font-cairo", preload: false });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-plex-ar", preload: false });

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s — Admin Top Joint" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} ${hanken.variable} ${cairo.variable} ${plexAr.variable}`}>
      <body className="bg-surface-container-low font-body-md text-body-md text-on-surface antialiased">{children}</body>
    </html>
  );
}
