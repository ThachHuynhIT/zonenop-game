"use client";
import { useEffect, useId, useRef, useState } from "react";
import { GameBadge, GameButton, GameDialog, gameToast } from "@/components/game-ui";
import { AuthField } from "@/components/auth/fields";
import { passwordHint } from "@/components/auth/password";
import { authRequest, getSession, useSession } from "@/components/auth/session";
import { Forbidden } from "./Forbidden";
import { formatDateTime, formatNumber, pageCount } from "./format";
import type { AdminUser, AdminUsersPage } from "./types";
import { getUserActionRules } from "./userActions";
import { resetPasswordState } from "./resetPassword";
import {
  changeUsersQuery,
  DEFAULT_USERS_QUERY,
  usersQueryPath,
  validUsersPage,
  USERS_FILTER_LABELS,
  USERS_SORT_LABELS,
  USERS_ORDER_LABELS,
  type UsersQuery,
} from "./usersQuery";
import { UserActionButtons, type UserAction } from "./UserActionButtons";
import { UserActionDialog, type UserActionTarget } from "./UserActionDialog";
import styles from "./ResetPasswordDialog.module.scss";
import ui from "./UsersTable.module.scss";

export type UserPatch = { role: "admin"; password: string } | { role: "user" } | { disabled?: boolean } | { password?: string };

