import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Nối Chữ — chơi online",
  description: "Nối Chữ online 2–8 người: nối từ ghép 2 tiếng, tiếng đầu trùng tiếng cuối của từ trước, hết giờ là bị loại.",
};

export default function NoiChuLayout({ children }: { children: React.ReactNode }) {
  return <GameThemeScope game="noichu" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>;
}
