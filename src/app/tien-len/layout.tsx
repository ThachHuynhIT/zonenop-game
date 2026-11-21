import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Tiến Lên Miền Nam — chơi online",
  description: "Chơi Tiến Lên Miền Nam online cùng bạn bè: tạo phòng, gửi link mời, 2–4 người.",
};

export default function TienLenLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameThemeScope game="tienlen" className={`game-shell ${styles.page}`}>
      <GamesShell>{children}</GamesShell>
    </GameThemeScope>
  );
}
