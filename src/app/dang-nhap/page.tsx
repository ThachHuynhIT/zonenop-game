import type { Metadata } from "next";
import { Suspense } from "react";
import { GameThemeScope } from "@/components/game-ui";
import { AuthForm } from "@/components/auth/AuthForm";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập hoặc tạo tài khoản để chơi Games cùng bạn bè.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <GameThemeScope
      game={null}
      className={`game-shell ${styles.page}`}
    >
      <main className={styles.main}>
        <Suspense fallback={null}>
          <AuthForm />
        </Suspense>
      </main>
    </GameThemeScope>
  );
}
