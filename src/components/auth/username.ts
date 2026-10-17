export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Same rules as registration on the server: 3–20 code points of letters, digits, `_`, `.` and single spaces. */
export function usernameProblem(raw: string): string | null {
  const name = raw.trim();
  const n = [...name].length;
  if (n < USERNAME_MIN || n > USERNAME_MAX) return `Tên cần ${USERNAME_MIN}–${USERNAME_MAX} ký tự`;
  if (!/^[\p{L}\p{N}_.]+(?: [\p{L}\p{N}_.]+)*$/u.test(name)) return "Tên chỉ gồm chữ, số, dấu _, dấu chấm và dấu cách đơn";
  return null;
}
