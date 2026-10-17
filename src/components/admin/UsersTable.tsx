"use client";

import { useEffect, useId, useState } from "react";
import { KeyRound, Lock, LockOpen, Search, Shield, ShieldOff } from "lucide-react";
import { GameBadge, GameButton, GameDialog, gameToast } from "@/components/game-ui";
import { AuthField } from "@/components/auth/fields";
import { PASSWORD_MAX, passwordLength, passwordProblem } from "@/components/auth/password";
import { authRequest } from "@/components/auth/session";
import { cn } from "@/lib/utils";
import { Forbidden } from "./Forbidden";
import { formatDateTime, formatNumber, pageCount } from "./format";
import type { AdminUser, AdminUsersPage } from "./types";

export type UserPatch = { role?: AdminUser["role"] } | { disabled?: boolean } | { password?: string };

const TH = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold text-white/55";
const TD = "whitespace-nowrap px-3 py-2.5 align-middle";

/** Search box, one page of accounts (scrolls sideways inside its frame on phones) and the pager. Prop-driven. */
export function UsersTable({
  data,
  query,
  onQuery,
  onPage,
  onPatch,
  busyId,
  selfId,
  loading,
  error,
  onRetry,
}: {
  data: AdminUsersPage | null;
  query: string;
  onQuery: (q: string) => void;
  onPage: (page: number) => void;
  /** Resolves true when the server accepted the change. */
  onPatch: (user: AdminUser, patch: UserPatch) => Promise<boolean>;
  busyId: string | null;
  /** The signed-in admin: no demoting or locking yourself. */
  selfId: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const searchId = useId();
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const pages = data ? pageCount(data.total, data.pageSize) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={searchId} className="sr-only">
          Tìm người dùng
        </label>
        <div className="relative min-w-0 basis-full sm:max-w-sm sm:flex-1 sm:basis-auto">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/45" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Tìm tên đăng nhập"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-full border border-white/15 bg-black/40 pl-10 pr-4 text-base text-white outline-none transition-colors placeholder:text-white/35 focus:border-game-accent"
          />
        </div>
        {data && (
          <p className="text-sm text-white/60" aria-live="polite">
            {formatNumber(data.total)} tài khoản
          </p>
        )}
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm">
          <p className="font-bold text-rose-200">Không tải được danh sách người dùng</p>
          <p className="mt-1 text-rose-100/70">{error}</p>
          {onRetry && (
            <GameButton size="sm" className="mt-3 h-10" onClick={onRetry}>
              Thử lại
            </GameButton>
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className={cn("overflow-x-auto rounded-2xl border border-white/10 bg-game-surface-sunken transition-opacity", loading && data && "opacity-60")}
            aria-busy={loading || undefined}
            onScroll={(e) => {
              const el = e.currentTarget;
              setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
            }}
          >
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-game-surface">
              <tr className="border-b border-white/10">
                <th className={cn(TH, "sticky left-0 z-10 bg-game-surface")}>Tên đăng nhập</th>
                <th className={TH}>Trạng thái</th>
                <th className={cn(TH, "text-right")}>Số ván</th>
                <th className={TH}>Tạo lúc</th>
                <th className={TH}>Đăng nhập cuối</th>
                <th className={cn(TH, "text-right")}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!data &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-3 py-3">
                      <span className="block h-5 animate-pulse rounded-full bg-white/8" />
                    </td>
                  </tr>
                ))}
              {data?.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-white/55">
                    {query.trim() ? `Không có tài khoản nào khớp "${query.trim()}".` : "Chưa có tài khoản nào."}
                  </td>
                </tr>
              )}
              {data?.users.map((u) => (
                <UserRow key={u.id} user={u} self={u.id === selfId} busy={busyId === u.id} onPatch={onPatch} onReset={() => setResetting(u)} />
              ))}
            </tbody>
          </table>
          </div>
          {/* Phones: a fade on the right edge says the table scrolls sideways (the actions start off-screen). */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-px right-px w-12 rounded-r-2xl bg-gradient-to-l from-game-surface-sunken to-transparent transition-opacity sm:hidden",
              atEnd && "opacity-0",
            )}
          />
        </div>
      )}

      {data && pages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
          <GameButton size="sm" className="h-10" disabled={data.page <= 1 || loading} onClick={() => onPage(data.page - 1)}>
            Trang trước
          </GameButton>
          <span className="text-sm tabular-nums text-white/70">
            Trang {data.page}/{pages}
          </span>
          <GameButton size="sm" className="h-10" disabled={data.page >= pages || loading} onClick={() => onPage(data.page + 1)}>
            Trang sau
          </GameButton>
        </nav>
      )}

      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} onPatch={onPatch} />
    </div>
  );
}

