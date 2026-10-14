import type { Metadata } from "next";
import { GamesShell } from "@/components/games/GamesShell";

export const metadata: Metadata = {
  title: "Cờ Tỷ Phú Việt Nam — chơi online",
  description: "Cờ Tỷ Phú với các địa danh Việt Nam: mua đất các tỉnh thành từ Quảng Ninh, Quảng Nam đến Kiên Giang… xây nhà, thu tiền thuê, chơi online 2–6 người.",
};

export default function CoTyPhuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#0f3b2e_0%,#06140f_70%)] text-sky-50"><GamesShell>{children}</GamesShell></div>
  );
}
