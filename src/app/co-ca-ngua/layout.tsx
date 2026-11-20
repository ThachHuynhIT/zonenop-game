import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { GamesShell } from "@/components/games/GamesShell";
import styles from "@/app/page.module.scss";

export const metadata: Metadata = {
  title: "Cờ Cá Ngựa — chơi online",
  description: "Cờ Cá Ngựa online 2–4 người theo luật Việt Nam: gieo xúc xắc, xuất quân, đá ngựa đối thủ về chuồng, lên chuồng theo số.",
};

export default function CaNguaLayout({ children }: { children: React.ReactNode }) {
  return <GameThemeScope game="cangua" className={`game-shell ${styles.page}`}><GamesShell>{children}</GamesShell></GameThemeScope>;
}
