import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Tiến Lên Miền Nam — chơi online",
  description: "Chơi Tiến Lên Miền Nam online cùng bạn bè: tạo phòng, gửi link mời, 2–4 người.",
};

export default function TienLenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#0f2e22_0%,#07130e_70%)] text-white">
      <GamesShell>{children}</GamesShell>
    </div>
  );
}
