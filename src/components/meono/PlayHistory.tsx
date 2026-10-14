"use client";

import { useMemo, useState } from "react";
import { CARDS, type CardType } from "@/lib/meono/cards";
import type { MeoGameView as MeoGame, MeoPlay } from "@/lib/meono/protocol";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = { pair: "Đôi mèo", triple: "Bộ ba mèo", five: "5 lá khác nhau" };

const RESULT: Record<MeoPlay["result"], { text: string; className: string }> = {
  pending: { text: "⏳ chờ Không!", className: "bg-amber-400/20 text-amber-100" },
  done: { text: "✅ có hiệu lực", className: "bg-emerald-500/20 text-emerald-100" },
  blocked: { text: "🚫 bị chặn", className: "bg-rose-500/25 text-rose-100" },
};

const clock = (at: number) => new Date(at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** A card as a small coloured chip; clicking it shows what it does. */
function CardChip({ type, active, onClick }: { type: CardType; active: boolean; onClick: () => void }) {
  const info = CARDS[type];
  return (
    <button
      onClick={onClick}
      title={info ? `${info.name}: ${info.effect}` : type}
      className={cn(
        "flex items-center gap-1 rounded-md bg-gradient-to-br px-1.5 py-0.5 text-[11px] font-bold text-white shadow pointer-coarse:min-h-8 pointer-coarse:px-2",
        info?.color,
        active ? "ring-2 ring-amber-300" : "hover:brightness-110",
      )}
    >
      <span>{info?.emoji}</span>
      <span className="max-w-[7rem] truncate">{info?.name ?? type}</span>
    </button>
  );
}

type Focus = { play: number; type: CardType } | null;

/** What the focused card does (shown above the list). */
function FocusInfo({ focus, onClose }: { focus: Focus; onClose: () => void }) {
  const info = focus ? CARDS[focus.type] : null;
  if (!info) return null;
  return (
    <div className="shrink-0 rounded-lg border border-amber-300/30 bg-black/40 p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-amber-200">
          {info.emoji} {info.name}
        </p>
        <button onClick={onClose} className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-orange-100/70 hover:bg-white/10 pointer-coarse:size-9" aria-label="Đóng">
          ✕
        </button>
      </div>
      <p className="mt-0.5 text-orange-100/60">
        <b>Khi nào:</b> {info.how}
      </p>
      <p className="mt-0.5 text-orange-50">{info.effect}</p>
    </div>
  );
}

/** One play: who played what at whom, the cards as clickable chips, who said Không! and how it ended. */
function PlayItem({ p, who, focus, setFocus }: { p: MeoPlay; who: (id: string) => string; focus: Focus; setFocus: (f: Focus) => void }) {
  const combo = KIND_LABEL[p.kind];
  const result = RESULT[p.result];
  return (
    <li className={cn("rounded-lg border border-white/5 bg-white/5 px-2 py-1.5", p.result === "blocked" && "opacity-75")}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">
          <b className="text-orange-50">{who(p.by)}</b>
          {combo && <span className="text-orange-100/60"> · {combo}</span>}
          {p.target && (
            <>
              {" "}
              → 🎯 <b>{who(p.target)}</b>
            </>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-orange-100/40">{clock(p.at)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {p.cards.map((t, i) => (
          <CardChip key={i} type={t} active={focus?.play === p.id && focus.type === t} onClick={() => setFocus({ play: p.id, type: t })} />
        ))}
        {p.named && (
          <span className="flex items-center gap-1 text-[11px] text-orange-100/70">
            đòi <CardChip type={p.named} active={focus?.play === p.id && focus.type === p.named} onClick={() => setFocus({ play: p.id, type: p.named! })} />
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
        <span className={cn("rounded-full px-1.5 py-0.5", result.className)}>{result.text}</span>
        {p.nopes.map((id, i) => (
          <span key={i} className="rounded-full bg-red-900/50 px-1.5 py-0.5 text-red-100">
            🚫 {who(id)}
          </span>
        ))}
      </div>
    </li>
  );
}

/** Every card played this game, newest first: who played what, at whom, who said Không! and how it ended. */
export function PlayHistory({ plays, nameOf, meId, className }: { plays: MeoPlay[]; nameOf: (id: string) => string; meId: string; className?: string }) {
  const [focus, setFocus] = useState<Focus>(null);
  const who = (id: string) => (id === meId ? "Bạn" : nameOf(id));

  if (!plays.length) return <p className={cn("text-sm text-orange-100/50", className)}>Chưa ai đánh lá nào.</p>;
  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <FocusInfo focus={focus} onClose={() => setFocus(null)} />
      <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {plays
          .slice()
          .reverse()
          .map((p) => (
            <PlayItem key={p.id} p={p} who={who} focus={focus} setFocus={setFocus} />
          ))}
      </ol>
      <p className="text-[10px] text-orange-100/40">Bấm vào lá để xem chức năng.</p>
    </div>
  );
}

export type MeoLogLine = MeoGame["log"][number];

type FeedItem = { key: string; at: number; rank: number } & ({ play: MeoPlay } | { line: MeoLogLine });

/**
 * One chronological feed: log lines, with each play's announcement replaced by the play itself
 * (clickable card chips, nopes, result). Plays whose line has scrolled out of the log (or that a
 * server without `play` links never linked) are slotted in by time, ahead of lines at the same instant.
 */
export function mergeFeed(log: MeoLogLine[], plays: MeoPlay[]): FeedItem[] {
  const byId = new Map(plays.map((p) => [p.id, p]));
  const linked = new Set<number>();
  const items: FeedItem[] = log.map((e, i) => {
    const play = e.play !== undefined ? byId.get(e.play) : undefined;
    if (play) {
      linked.add(play.id);
      return { key: `p${play.id}`, at: e.at, rank: i, play };
    }
    return { key: `l${e.id}`, at: e.at, rank: i, line: e };
  });
  for (const p of plays) if (!linked.has(p.id)) items.push({ key: `p${p.id}`, at: p.at, rank: -1e6 + p.id, play: p });
  return items.sort((a, b) => a.at - b.at || a.rank - b.rank);
}

/** Diễn biến: everything that happened, newest first — plays as card chips, other events as text. */
export function EventFeed({
  log,
  plays,
  nameOf,
  meId,
  className,
}: {
  log: MeoLogLine[];
  plays: MeoPlay[];
  nameOf: (id: string) => string;
  meId: string;
  className?: string;
}) {
  const [focus, setFocus] = useState<Focus>(null);
  const who = (id: string) => (id === meId ? "Bạn" : nameOf(id));
  const items = useMemo(() => mergeFeed(log, plays).reverse(), [log, plays]);

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <FocusInfo focus={focus} onClose={() => setFocus(null)} />
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {items.map((it) =>
          "play" in it ? (
            <PlayItem key={it.key} p={it.play} who={who} focus={focus} setFocus={setFocus} />
          ) : (
            <li
              key={it.key}
              className={cn(
                "rounded-md px-2 py-1",
                it.line.tone === "boom" && "bg-rose-600/30 text-rose-100",
                it.line.tone === "defuse" && "bg-emerald-600/25 text-emerald-100",
                it.line.tone === "nope" && "bg-red-900/40 text-red-100",
                it.line.tone === "steal" && "bg-amber-600/20 text-amber-100",
                (!it.line.tone || it.line.tone === "info") && "text-orange-50/80",
              )}
            >
              {it.line.text}
            </li>
          ),
        )}
        {!items.length && <li className="text-orange-100/50">Chưa có gì xảy ra.</li>}
      </ol>
      {plays.length > 0 && <p className="shrink-0 text-[10px] text-orange-100/40">Bấm vào lá để xem chức năng.</p>}
    </div>
  );
}
