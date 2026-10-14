import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Mèo Nổ — chơi online",
  description: "Mèo Nổ online cùng bạn bè: tạo bàn, gửi link mời, 2–7 người, có gói mở rộng và hướng dẫn từng lá bài.",
};

export default function MeoNoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#3b1609_0%,#140804_70%)] text-orange-50"><GamesShell>{children}</GamesShell></div>
  );
}
