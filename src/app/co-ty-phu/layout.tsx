import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Cờ Tỷ Phú Việt Nam — chơi online",
  description: "Cờ Tỷ Phú với các địa danh Việt Nam: mua đất các tỉnh thành từ Quảng Ninh, Quảng Nam đến Kiên Giang… xây nhà, thu tiền thuê, chơi online 2–6 người.",
};

export default function CoTyPhuLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameThemeScope game="typhu" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>
  );
}
