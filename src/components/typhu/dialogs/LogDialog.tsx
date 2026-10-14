"use client";

import { useEffect } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { type TPGameView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";

/** Game log, newest first, coloured by tone. */
export function LogList({ log, className }: { log: TPGameView["log"]; className?: string }) {
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 160 });
  return (
    <ul ref={listRef} className={cn("flex flex-col gap-1 overflow-y-auto text-xs", className)}>
      {log
        .slice()
        .reverse()
        .map((e) => (
          <li
            key={e.id}
            className={cn(
              "rounded px-2 py-1",
              e.tone === "bad" && "bg-rose-500/15 text-rose-100",
              e.tone === "money" && "bg-emerald-500/15 text-emerald-100",
              e.tone === "buy" && "bg-sky-500/15 text-sky-100",
              e.tone === "jail" && "bg-zinc-500/25",
              e.tone === "card" && "bg-amber-500/15 text-amber-100",
              (!e.tone || e.tone === "info") && "text-white/75",
            )}
          >
            {e.text}
          </li>
        ))}
    </ul>
  );
}

/** The whole game log (the server keeps the last 150 lines), newest first. */
export function LogModal({ log, onClose }: { log: TPGameView["log"]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl border border-white/15 bg-[#111013] p-4 text-white shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-amber-300">📜 Toàn bộ diễn biến ({log.length})</h2>
          <button onClick={onClose} className="rounded-lg bg-amber-400 px-3 py-1 text-sm font-semibold text-black hover:bg-amber-300 max-sm:min-h-9">
            Đóng
          </button>
        </div>
        <LogList log={log} className="min-h-0 flex-1" />
      </div>
    </div>
  );
}
