import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Đấu Súng (Bang!) — chơi online",
  description: "Đấu Súng — lối chơi Bang! online 3–8 người: Cảnh sát trưởng, Phó, Kẻ cướp, Kẻ phản bội, cùng 7 bản mở rộng.",
};

export default function BangLayout({ children }: { children: React.ReactNode }) {
  return <GameThemeScope game="bang" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>;
}
