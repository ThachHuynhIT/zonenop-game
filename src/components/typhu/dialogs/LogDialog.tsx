"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { type TPGameView } from "@/lib/typhu/protocol";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
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
  return (
    <GameDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Diễn biến"
      description={`Toàn bộ ${log.length} dòng, mới nhất ở trên`}
      footer={
        <GameButton size="sm" onClick={onClose}>
          Đóng
        </GameButton>
      }
    >
      <LogList log={log} />
    </GameDialog>
  );
}
