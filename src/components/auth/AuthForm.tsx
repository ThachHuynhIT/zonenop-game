"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameButton, GamePanel, GameTabs } from "@/components/game-ui";
import { DEFAULT_PROFILE, type PlayerProfile } from "@/components/games/gameClient";
import { ProfilePicker } from "@/components/games/PlayerAvatar";
import { AuthField } from "./fields";
import { safeNext } from "./next";
import { authRequest, saveSession, useSession, type PublicUser } from "./session";

type AuthData = { session: string; user: PublicUser };

/** Sign-in / sign-up page body: two tabs, server errors under the form, then on to `?next=` (internal paths only). */
export function AuthForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const session = useSession();

  // Already signed in (or just did): leave the page.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  return (
    <GamePanel className="w-full">
      <p className="mb-3 whitespace-nowrap text-center text-2xl leading-none sm:text-3xl" aria-hidden>
        🃏 😼 🎩 💎 🤠 🪨 🐴
      </p>
      <h1 className="text-center font-heading text-2xl font-black tracking-tight text-game-accent">Chào mừng tới Games!</h1>
      <p className="mb-4 mt-2 text-center text-sm text-white/65">Đăng nhập để chơi, giữ điểm và xếp hạng cùng bạn bè.</p>
      <GameTabs
        tabs={[
          { id: "login", label: "Đăng nhập", content: <LoginTab /> },
          { id: "register", label: "Đăng ký", content: <RegisterTab /> },
        ]}
      />
    </GamePanel>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await authRequest<AuthData>("POST", path, body);
    if (res.ok) saveSession({ session: res.data.session, user: res.data.user });
    else {
      setError(res.error);
      setBusy(false);
    }
    // On success AuthForm sees the session and navigates away, so `busy` stays on.
  }
  return { busy, error, run };
}

function LoginTab() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();
  const ready = username.trim() !== "" && password !== "";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) void run("/api/auth/login", { username, password });
      }}
    >
      <AuthField label="Tên đăng nhập" value={username} onChange={setUsername} autoComplete="username" autoFocus maxLength={20} />
      <AuthField label="Mật khẩu" value={password} onChange={setPassword} type="password" autoComplete="current-password" maxLength={72} />
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <GameButton type="submit" variant="primary" className="w-full" loading={busy} disabled={!ready}>
        Đăng nhập
      </GameButton>
    </form>
  );
}

function RegisterTab() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [look, setLook] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [local, setLocal] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const ready = username.trim().length >= 3 && password.length >= 8 && again !== "";
  const message = local ?? error;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        if (password !== again) {
          setLocal("Hai mật khẩu chưa giống nhau");
          return;
        }
        setLocal(null);
        void run("/api/auth/register", { username, password, icon: look.icon, color: look.color });
      }}
    >
      <AuthField label="Tên đăng nhập" value={username} onChange={setUsername} autoComplete="username" maxLength={20} hint="3–20 ký tự: chữ, số, dấu _ và dấu chấm. Cũng là tên hiện ở bàn chơi." />
      <AuthField label="Mật khẩu" value={password} onChange={setPassword} type="password" autoComplete="new-password" maxLength={72} hint="Ít nhất 8 ký tự." />
      <AuthField label="Nhập lại mật khẩu" value={again} onChange={setAgain} type="password" autoComplete="new-password" maxLength={72} />
      <ProfilePicker name={username.trim()} value={look} onChange={setLook} />
      {message && (
        <p role="alert" className="text-sm text-rose-300">
          {message}
        </p>
      )}
      <GameButton type="submit" variant="primary" className="w-full" loading={busy} disabled={!ready}>
        Tạo tài khoản
      </GameButton>
    </form>
  );
}
