"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import { sparkPath } from "./format";
import type { AdminStats, DailyRow } from "./types";

type Totals = AdminStats["totals"];

interface Card {
  key: keyof Totals;
  label: string;
  hint: string;
  /** Daily series drawn under the number (the totals without a daily breakdown have none). */
  series?: keyof Omit<DailyRow, "day">;
}

const CARDS: Card[] = [
  { key: "views", label: "Lượt xem", hint: "Số lần mở trang", series: "views" },
  { key: "devices", label: "Số máy", hint: "Máy khác nhau đã ghé", series: "devices" },
  { key: "games", label: "Ván đã chơi", hint: "Ván chơi xong", series: "games" },
  { key: "players", label: "Người chơi", hint: "Tài khoản đã vào ván", series: "players" },
  { key: "playDevices", label: "Máy chơi", hint: "Máy đã vào bàn" },
  { key: "newUsers", label: "Người dùng mới", hint: "Đăng ký trong kỳ", series: "newUsers" },
  { key: "users", label: "Tổng người dùng", hint: "Tất cả tài khoản" },
];

const W = 120;
const H = 28;

function Spark({ values, strong }: { values: number[]; strong?: boolean }) {
  const d = sparkPath(values, W, H);
  if (!d || values.length < 2) return null;
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} preserveAspectRatio="none" aria-hidden className={cn("mt-3 h-7 w-full overflow-visible", strong ? "text-game-accent" : "text-white/35")}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strong ? 2.25 : 1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The seven totals of the period. "Lượt xem" leads (two columns wide, accent); the rest sit in a 2-column grid on phones
 * and 4 columns from `sm` up. Numbers animate when the period changes.
 */
export function StatCards({ totals, daily, days }: { totals: Totals; daily: DailyRow[]; days: number }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3" aria-label={`Tổng số ${days} ngày qua`}>
      {CARDS.map((c, i) => {
        const lead = i === 0;
        const series = c.series ? daily.map((d) => d[c.series!]) : null;
        return (
          <li
            key={c.key}
            className={cn(
              "flex min-w-0 flex-col rounded-2xl border p-3.5 sm:p-4",
              lead ? "col-span-2 border-game-accent/40 bg-game-accent-soft" : "border-white/10 bg-white/[0.05]",
            )}
          >
            <span className="text-sm font-bold text-white/75">{c.label}</span>
            <NumberFlow
              value={totals[c.key]}
              locales="vi-VN"
              className={cn(
                "mt-1 font-black leading-none tracking-tight tabular-nums [font-family:var(--font-game)]",
                lead ? "text-5xl text-white sm:text-6xl" : "text-3xl text-white sm:text-4xl",
              )}
            />
            <span className="mt-1.5 text-xs text-white/50">{c.hint}</span>
            {series && <Spark values={series} strong={lead} />}
          </li>
        );
      })}
    </ul>
  );
}
