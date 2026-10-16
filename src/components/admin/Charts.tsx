"use client";

// Recharts is only imported here, and this module is only loaded through next/dynamic (ssr: false) by AdminDashboard,
// so it never reaches the game pages' bundles.
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { compact, formatDay, formatDayLong, formatNumber } from "./format";
import type { DailyRow } from "./types";

const SERIES_1 = "var(--game-chart-1)";
const SERIES_2 = "var(--game-chart-2)";
const GRID = "var(--game-chart-grid)";
const AXIS = "var(--game-chart-axis)";

const axisTick = { fill: AXIS, fontSize: 12 };

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-white/15 bg-game-surface px-3 py-2 text-sm text-white shadow-lg shadow-black/40">
      <p className="mb-1 font-bold text-white/80">{formatDayLong(String(label))}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-white/70">{p.name}</span>
            <span className="ml-auto font-bold tabular-nums">{formatNumber(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function xAxisProps(days: number) {
  return {
    dataKey: "day",
    tickFormatter: formatDay,
    tick: axisTick,
    tickLine: false,
    axisLine: { stroke: GRID },
    minTickGap: days > 30 ? 28 : 16,
    interval: "preserveStartEnd" as const,
    tickMargin: 8,
  };
}
const yAxisProps = { tickFormatter: compact, tick: axisTick, tickLine: false, axisLine: false, width: 44, allowDecimals: false };

/** Page views (area) and distinct devices (line) per day. */
export function TrafficChart({ daily }: { daily: DailyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="admin-views-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.45} />
            <stop offset="100%" stopColor={SERIES_1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis {...xAxisProps(daily.length)} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="views" name="Lượt xem" stroke={SERIES_1} strokeWidth={2.5} fill="url(#admin-views-fill)" activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="devices" name="Số máy" stroke={SERIES_2} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Games finished and distinct players per day, as paired bars. */
export function PlayChart({ daily }: { daily: DailyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={1} barCategoryGap={daily.length > 30 ? "12%" : "24%"}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis {...xAxisProps(daily.length)} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: GRID }} />
        <Bar dataKey="games" name="Số ván" fill={SERIES_1} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Bar dataKey="players" name="Người chơi" fill={SERIES_2} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
