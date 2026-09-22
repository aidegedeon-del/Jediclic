import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "JedicliC — Le poste de pilotage du professeur ivoirien",
  description:
    "Programme officiel, progression, cours, évaluations, notes et bulletins réunis dans un seul espace, pensé pour le système éducatif ivoirien. Créez votre compte en moins de deux minutes.",
};

/*
 * Viewport séparé de metadata (Next.js 14+).
 * user-scalable n'est PAS désactivé : le pinch-to-zoom doit rester possible
 * (WCAG 1.4.4 — Redimensionnement du texte).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * lang="fr" : indique la langue de la page aux technologies d'assistance
     * (WCAG 3.1.1 — Langue de la page).
     */
    <html
      lang="fr"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
