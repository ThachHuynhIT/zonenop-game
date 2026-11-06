import localFont from "next/font/local";

/**
 * Rounded display face (with Vietnamese) for game titles and headings; loaded only with the games shell.
 * Baloo 2 (SIL OFL, see fonts/Baloo2-OFL.txt) is self-hosted instead of next/font/google so the build
 * never fetches fonts from Google (Vercel's Turbopack build failed on that fetch). The file is the
 * variable font (wght 400-800) subset to Latin + Vietnamese.
 */
export const gameFont = localFont({
  src: "./fonts/Baloo2-latin-vietnamese.woff2",
  weight: "400 800",
  variable: "--font-game",
  display: "swap",
});
