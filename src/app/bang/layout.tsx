import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Đấu Súng (Bang!) — chơi online",
  description: "Đấu Súng — lối chơi Bang! online 3–8 người: Cảnh sát trưởng, Phó, Kẻ cướp, Kẻ phản bội, cùng 7 bản mở rộng.",
};

export default function BangLayout({ children }: { children: React.ReactNode }) {
  return <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#4a2a10_0%,#140a04_70%)] text-amber-50"><GamesShell>{children}</GamesShell></div>;
}
