/**
 * Rules for setting a password, mirroring be_game `src/accounts/username.ts` (`validatePassword`): an ordinary
 * account needs 8–72 characters, an admin account 12–72. Signing in checks no length, so an older, shorter
 * password keeps working until it is changed.
 */
export type PasswordRole = "user" | "admin";

export const PASSWORD_MIN = 8;
export const ADMIN_PASSWORD_MIN = 12;
export const PASSWORD_MAX = 72;

/** Length in characters as the server counts it: NFC code points (an emoji is one, "ậ" is one even if typed decomposed). */
export const passwordLength = (p: string) => [...p.normalize("NFC")].length;

export const passwordMin = (role: PasswordRole = "user") => (role === "admin" ? ADMIN_PASSWORD_MIN : PASSWORD_MIN);

/** Field hint for a new password. */
export const passwordHint = (role: PasswordRole = "user") => `${passwordMin(role)}–${PASSWORD_MAX} ký tự.`;

/** Vietnamese message when a new password for an account with this role is not allowed, else null. */
export function passwordProblem(p: string, role: PasswordRole = "user"): string | null {
  const n = passwordLength(p);
  if (n === 0) return "Mật khẩu không được để trống";
  if (role === "admin" && n < ADMIN_PASSWORD_MIN) return `Mật khẩu admin cần ít nhất ${ADMIN_PASSWORD_MIN} ký tự`;
  if (n < PASSWORD_MIN) return `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự`;
  if (n > PASSWORD_MAX) return `Mật khẩu dài tối đa ${PASSWORD_MAX} ký tự`;
  return null;
}
