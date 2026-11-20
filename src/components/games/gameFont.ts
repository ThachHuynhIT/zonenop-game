import localFont from "next/font/local";

/**
 * Existing self-hosted monospace face for pixel-game display/control labels.
 * Full Vietnamese coverage; body text retains the readable sans face.
 */
export const gameFont = localFont({
  src: "../../app/fonts/GeistMono-latin-vietnamese.woff2",
  weight: "100 900",
  variable: "--font-game",
  display: "swap",
});
