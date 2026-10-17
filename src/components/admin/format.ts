import { ONLINE_GAMES } from "@/components/games/gamesRegistry";

const integer = new Intl.NumberFormat("vi-VN");
const compactFormat = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 12345 → "12.345". */
export function formatNumber(n: number): string {
  return integer.format(Number.isFinite(n) ? n : 0);
}

/** Axis ticks: 999 → "999", 12345 → "12,3 N", 1234567 → "1,2 Tr" (with a no-break space). */
export function compact(n: number): string {
  return compactFormat.format(Number.isFinite(n) ? n : 0);
}

/** "2026-10-16" → "16/10" (the string is taken as a calendar day, no time zone shift). */
export function formatDay(day: string): string {
  const m = DAY_RE.exec(day);
  return m ? `${m[3]}/${m[2]}` : day;
}

/** Tooltip title: "2026-10-16" → "Thứ sáu, 16/10/2026". */
export function formatDayLong(day: string): string {
  const m = DAY_RE.exec(day);
  if (!m) return day;
  const weekday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${m[3]}/${m[2]}/${m[1]}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO time → "16/10/2026 14:05" in Vietnam time (UTC+7, no DST); null/invalid → "—". */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = new Date(t + 7 * 3600_000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Game id from the server ("tienlen") → its name in the games list ("Tiến Lên"); unknown ids are shown as they are. */
export function gameName(id: string): string {
  return ONLINE_GAMES.find((g) => g.id === id)?.short ?? id;
}

export function gameEmoji(id: string): string {
  return ONLINE_GAMES.find((g) => g.id === id)?.emoji ?? "🎲";
}

/** Width of a bar in a ranked list, 0–100 (the largest value fills the row). */
export function share(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

/** Number of pages for `total` rows; at least 1 so the pager always reads "Trang 1/1". */
export function pageCount(total: number, pageSize: number): number {
  if (!(pageSize > 0) || !(total > 0)) return 1;
  return Math.ceil(total / pageSize);
}

/**
 * SVG path for a small trend line inside a `width`×`height` box (y grows downwards; flat series sit on the middle).
 * Empty input → "".
 */
export function sparkPath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  return values
    .map((v, i) => {
      const y = span === 0 ? height / 2 : height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${round(i * step)} ${round(y)}`;
    })
    .join(" ");
}
