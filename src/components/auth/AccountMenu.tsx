"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameButton, GameDialog, GameTabs, gameToast } from "@/components/game-ui";
import { ProfilePicker } from "@/components/games/PlayerAvatar";
import type { PlayerProfile } from "@/components/games/gameClient";
import { AuthField } from "./fields";
import { type PasswordRole, passwordHint, passwordProblem } from "./password";
import { usernameProblem } from "./username";
import { changePassword, logoutAccount, updateProfile, useSession, type PublicUser } from "./session";
import { canConfirmLogout, type LogoutConfirmState } from "./logoutConfirm";
import styles from "./AccountMenu.module.scss";

/** Account dialog behind the avatar in the games top bar: look, password, admin link and sign out. */
export function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const current = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [pending, setPending] = useState<LogoutConfirmState>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const logoutStarted = useRef(false);
  const confirming = pending !== null && pending.session === current?.session;
  if (pending && pending.session !== current?.session) setPending(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (wasConfirming.current) logoutRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!current) return null;
  const { user } = current;

  function dismiss() {
    if (signingOut) return;
    if (confirming) setPending(null);
    else onClose();
  }

  function confirmLogout() {
    if (logoutStarted.current || !canConfirmLogout(pending, current?.session ?? null, signingOut)) return;
    logoutStarted.current = true;
    void signOut();
  }

  async function signOut() {
    setSigningOut(true);
    const res = await logoutAccount();
    setSigningOut(false);
    logoutStarted.current = false;
    if (!res.applied) return;
    if (!res.ok) gameToast.info("Đã đăng xuất trên máy này; phiên trên máy chủ sẽ tự hết hạn");
    onClose();
    router.replace("/dang-nhap");
  }

  return (
    <GameDialog
      open
      onOpenChange={(o) => !o && dismiss()}
      title={confirming ? "Đăng xuất?" : user.username}
      description={confirming ? "Bạn có chắc muốn đăng xuất khỏi tài khoản này?" : user.role === "admin" ? "Tài khoản quản trị" : "Tài khoản của bạn"}
      footer={
        confirming ? (
          <div className={styles.confirmActions}>
            <GameButton ref={cancelRef} autoFocus disabled={signingOut} onClick={dismiss}>
              Huỷ
            </GameButton>
            <GameButton variant="danger" loading={signingOut} disabled={!canConfirmLogout(pending, current.session, signingOut)} onClick={confirmLogout}>
              Đăng xuất
            </GameButton>
          </div>
        ) : (
          <>
            {user.role === "admin" && (
              <Link href="/admin" onClick={onClose} className={styles.admin}>
                Quản trị
              </Link>
            )}
            <GameButton onClick={onClose}>
              Đóng
            </GameButton>
            <GameButton ref={logoutRef} variant="danger" loading={signingOut} onClick={() => setPending({ session: current.session })}>
              Đăng xuất
            </GameButton>
          </>
        )
      }
    >
      {confirming ? null : (
        <GameTabs
          tabs={[
            { id: "profile", label: "Hồ sơ", content: <ProfileSection user={user} /> },
            { id: "password", label: "Mật khẩu", content: <PasswordSection role={user.role} /> },
          ]}
        />
      )}
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
    <form onSubmit={save} className={styles.form} aria-label="Hồ sơ">
      <AuthField
        label="Tên đăng nhập"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        maxLength={20}
        hint="3–20 ký tự: chữ, số, dấu _, dấu chấm và dấu cách đơn. Cũng là tên hiện ở bàn chơi."
      />
      <p className={styles.hint}>Tên mới áp dụng từ bàn tiếp theo — nếu đang trong một ván, hãy đổi sau khi ván kết thúc.</p>
      <ProfilePicker name={name} value={look} onChange={setLook} />
      <Feedback message={message} />
      <GameButton type="submit" variant="primary" loading={busy} disabled={!changed}>
        Lưu
      </GameButton>
    </form>
  );
}

/** `role` is the signed-in account's: an admin's new password needs the admin minimum (server rule). */
function PasswordSection({ role }: { role: PasswordRole }) {
  const [oldPassword, setOld] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = oldPassword !== "" && password !== "" && again !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const problem = passwordProblem(password, role);
    if (problem) return setMessage({ ok: false, text: problem });
    if (password !== again) return setMessage({ ok: false, text: "Hai mật khẩu mới chưa giống nhau" });
    setBusy(true);
    setMessage(null);
    const res = await changePassword({ oldPassword, password });
    setBusy(false);
    if (!res.applied) return;
    if (!res.ok) return setMessage({ ok: false, text: res.error });
    setOld("");
    setPassword("");
    setAgain("");
    setMessage({ ok: true, text: "Đã đổi mật khẩu." });
  }

  return (
    <form onSubmit={submit} className={styles.form} aria-label="Đổi mật khẩu">
      <AuthField label="Mật khẩu hiện tại" value={oldPassword} onChange={setOld} type="password" autoComplete="current-password" />
      <AuthField label="Mật khẩu mới" value={password} onChange={setPassword} type="password" autoComplete="new-password" hint={passwordHint(role)} />
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
    <p role={message.ok ? "status" : "alert"} className={message.ok ? styles.success : styles.error}>
      {message.text}
    </p>
  );
}
