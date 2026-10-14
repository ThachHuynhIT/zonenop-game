import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Ô Ăn Quan — chơi online",
  description: "Ô Ăn Quan online 2 người: bốc sỏi rải từng ô, ăn liên tiếp, giành quan — trò chơi dân gian Việt Nam.",
};

export default function OAnQuanLayout({ children }: { children: React.ReactNode }) {
  return <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#3a2412_0%,#140b05_70%)] text-amber-50"><GamesShell>{children}</GamesShell></div>;
}
