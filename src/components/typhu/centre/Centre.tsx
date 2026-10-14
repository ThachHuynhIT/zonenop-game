"use client";

import { useEffect, useRef } from "react";
import { toast as showToast } from "sonner";
import { useHotkeys } from "@/components/games/useHotkeys";
import { JAIL_FINE, isOwnable } from "@/lib/typhu/board";
import { type TPGameView, type TPPlayerView, type TPRoomView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { boardRef } from "../board-ref";
import { buildableGroups, money, type Act } from "../shared";
import { ActionBar } from "./ActionBar";
import { Die } from "./Dice";
import { LoanCard, TradeCard } from "./OfferCards";
import { BuildPanel } from "../panels/BuildPanel";

export function Centre({
  placement,
  showBuild,
  setShowBuild,
  g,
  view,
  myTurn,
  mine,
  busy,
  run,
  nameOf,
  assetsOpen,
  onOpenAssets,
  onTrade,
  onLoan,
}: {
  /** Where the turn line and my buttons sit: here in the centre, or in the bottom bar the table renders itself. */
  placement: "center" | "bottom";
  showBuild: boolean;
  setShowBuild: (open: boolean) => void;
  g: TPGameView;
  view: TPRoomView;
  myTurn: boolean;
  mine: TPPlayerView | null;
  busy: boolean;
  run: Act;
  nameOf: (id: string) => string;
  assetsOpen: boolean;
  onOpenAssets: () => void;
  onTrade: () => void;
  onLoan: () => void;
}) {
  const turnName = g.turn ? nameOf(g.turn) : "";
  const current = g.players.find((p) => p.id === g.turn);
  const here = current ? boardRef.current[current.pos] : null;
  // Re-run the dice animation on every new roll (each roll writes a "🎲" log line).
  const rollId = [...g.log].reverse().find((e) => e.text.startsWith("🎲"))?.id ?? 0;
  const fullGroups = mine ? buildableGroups(g, mine.id, view.settings.needGroup !== false) : [];
  const ownsLand = !!mine && Object.values(g.deeds).some((d) => d.owner === mine.id);
  const debt = myTurn && g.phase === "debt" ? g.debt : null;

  // Desktop shortcuts (the buttons below show their key). Space = the main action of the moment.
  const canBuy = g.phase === "buy" && !!here && isOwnable(here) && !!mine && mine.cash >= here.price;
  const canBuild = g.phase !== "debt" && fullGroups.length > 0;
  const doRoll = () => g.phase === "roll" && void run({ type: "roll" });
  const doBuy = () => canBuy && void run({ type: "buy" });
  const doEnd = () => g.phase === "end" && void run({ type: "end" });
  useHotkeys(
    {
      r: doRoll,
      b: doBuy,
      s: () => g.phase === "buy" && void run({ type: "skip" }),
      e: doEnd,
      " ": () => (g.phase === "roll" ? doRoll() : g.phase === "buy" ? doBuy() : doEnd()),
      x: () => canBuild && setShowBuild(true),
      a: () => g.phase !== "debt" && ownsLand && !assetsOpen && onOpenAssets(),
      j: () => g.phase === "roll" && !!mine?.jail && mine.cash >= JAIL_FINE && void run({ type: "payjail" }),
      k: () => g.phase === "roll" && !!mine?.jail && !!mine.jailCards && void run({ type: "jailcard" }),
      Escape: showBuild ? () => setShowBuild(false) : undefined,
    },
    myTurn && !!mine && !busy,
  );

  // Hidden auto-play (Ctrl+Shift+Y toggles): the server plays my turns, one step every 2.5 s like for an offline
  // player (jail and debts included), but buys squares under 300tr and builds where the table rules allow, always
  // keeping 150tr (be_game `{ type: "auto", on }`). The flag lives on the server (`view.auto`, only in my own view),
  // so it survives a reload and keeps playing while the tab is hidden.
  const auto = !!view.auto;
  const toggleAuto = useRef(() => {});
  toggleAuto.current = () => {
    if (view.role !== "player") return;
    const on = !auto;
    void run({ type: "auto", on }).then((ok) => {
      if (ok) showToast(on ? "🤖 Tự động chơi: BẬT" : "🤖 Tự động chơi: TẮT", { duration: 1800 });
    });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyY") || e.repeat) return;
      e.preventDefault();
      toggleAuto.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trade = g.trade;
  const loan = g.loan;
  const canTrade = view.role === "player" && !!mine && !mine.bankrupt;
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 text-center">
      {auto && (
        <p className="rounded-full bg-fuchsia-700 px-3 py-0.5 text-[11px] font-bold text-white shadow">🤖 Tự động chơi · Ctrl+Shift+Y để tắt</p>
      )}
      {loan && (
        <div className="w-full text-left">
          <LoanCard
            loan={loan}
            nameOf={nameOf}
            incoming={loan.to === view.meId}
            outgoing={loan.from === view.meId}
            onAnswer={(accept) => void run({ type: "loananswer", accept })}
          />
        </div>
      )}
      {trade && (
        <div className="w-full text-left">
          <TradeCard
            trade={trade}
            nameOf={nameOf}
            incoming={trade.to === view.meId}
            outgoing={trade.from === view.meId}
            deadline={trade.deadline}
            onAnswer={(accept) => void run({ type: "tradeanswer", accept })}
          />
        </div>
      )}
      <p className="hidden font-black tracking-tight [font-family:var(--font-game)] text-emerald-900 sm:block sm:text-3xl short:hidden">CỜ TỶ PHÚ</p>
      <div className={cn("flex items-center gap-2", debt && "max-sm:hidden")}>
        {g.dice ? (
          <>
            <Die value={g.dice[0]} rolling={rollId} />
            <Die value={g.dice[1]} rolling={rollId + 0.5} />
            <span className="ml-1 font-mono text-lg font-black text-emerald-900 sm:text-2xl short:text-base">= {g.dice[0] + g.dice[1]}</span>
          </>
        ) : (
          <span className="text-3xl sm:text-5xl short:text-2xl">🎲</span>
        )}
      </div>
      {placement === "center" && (
        <ActionBar placement="center" g={g} view={view} myTurn={myTurn} mine={mine} busy={busy} run={run} nameOf={nameOf} assetsOpen={assetsOpen} onOpenAssets={onOpenAssets} onBuild={() => setShowBuild(true)} />
      )}
      {canTrade && !trade && !loan && (
        <div className="flex flex-wrap justify-center gap-2 max-lg:hidden short:flex">
          <button onClick={onTrade} className="rounded-lg border border-emerald-900/30 bg-white/60 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-white/80 max-sm:min-h-9">
            🤝 Đổi đất / mua bán
          </button>
          <button onClick={onLoan} className="rounded-lg border border-emerald-900/30 bg-white/60 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-white/80 max-sm:min-h-9">
            🏦 Vay tiền
          </button>
        </div>
      )}
      {!myTurn && g.phase === "buy" && here && <p className="text-xs text-emerald-900/70">{turnName} đang cân nhắc mua {here.name}…</p>}
      {!myTurn && g.phase === "debt" && g.debt && (
        <p className="text-xs text-rose-700">
          {turnName} đang xoay {money(g.debt.amount)} để trả nợ…
        </p>
      )}
      {mine?.jail ? <p className="text-xs text-zinc-700">🚔 Bạn đang ở tù — tung đôi, nộp phạt hoặc dùng thẻ để ra.</p> : null}
      {view.role === "player" && mine && !mine.bankrupt && (
        <p className="hidden text-[11px] text-emerald-900/60 sm:block short:hidden">
          Bấm vào một ô để xem chi tiết, xây nhà hoặc thế chấp.
          <span className="hidden lg:inline [@media(pointer:coarse)]:hidden"> Phím tắt: Space = hành động chính · R tung · B mua · S bỏ qua · E kết thúc · X xây · A thế chấp · L diễn biến.</span>
        </p>
      )}
      {mine?.bankrupt && <p className="text-sm font-semibold text-rose-700">💸 Bạn đã phá sản — xem mọi người chơi tiếp nhé.</p>}
      {showBuild && mine && <BuildPanel g={g} mine={mine} settings={view.settings} busy={busy} run={run} onClose={() => setShowBuild(false)} onOpenAssets={onOpenAssets} />}
    </div>
  );
}
