"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameButton, GameDialog, GameTabs, gameToast } from "@/components/game-ui";
import { ProfilePicker } from "@/components/games/PlayerAvatar";
import type { PlayerProfile } from "@/components/games/gameClient";
import { AuthField } from "./fields";
import { PASSWORD_MIN, passwordLength, passwordProblem } from "./password";
import { usernameProblem } from "./username";
import { authRequest, clearSession, saveSession, updateProfile, useSession, type PublicUser } from "./session";

type MeData = { user: PublicUser; session?: string };

/** Account dialog behind the avatar in the games top bar: look, password, admin link and sign out. */
export function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const current = useSession();
  const [signingOut, setSigningOut] = useState(false);
  if (!current) return null;
  const { user } = current;

  async function signOut() {
    setSigningOut(true);
    const res = await authRequest("POST", "/api/auth/logout");
    if (!res.ok) gameToast.info("Đã đăng xuất trên máy này; phiên trên máy chủ sẽ tự hết hạn");
    clearSession();
    onClose();
    router.replace("/dang-nhap");
  }

  return (
    <GameDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={user.username}
      description={user.role === "admin" ? "Tài khoản quản trị" : "Tài khoản của bạn"}
      footer={
        <>
          {user.role === "admin" && (
            <Link href="/admin" onClick={onClose} className="mr-auto inline-flex h-11 items-center rounded-full px-3 text-sm font-bold text-game-accent hover:bg-white/10">
              Quản trị
            </Link>
          )}
          <GameButton onClick={onClose}>
            Đóng
          </GameButton>
          <GameButton variant="danger" loading={signingOut} onClick={() => void signOut()}>
            Đăng xuất
          </GameButton>
        </>
      }
    >
      <GameTabs
        tabs={[
          { id: "profile", label: "Hồ sơ", content: <ProfileSection user={user} /> },
          { id: "password", label: "Mật khẩu", content: <PasswordSection /> },
        ]}
      />
    </GameDialog>
  );
}

function ProfileSection({ user }: { user: PublicUser }) {
  const [username, setUsername] = useState(user.username);
  const [look, setLook] = useState<PlayerProfile>({ icon: user.icon, color: user.color });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const name = username.trim();
  const patch = {
    ...(name !== user.username ? { username: name } : {}),
    ...(look.icon !== user.icon ? { icon: look.icon } : {}),
    ...(look.color !== user.color ? { color: look.color } : {}),
  };
  const changed = Object.keys(patch).length > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!changed || busy) return;
    if (patch.username !== undefined) {
      const problem = usernameProblem(patch.username);
      if (problem) return setMessage({ ok: false, text: problem });
    }
    setBusy(true);
    setMessage(null);
    const res = await updateProfile(patch);
    setBusy(false);
    setMessage(res.ok ? { ok: true, text: "Đã lưu hồ sơ." } : { ok: false, text: res.error });
  }

  return (
    <form onSubmit={save} className="space-y-3" aria-label="Hồ sơ">
      <AuthField
        label="Tên đăng nhập"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        maxLength={20}
        hint="3–20 ký tự: chữ, số, dấu _, dấu chấm và dấu cách đơn. Cũng là tên hiện ở bàn chơi."
      />
      <p className="text-xs text-white/60">Tên mới áp dụng từ bàn tiếp theo — nếu đang trong một ván, hãy đổi sau khi ván kết thúc.</p>
      <ProfilePicker name={name} value={look} onChange={setLook} />
      <Feedback message={message} />
      <GameButton type="submit" variant="primary" loading={busy} disabled={!changed}>
        Lưu
      </GameButton>
    </form>
  );
}

function PasswordSection() {
  const [oldPassword, setOld] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = oldPassword !== "" && passwordLength(password) >= PASSWORD_MIN && again !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const problem = passwordProblem(password);
    if (problem) return setMessage({ ok: false, text: problem });
    if (password !== again) return setMessage({ ok: false, text: "Hai mật khẩu mới chưa giống nhau" });
    setBusy(true);
    setMessage(null);
    const res = await authRequest<MeData>("PATCH", "/api/auth/me", { oldPassword, password });
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: res.error });
    // Changing the password signs out every other device; this one carries on with the fresh session.
    if (res.data.session) saveSession({ session: res.data.session, user: res.data.user });
    setOld("");
    setPassword("");
    setAgain("");
    setMessage({ ok: true, text: "Đã đổi mật khẩu." });
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Đổi mật khẩu">
      <AuthField label="Mật khẩu hiện tại" value={oldPassword} onChange={setOld} type="password" autoComplete="current-password" />
      <AuthField label="Mật khẩu mới" value={password} onChange={setPassword} type="password" autoComplete="new-password" hint="Tối đa 72 ký tự." />
      <AuthField label="Nhập lại mật khẩu mới" value={again} onChange={setAgain} type="password" autoComplete="new-password" />
      <Feedback message={message} />
      <GameButton type="submit" variant="secondary" loading={busy} disabled={!ready}>
        Đổi mật khẩu
      </GameButton>
    </form>
  );
}

function Feedback({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "mt-2 text-sm text-emerald-300" : "mt-2 text-sm text-rose-300"}>
      {message.text}
    </p>
  );
}
