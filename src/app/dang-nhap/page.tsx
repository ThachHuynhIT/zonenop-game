import type { Metadata } from "next";
import { Suspense } from "react";
import { GameThemeScope } from "@/components/game-ui";
import { AuthForm } from "@/components/auth/AuthForm";
import { gameFont } from "@/components/games/gameFont";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập hoặc tạo tài khoản để chơi Games cùng bạn bè.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <GameThemeScope
      game={null}
      className={`game-shell relative z-10 grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_top,#2a1b4d_0%,#0d0818_70%)] px-4 py-10 text-white ${gameFont.variable}`}
    >
      <main className="w-full max-w-sm">
        <Suspense fallback={null}>
          <AuthForm />
        </Suspense>
      </main>
    </GameThemeScope>
  );
}