function UserRow({ user, self, busy, onPatch, onReset }: { user: AdminUser; self: boolean; busy: boolean; onPatch: (u: AdminUser, p: UserPatch) => Promise<boolean>; onReset: () => void }) {
  const admin = user.role === "admin";
  return (
    <tr className={cn("transition-colors hover:bg-white/[0.03]", user.disabled && "text-white/55")}>
      <td className={cn(TD, "sticky left-0 z-10 bg-game-surface-sunken font-bold")}>
        <span className="flex items-center gap-2">
          <span className="max-w-40 truncate">{user.username}</span>
          {self && <span className="text-xs font-normal text-white/50">(bạn)</span>}
        </span>
      </td>
      <td className={TD}>
        <span className="flex gap-1.5">
          {admin ? <GameBadge tone="accent">Quản trị</GameBadge> : <GameBadge>Người chơi</GameBadge>}
          {user.disabled && <GameBadge tone="danger">Đã khoá</GameBadge>}
        </span>
      </td>
      <td className={cn(TD, "text-right tabular-nums")}>{formatNumber(user.games)}</td>
      <td className={cn(TD, "tabular-nums text-white/70")}>{formatDateTime(user.createdAt).slice(0, 10)}</td>
      <td className={cn(TD, "tabular-nums text-white/70")}>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Chưa đăng nhập"}</td>
      <td className={cn(TD, "text-right")}>
        <span className="inline-flex gap-2">
          <GameButton
            size="sm"
            className="h-10"
            variant="ghost"
            disabled={self || busy}
            confirm={admin ? "Bỏ quyền?" : "Cấp quyền?"}
            title={self ? "Không thể tự đổi quyền của mình" : admin ? "Bỏ quyền quản trị" : "Cấp quyền quản trị"}
            onClick={() => void onPatch(user, { role: admin ? "user" : "admin" })}
          >
            {admin ? <ShieldOff aria-hidden /> : <Shield aria-hidden />}
            {admin ? "Bỏ quyền" : "Cấp quyền"}
          </GameButton>
          {user.disabled ? (
            <GameButton size="sm" className="h-10" variant="ghost" disabled={busy} onClick={() => void onPatch(user, { disabled: false })}>
              <LockOpen aria-hidden />
              Mở khoá
            </GameButton>
          ) : (
            <GameButton
              size="sm"
              className="h-10"
              variant="ghost"
              disabled={self || busy}
              confirm="Khoá thật?"
              title={self ? "Không thể tự khoá mình" : "Khoá tài khoản và đăng xuất mọi máy"}
              onClick={() => void onPatch(user, { disabled: true })}
            >
              <Lock aria-hidden />
              Khoá
            </GameButton>
          )}
          <GameButton size="sm" className="h-10" variant="ghost" disabled={busy} title="Đặt lại mật khẩu" onClick={onReset}>
            <KeyRound aria-hidden />
            Mật khẩu
          </GameButton>
        </span>
      </td>
    </tr>
  );
}

