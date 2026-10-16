import type { Metadata } from "next";
import { GameThemeScope } from "@/components/game-ui";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { gameFont } from "@/components/games/gameFont";

export const metadata: Metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <GameThemeScope
      game={null}
      className={`game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#2a1b4d_0%,#0d0818_70%)] text-white ${gameFont.variable} [&_h1]:[font-family:var(--font-game)] [&_h2]:[font-family:var(--font-game)] [&_h3]:[font-family:var(--font-game)]`}
    >
      <main>
        <AdminDashboard />
      </main>
    </GameThemeScope>
  );
}
