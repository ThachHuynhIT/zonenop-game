import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Ô Ăn Quan — chơi online",
  description: "Ô Ăn Quan online 2 người: bốc sỏi rải từng ô, ăn liên tiếp, giành quan — trò chơi dân gian Việt Nam.",
};

export default function OAnQuanLayout({ children }: { children: React.ReactNode }) {
  return <GameThemeScope game="oanquan" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>;
}
