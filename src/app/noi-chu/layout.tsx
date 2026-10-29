import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Nối Chữ — chơi online",
  description: "Nối Chữ online 2–8 người: nối từ ghép 2 tiếng, tiếng đầu trùng tiếng cuối của từ trước, hết giờ là bị loại.",
};

export default function NoiChuLayout({ children }: { children: React.ReactNode }) {
  return <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#0f3a3a_0%,#06191c_70%)] text-teal-50"><GamesShell>{children}</GamesShell></div>;
}
