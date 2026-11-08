import { pageCount } from "./format";

/**
 * What the "Người dùng" tab asks be_game for (`GET /api/admin/users`, be_game #49). Filtering and sorting happen on
 * the server across every account before paging, so the client never sorts a 50-row page itself.
 */
export type UsersFilter = "all" | "admin" | "disabled" | "owner";
export type UsersSort = "createdAt" | "lastLoginAt" | "games";
export type UsersOrder = "asc" | "desc";
export type UsersQuery = { q: string; page: number; filter: UsersFilter; sort: UsersSort; order: UsersOrder };

/** Same as be_game's defaults: everyone, newest first. */
export const DEFAULT_USERS_QUERY: UsersQuery = { q: "", page: 1, filter: "all", sort: "createdAt", order: "desc" };

export const USERS_FILTER_LABELS: Record<UsersFilter, string> = { all: "Tất cả", admin: "Quản trị viên", disabled: "Bị khoá", owner: "Chủ sở hữu" };
export const USERS_SORT_LABELS: Record<UsersSort, string> = { createdAt: "Ngày tạo", lastLoginAt: "Đăng nhập cuối", games: "Số ván" };
export const USERS_ORDER_LABELS: Record<UsersOrder, string> = { asc: "Tăng dần", desc: "Giảm dần" };

export function usersQueryPath(query: UsersQuery): string {
  const p = new URLSearchParams({ q: query.q, page: String(query.page), filter: query.filter, sort: query.sort, order: query.order });
  return `/api/admin/users?${p.toString()}`;
}

/** Applies a change of search/filter/sort/order; any real change goes back to page 1, no change returns `current`. */
export function changeUsersQuery(current: UsersQuery, change: Partial<Omit<UsersQuery, "page">>): UsersQuery {
  const changed = (Object.keys(change) as (keyof typeof change)[]).some((k) => change[k] !== undefined && change[k] !== current[k]);
  return changed ? { ...current, ...change, page: 1 } : current;
}

/** The nearest page that exists for `total` rows (after a change shrank the list). */
export function validUsersPage(total: number, pageSize: number, page: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}
