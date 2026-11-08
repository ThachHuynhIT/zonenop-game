/** The sign-out confirmation that is open, tied to the session it was opened for (runtime state only, never stored). */
export type LogoutConfirmState = { session: string } | null;

/**
 * Whether "Đăng xuất" in the confirmation may run: it is open, not already running, and the session is still the one
 * it was opened for. A session revoked or replaced meanwhile (another tab, another device) must not be signed out by a
 * stale dialog.
 */
export function canConfirmLogout(pending: LogoutConfirmState, currentSession: string | null, busy: boolean): boolean {
  return pending !== null && !busy && currentSession !== null && pending.session === currentSession;
}
