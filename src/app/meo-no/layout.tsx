import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Mèo Nổ — chơi online",
  description: "Mèo Nổ online cùng bạn bè: tạo bàn, gửi link mời, 2–7 người, có gói mở rộng và hướng dẫn từng lá bài.",
};

export default function MeoNoLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameThemeScope game="meono" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>
  );
}
