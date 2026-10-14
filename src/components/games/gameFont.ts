import { Baloo_2 } from "next/font/google";

/** Rounded display face (with Vietnamese) for game titles and headings; loaded only with the games shell. */
export const gameFont = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-game",
  display: "swap",
});
