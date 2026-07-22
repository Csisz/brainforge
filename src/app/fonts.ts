import localFont from "next/font/local";

/**
 * Self-hosted fonts (Stability B4). Replaces next/font/google so the production
 * build needs no network — Google Fonts are downloaded once by
 * scripts/fetch-fonts.mjs into ./fonts and committed. Same families, weights and
 * CSS variable names as before, so the design tokens (globals.css @theme) and
 * every rendering are unchanged.
 *
 * Each file is the latin-subset VARIABLE woff2 Google served, so one file covers
 * the family's whole weight range (Nunito 700–800, Inter 400–600). display:swap
 * mirrors next/font/google's default.
 */
export const nunito = localFont({
  src: "./fonts/nunito.woff2",
  weight: "700 800",
  style: "normal",
  display: "swap",
  variable: "--font-nunito",
});

export const inter = localFont({
  src: "./fonts/inter.woff2",
  weight: "400 600",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
});

export const plexMono = localFont({
  src: "./fonts/ibm-plex-mono.woff2",
  weight: "500",
  style: "normal",
  display: "swap",
  variable: "--font-plex-mono",
});
