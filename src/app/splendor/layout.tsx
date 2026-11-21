import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Đá Quý (Splendor) — chơi online",
  description: "Đá Quý — lối chơi Splendor online 2–4 người: lấy đá, mua thẻ, thu hút quý tộc, ai đạt điểm uy tín trước thắng.",
};

export default function SplendorLayout({ children }: { children: React.ReactNode }) {
  return <GameThemeScope game="splendor" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>;
}