function ResetPasswordDialog({ user, onClose, onPatch }: { user: AdminUser | null; onClose: () => void; onPatch: (u: AdminUser, p: UserPatch) => Promise<boolean> }) {
  // Keep the last user while the dialog animates out.
  const [shown, setShown] = useState<AdminUser | null>(user);
  const [prev, setPrev] = useState<AdminUser | null>(user);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Every open and every close starts from an empty field: a typed password never lingers in state.
  if (user !== prev) {
    setPrev(user);
    setPassword("");
    if (user) setShown(user);
  }
  const problem = password === "" ? null : passwordProblem(password);
  const ready = password !== "" && problem === null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shown || !ready || busy) return;
    setBusy(true);
    const ok = await onPatch(shown, { password });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <GameDialog
      open={user !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Đặt lại mật khẩu"
      description={shown ? `Mật khẩu mới cho ${shown.username}. Mọi phiên đăng nhập cũ của tài khoản này sẽ bị đăng xuất.` : undefined}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Mật khẩu mới" value={password} onChange={setPassword} autoComplete="off" autoFocus hint="Tối đa 72 ký tự. Nhớ gửi mật khẩu này cho người dùng." />
        {problem && passwordLength(password) > PASSWORD_MAX && (
          <p role="alert" className="text-sm text-rose-300">
            {problem}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <GameButton type="button" size="sm" className="h-10" onClick={onClose}>
            Huỷ
          </GameButton>
          <GameButton type="submit" size="sm" className="h-10" variant="primary" loading={busy} disabled={!ready}>
            Đặt mật khẩu
          </GameButton>
        </div>
      </form>
    </GameDialog>
  );
}

const PATCH_DONE: Record<string, (u: AdminUser) => string> = {
  role: (u) => (u.role === "admin" ? `${u.username} giờ là quản trị viên` : `${u.username} không còn là quản trị viên`),
  disabled: (u) => (u.disabled ? `Đã khoá ${u.username}` : `Đã mở khoá ${u.username}`),
  password: (u) => `Đã đặt mật khẩu mới cho ${u.username}`,
};

/** The "Người dùng" tab: debounced search (300 ms), paging, and the PATCH calls behind the row buttons. */
export function UsersSection({ selfId }: { selfId: string | null }) {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; data: AdminUsersPage | null; error: string | null; status: number } | null>(null);
  const key = `${q}|${page}|${attempt}`;

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let live = true;
    void authRequest<AdminUsersPage>("GET", `/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then((res) => {
      if (!live) return;
      setResult((prev) => (res.ok ? { key, data: res.data, error: null, status: 200 } : { key, data: prev?.data ?? null, error: res.error, status: res.status }));
    });
    return () => {
      live = false;
    };
  }, [key, q, page]);

  async function patch(user: AdminUser, body: UserPatch): Promise<boolean> {
    setBusyId(user.id);
    const res = await authRequest<{ ok: true; user: AdminUser }>("PATCH", `/api/admin/users/${encodeURIComponent(user.id)}`, body);
    setBusyId(null);
    if (!res.ok) {
      gameToast.error(res.error);
      return false;
    }
    const updated = res.data.user;
    setResult((prev) => (prev?.data ? { ...prev, data: { ...prev.data, users: prev.data.users.map((u) => (u.id === updated.id ? updated : u)) } } : prev));
    gameToast.success(PATCH_DONE[Object.keys(body)[0]]?.(updated) ?? "Đã lưu");
    return true;
  }

  // Lost admin rights since the page loaded (401 is handled by the dashboard, which sends the visitor to sign in).
  if (result?.status === 403) return <Forbidden />;

  return (
    <UsersTable
      data={result?.data ?? null}
      query={query}
      onQuery={setQuery}
      onPage={setPage}
      onPatch={patch}
      busyId={busyId}
      selfId={selfId}
      loading={result?.key !== key}
      error={result?.key === key ? result.error : null}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}