/** Displays account filters, responsive user lists, and account action dialogs. */
export function UsersTable({
  data,
  query,
  search,
  onSearch,
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
  query: UsersQuery;
  search: string;
  onSearch: (q: string) => void;
  onQuery: (change: Partial<Omit<UsersQuery, "page">>) => void;
  onPage: (page: number) => void;
  onPatch: (user: AdminUser, patch: UserPatch) => Promise<boolean>;
  busyId: string | null;
  selfId: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const id = useId();
  const [resetting, setResetting] = useState<{ user: AdminUser; promote: boolean } | null>(null);
  const [pending, setPending] = useState<UserActionTarget | null>(null);
  const pages = data ? pageCount(data.total, data.pageSize) : 1;

  function action(user: AdminUser, next: UserAction) {
    if (loading || busyId) {
      return;
    }
    if (next === "promote" || next === "resetPassword") {
      setResetting({ user, promote: next === "promote" });
    } else {
      setPending({ user, action: next });
    }
  }

  async function confirm() {
    if (!pending) {
      return;
    }
    const current = data?.users.find((user) => user.id === pending.user.id);
    const rules = current ? getUserActionRules(current, selfId) : null;
    const allowed = current && rules && !loading && (
      pending.action === "demote"
        ? rules.canChangeRole && current.role === "admin"
        : pending.action === "lock"
          ? rules.canLock && !current.disabled
          : rules.canUnlock && current.disabled
    );
    if (!allowed || !current) {
      setPending(null);
      return;
    }
    const patch: UserPatch = pending.action === "demote" ? { role: "user" } : { disabled: pending.action === "lock" };
    if (await onPatch(current, patch)) {
      setPending(null);
    }
  }

  const actions = (user: AdminUser) => (
    <UserActionButtons
      user={user}
      selfId={selfId}
      busy={!!busyId || !!loading}
      onAction={action}
    />
  );

  return (
    <div className={ui.section}>
      <div className={ui.controls}>
        <label className={ui.search} htmlFor={`${id}-search`}>
          Tìm tên đăng nhập
          <input
            id={`${id}-search`}
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            maxLength={50}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label htmlFor={`${id}-filter`}>
          Lọc tài khoản
          <select
            id={`${id}-filter`}
            value={query.filter}
            onChange={(e) => onQuery({ filter: e.target.value as UsersQuery["filter"] })}
          >
            {Object.entries(USERS_FILTER_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-sort`}>
          Sắp xếp theo
          <select
            id={`${id}-sort`}
            value={query.sort}
            onChange={(e) => onQuery({ sort: e.target.value as UsersQuery["sort"] })}
          >
            {Object.entries(USERS_SORT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-order`}>
          Thứ tự
          <select
            id={`${id}-order`}
            value={query.order}
            onChange={(e) => onQuery({ order: e.target.value as UsersQuery["order"] })}
          >
            {Object.entries(USERS_ORDER_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {data && (
        <p className={ui.count} aria-live="polite">{formatNumber(data.total)} tài khoản</p>
      )}
      {error ? (
        <div role="alert" className={ui.message}>
          <p>Không tải được danh sách người dùng</p>
          <p>{error}</p>
          {onRetry && <GameButton onClick={onRetry}>Thử lại</GameButton>}
        </div>
      ) : (
        <div aria-busy={loading || undefined}>
          {!data ? (
            <p role="status" className={ui.message}>Đang tải tài khoản…</p>
          ) : data.users.length === 0 ? (
            <p className={ui.message}>Không có tài khoản nào phù hợp.</p>
          ) : (
            <>
              <div className={ui.desktop}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Tên đăng nhập</th>
                      <th>Trạng thái</th>
                      <th>Số ván</th>
                      <th>Ngày tạo</th>
                      <th>Đăng nhập cuối</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id}>
                        <td className={ui.username}>{user.username}</td>
                        <td><UserBadges user={user} selfId={selfId} /></td>
                        <td>{formatNumber(user.games)}</td>
                        <td>{formatDateTime(user.createdAt).slice(0, 10)}</td>
                        <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Chưa đăng nhập"}</td>
                        <td>{actions(user)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className={ui.cards}>
                {data.users.map((user) => (
                  <li key={user.id} className={ui.card}>
                    <h3 className={ui.username}>{user.username}</h3>
                    <UserBadges user={user} selfId={selfId} />
                    <dl className={ui.details}>
                      <div>
                        <dt>Số ván</dt>
                        <dd>{formatNumber(user.games)}</dd>
                      </div>
                      <div>
                        <dt>Ngày tạo</dt>
                        <dd>{formatDateTime(user.createdAt).slice(0, 10)}</dd>
                      </div>
                      <div>
                        <dt>Đăng nhập cuối</dt>
                        <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Chưa đăng nhập"}</dd>
                      </div>
                    </dl>
                    {actions(user)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {data && pages > 1 && (
        <nav aria-label="Phân trang" className={ui.pager}>
          <GameButton disabled={loading || data.page <= 1} onClick={() => onPage(data.page - 1)}>
            Trang trước
          </GameButton>
          <span>Trang {data.page}/{pages}</span>
          <GameButton disabled={loading || data.page >= pages} onClick={() => onPage(data.page + 1)}>
            Trang sau
          </GameButton>
        </nav>
      )}
      <UserActionDialog target={pending} onClose={() => setPending(null)} onConfirm={confirm} />
      <ResetPasswordDialog
        target={resetting}
        onClose={() => setResetting(null)}
        onPatch={async (user, patch) => {
          const current = data?.users.find((item) => item.id === user.id);
          if (!current || loading) {
            setResetting(null);
            return false;
          }
          const rules = getUserActionRules(current, selfId);
          if (!rules.canResetPassword || ("role" in patch && !rules.canChangeRole)) {
            setResetting(null);
            return false;
          }
          return onPatch(current, patch);
        }}
      />
    </div>
  );
}

function UserBadges({ user, selfId }: { user: AdminUser; selfId: string | null }) {
  return (
    <div className={ui.badges}>
      {user.id === selfId && <GameBadge>Bạn</GameBadge>}
      {user.role === "admin" ? <GameBadge tone="accent">Quản trị</GameBadge> : <GameBadge>Người chơi</GameBadge>}
      {user.isOwner === true && <GameBadge tone="warning">Chủ sở hữu</GameBadge>}
      {user.disabled && <GameBadge tone="danger">Đã khoá</GameBadge>}
    </div>
  );
}
/** Sets a new password; with `promote`, also grants admin in the same request (admin minimum applies). */
function ResetPasswordDialog({
  target,
  onClose,
  onPatch,
}: {
  target: { user: AdminUser; promote: boolean } | null;
  onClose: () => void;
  onPatch: (u: AdminUser, p: UserPatch) => Promise<boolean>;
}) {
  // Keep the last target while the dialog animates out.
  const [shownTarget, setShownTarget] = useState(target);
  const [prev, setPrev] = useState(target);
  const shown = shownTarget?.user ?? null;
  const promote = shownTarget?.promote ?? false;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Every open and every close starts from an empty field: a typed password never lingers in state.
  if (target !== prev) {
    setPrev(target);
    setPassword("");
    if (target) {
      setShownTarget(target);
    }
  }
  // The role the account ends up with sets the minimum (be_game checks the same).
  const { role, problem, ready } = resetPasswordState(password, shown?.role ?? "user", promote);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !shown || !ready || busy) {
      return;
    }
    setBusy(true);
    const ok = await onPatch(shown, promote ? { role: "admin", password } : { password });
    setBusy(false);
    if (ok) {
      onClose();
    }
  }

  return (
    <GameDialog
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={promote ? "Cấp quyền quản trị" : "Đặt lại mật khẩu"}
      description={
        shown
          ? promote
            ? `${shown.username} sẽ thành quản trị viên với mật khẩu mới (quản trị viên cần ít nhất 12 ký tự). Mọi phiên đăng nhập cũ của tài khoản này sẽ bị đăng xuất.`
            : `Mật khẩu mới cho ${shown.username}. Mọi phiên đăng nhập cũ của tài khoản này sẽ bị đăng xuất.`
          : undefined
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField
          label="Mật khẩu mới"
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="off"
          autoFocus
          error={problem ?? undefined}
          errorClassName={styles.error}
          hint={`${passwordHint(role)} Nhớ gửi mật khẩu này cho người dùng.`}
        />
        <div className="flex justify-end gap-2">
          <GameButton type="button" size="sm" className={styles.actionButton} onClick={onClose}>
            Huỷ
          </GameButton>
          <GameButton type="submit" size="sm" className={styles.actionButton} variant="primary" loading={busy} disabled={!ready || busy}>
            {promote ? "Cấp quyền" : "Đặt mật khẩu"}
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

export function UsersSection({ selfId }: { selfId: string | null }) {
  const session = useSession();
  const token = session?.session ?? null;
  return <UsersQuerySection key={token} selfId={selfId} token={token} />;
}
/** Fetches the current users query and applies account updates for this session. */
function UsersQuerySection({ selfId, token }: { selfId: string | null; token: string | null }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<UsersQuery>(DEFAULT_USERS_QUERY);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const submitting = useRef(false);
  const [result, setResult] = useState<{
    key: string;
    data: AdminUsersPage | null;
    error: string | null;
    status: number;
  } | null>(null);
  const path = usersQueryPath(query);
  const key = JSON.stringify([path, attempt, token]);

  useEffect(() => {
    const timeout = setTimeout(() => setQuery((current) => changeUsersQuery(current, {
      q: search.normalize("NFC").trim().replace(/\s+/gu, " "),
    })), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let live = true;
    void authRequest<AdminUsersPage>("GET", path).then((res) => {
      if (!live || getSession()?.session !== token) {
        return;
      }
      if (res.ok) {
        const page = validUsersPage(res.data.total, res.data.pageSize, query.page);
        if (page !== query.page) {
          setQuery((current) => ({ ...current, page }));
          return;
        }
        setResult({ key, data: res.data, error: null, status: 200 });
      } else {
        setResult((prev) => ({ key, data: prev?.data ?? null, error: res.error, status: res.status }));
      }
    });
    return () => {
      live = false;
    };
  }, [key, path, token, query.page]);

  async function patch(user: AdminUser, body: UserPatch): Promise<boolean> {
    if (submitting.current || !token || getSession()?.session !== token) {
      return false;
    }
    submitting.current = true;
    setBusyId(user.id);
    try {
      const res = await authRequest<{ ok: true; user: AdminUser }>("PATCH", `/api/admin/users/${encodeURIComponent(user.id)}`, body);
      if (getSession()?.session !== token) {
        return false;
      }
      if (!res.ok) {
        gameToast.error(res.error);
        return false;
      }
      setAttempt((value) => value + 1);
      gameToast.success(PATCH_DONE[Object.keys(body)[0]]?.(res.data.user) ?? "Đã lưu");
      return true;
    } finally {
      submitting.current = false;
      setBusyId(null);
    }
  }

  if (result?.key === key && result.status === 403) {
    return <Forbidden />;
  }
  return (
    <UsersTable
      data={result?.data ?? null}
      query={query}
      search={search}
      onSearch={setSearch}
      onQuery={(change) => setQuery((current) => changeUsersQuery(current, change))}
      onPage={(page) => setQuery((current) => ({ ...current, page }))}
      onPatch={patch}
      busyId={busyId}
      selfId={selfId}
      loading={result?.key !== key}
      error={result?.key === key ? result.error : null}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
