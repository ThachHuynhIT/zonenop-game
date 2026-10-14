import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Đá Quý (Splendor) — chơi online",
  description: "Đá Quý — lối chơi Splendor online 2–4 người: lấy đá, mua thẻ, thu hút quý tộc, ai đạt điểm uy tín trước thắng.",
};

export default function SplendorLayout({ children }: { children: React.ReactNode }) {
  return <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#2a1540_0%,#0c0714_70%)] text-violet-50"><GamesShell>{children}</GamesShell></div>;
}
