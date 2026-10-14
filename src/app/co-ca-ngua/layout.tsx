import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Cờ Cá Ngựa — chơi online",
  description: "Cờ Cá Ngựa online 2–4 người theo luật Việt Nam: gieo xúc xắc, xuất quân, đá ngựa đối thủ về chuồng, lên chuồng theo số.",
};

export default function CaNguaLayout({ children }: { children: React.ReactNode }) {
  return <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#3a2412_0%,#120a05_70%)] text-amber-50"><GamesShell>{children}</GamesShell></div>;
}
