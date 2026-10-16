export const PASSWORD_MIN = 1;
export const PASSWORD_MAX = 72;

/** Length in characters (code points), as the server counts it: an emoji is one, not two UTF-16 units. */
export const passwordLength = (p: string) => [...p].length;

/** Vietnamese message when a new password is too short or too long, else null. */
export function passwordProblem(p: string): string | null {
  const n = passwordLength(p);
  if (n < PASSWORD_MIN) return `Mật khẩu không được để trống`;
  if (n > PASSWORD_MAX) return `Mật khẩu dài tối đa ${PASSWORD_MAX} ký tự`;
  return null;
}
