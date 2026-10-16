"use client";

import { lazy, Suspense } from "react";
import { DeltaBadge } from "@/components/tienlen/Scoreboard";
import { type TPRoomView, type TPSeatView } from "@/lib/typhu/protocol";
import { money, type Act } from "../shared";

// Base UI tabs are heavy and only the host's lobby needs them: fetched on demand.
const TableSettings = lazy(() => import("./TableSettings").then((m) => ({ default: m.TableSettings })));

// ─── Waiting / results ──────────────────────────────────────────────

export function Waiting({ view, me, act, nameOf }: { view: TPRoomView; me: TPSeatView | null; act: Act; nameOf: (id: string) => string }) {
  const g = view.current;
  const count = view.seats.filter(Boolean).length;
  const ended = g?.status === "ended";
  const last = view.history[view.history.length - 1];
  const isHost = !!me?.isHost && view.role === "player";

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/80 p-3 text-sm shadow-xl sm:p-4">
      {ended && g ? (
        <>
          <h2 className="mb-2 text-base font-black text-emerald-800 sm:text-lg">🏆 {nameOf(g.finished[0])} là tỷ phú!</h2>
          <ol className="mb-3 space-y-1">
            {g.finished.map((id, i) => {
              const p = g.players.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <b className="mr-1 text-emerald-700">#{i + 1}</b>
                    {nameOf(id)}
                    {id === view.meId && " (bạn)"}
                    {p && !p.bankrupt && <span className="ml-1 font-mono text-xs text-emerald-900/60">{money(p.netWorth)}</span>}
                    {p?.bankrupt && <span className="ml-1 text-xs text-rose-600">phá sản</span>}
                  </span>
                  {last?.results.find((r) => r.id === id) && <DeltaBadge delta={last.results.find((r) => r.id === id)!.delta} />}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-base font-black text-emerald-800 sm:text-lg">🎩 Cờ Tỷ Phú Việt Nam</h2>
          <p className="mb-3 text-xs text-emerald-900/70 sm:text-sm">{count}/6 người · gửi link mời để bạn bè vào bàn</p>
        </>
      )}

      {/* Small boards (phones): the rules live beside / below the board instead of in its tiny centre. */}
      <Suspense fallback={null}>
        <TableSettings view={view} isHost={isHost} act={act} className="mb-3 max-sm:hidden short:hidden" />
      </Suspense>
      <p className="mb-2 hidden text-[11px] text-emerald-900/70 max-sm:block short:block">
        ⚙️ Luật bàn ở <span className="short:hidden">bên dưới ↓</span>
        <span className="hidden short:inline">bên phải →</span>
      </p>

      {isHost ? (
        <button
          onClick={() => void act({ type: "start" })}
          disabled={count < 2}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {count < 2 ? "Cần ít nhất 2 người" : ended ? "Ván mới" : "Bắt đầu"}
        </button>
      ) : (
        <p className="text-xs text-emerald-900/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
      )}
    </div>
  );
}
