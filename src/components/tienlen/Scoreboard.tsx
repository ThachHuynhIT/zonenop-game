"use client";

import { type GameRecord, INSTANT_WIN_NAMES } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { Sheet } from "./Sheet";

const RANK_TITLES = ["Nhất", "Nhì", "Ba"];
export const rankTitle = (i: number, total: number) => (i === total - 1 ? "Bét" : RANK_TITLES[i] ?? String(i + 1));

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function DeltaBadge({ delta }: { delta: number }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 font-mono text-xs font-bold",
        delta > 0 ? "bg-emerald-500/25 text-emerald-300" : delta < 0 ? "bg-rose-500/25 text-rose-300" : "bg-white/10 text-white/70",
      )}
    >
      {signed(delta)}
    </span>
  );
}

/** Room scoreboard: cumulative points per seat plus the last games. */
/** What the scoreboard needs from a room view (Tiến Lên and Mèo Nổ both fit). */
export interface ScoreboardData {
  code: string;
  meId: string;
  seats: ({ id: string; name: string; points: number; games: number; wins: number } | null)[];
  history: GameRecord[];
}

const TIENLEN_NOTE =
  "Điểm mỗi ván: Nhất +2, Nhì +1 (4 người +2/+1/−1/−2 · 3 người +2/+1/−3 · 2 người +2/−2) · chết cháy thua gấp đôi · tới trắng +4 từ mỗi người · chặt heo đen +1, heo đỏ +2, mỗi lần chặt chồng gấp đôi (người bị chặt trả).";

export function ScoreboardModal({
  view,
  onClose,
  note = TIENLEN_NOTE,
  className = "border-emerald-200/15 bg-[#0b2a1c] text-emerald-50",
}: {
  view: ScoreboardData;
  onClose: () => void;
  note?: string;
  /** Panel colours (Mèo Nổ passes its own). */
  className?: string;
}) {
  const players = view.seats.filter((s): s is NonNullable<typeof s> => !!s).sort((a, b) => b.points - a.points);
  const history = view.history.slice().reverse();

  return (
    <Sheet title={`🏆 Bảng điểm phòng ${view.code}`} label="Bảng điểm" onClose={onClose} className={className} bodyClassName="p-4 sm:p-5">
        <table className="mb-5 w-full text-sm">
          <thead className="text-left text-xs text-emerald-100/50">
            <tr>
              <th className="pb-1">#</th>
              <th className="pb-1">Người chơi</th>
              <th className="pb-1 text-right">Ván</th>
              <th className="pb-1 text-right">Nhất</th>
              <th className="pb-1 text-right">Điểm</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id} className={cn("border-t border-white/5", p.id === view.meId && "text-amber-200")}>
                <td className="py-1.5 text-emerald-100/50">{i + 1}</td>
                <td className="py-1.5">
                  {p.name}
                  {p.id === view.meId && <span className="ml-1 text-xs text-emerald-100/50">(bạn)</span>}
                </td>
                <td className="py-1.5 text-right">{p.games}</td>
                <td className="py-1.5 text-right">{p.wins}</td>
                <td className="py-1.5 text-right font-mono font-bold">{signed(p.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mb-2 text-sm font-semibold text-emerald-100/80">Các ván gần đây</h3>
        {history.length === 0 ? (
          <p className="text-sm text-emerald-100/50">Chưa có ván nào kết thúc.</p>
        ) : (
          <ol className="space-y-2">
            {history.map((g) => (
              <li key={g.id} className="rounded-lg bg-black/25 p-2.5 text-sm">
                <div className="mb-1 flex justify-between text-xs text-emerald-100/50">
                  <span>Ván #{g.id.split("-").pop()}</span>
                  <span>
                    {g.instantWin && <b className="mr-2 text-amber-300">Tới trắng: {INSTANT_WIN_NAMES[g.instantWin]}</b>}
                    {new Date(g.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {g.results.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1">
                      <b className="text-amber-300">{rankTitle(r.rank, g.results.length)}</b> {r.name} <DeltaBadge delta={r.delta} />
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs leading-relaxed text-emerald-100/55">{note}</p>
    </Sheet>
  );
}
