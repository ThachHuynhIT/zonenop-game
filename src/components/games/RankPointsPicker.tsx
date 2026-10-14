"use client";

import { MAX_RANK_POINTS, mirroredRankPoints } from "@/lib/tienlen";
import { cn } from "@/lib/utils";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** Host picks Nhất / Nhì points; the other places are mirrored so every game sums to zero. */
export function RankPointsPicker({
  first,
  second,
  players,
  editable,
  onChange,
  className,
}: {
  first: number;
  second: number;
  /** Seated players, for the preview line. */
  players: number;
  editable: boolean;
  onChange: (v: { first?: number; second?: number }) => void;
  className?: string;
}) {
  const n = Math.max(players, 2);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span>Điểm Nhất / Nhì</span>
        <span className="flex items-center gap-1">
          <select
            value={first}
            disabled={!editable}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ first: v, second: Math.min(second, v) });
            }}
            className="rounded bg-black/40 px-1 py-0.5 text-white"
            aria-label="Điểm Nhất"
          >
            {Array.from({ length: MAX_RANK_POINTS }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                +{v}
              </option>
            ))}
          </select>
          <span className="opacity-50">/</span>
          <select
            value={second}
            disabled={!editable}
            onChange={(e) => onChange({ second: Number(e.target.value) })}
            className="rounded bg-black/40 px-1 py-0.5 text-white"
            aria-label="Điểm Nhì"
          >
            {Array.from({ length: first + 1 }, (_, i) => i).map((v) => (
              <option key={v} value={v}>
                {v ? `+${v}` : "0"}
              </option>
            ))}
          </select>
        </span>
      </div>
      <p className="opacity-70">
        {n} người: {mirroredRankPoints(n, { first, second }).map(signed).join(" / ")}
      </p>
    </div>
  );
}
