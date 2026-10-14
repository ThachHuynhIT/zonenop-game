"use client";

import { useEffect, useRef, useState } from "react";
import { toast as showToast } from "sonner";
import { useHotkeys } from "@/components/games/useHotkeys";
import { AIR_RENT, GROUP_COLORS, JAIL_FINE, type Ownable, UTIL_MULT, isOwnable } from "@/lib/typhu/board";
import { type TPGameView, type TPPlayerView, type TPRoomView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { Countdown } from "@/components/game-ui/Countdown";
import { GameBadge } from "@/components/game-ui/GameBadge";
import { boardRef, groupPositions } from "../board-ref";
import { CBtn, GROUP_NAMES, buildableGroups, money, type Act } from "../shared";
import { Die } from "./Dice";
import { LoanCard, TradeCard } from "./OfferCards";
import { BuildPanel } from "../panels/BuildPanel";
import { DebtControls } from "../panels/DebtControls";

/** be_game's default step time (`stepSeconds` is optional in the room settings). */
const DEFAULT_STEP_SECONDS = 30;

export function Centre({
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
  // Per-turn step time (the server's default is 30 s when the room never set one); `timeLimit` is the whole-game clock.
  const stepMs = (view.settings.stepSeconds ?? DEFAULT_STEP_SECONDS) * 1000;
  // Re-run the dice animation on every new roll (each roll writes a "🎲" log line).
  const rollId = [...g.log].reverse().find((e) => e.text.startsWith("🎲"))?.id ?? 0;
  const [showBuild, setShowBuild] = useState(false);
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
      {/* My turn: a light runs around the turn line + my controls. */}
      <div className={cn("relative flex w-full flex-col items-center gap-2 rounded-2xl", myTurn && "bg-rose-50/40 p-2 short:p-1.5")}>
        {myTurn && <span aria-hidden className="game-beam" />}
        <p className="flex items-center gap-2 text-xs sm:text-sm">
          {myTurn ? <GameBadge tone="accent" role="status">Lượt của bạn</GameBadge> : <span>Lượt của <b>{turnName}</b></span>}
          {g.deadline && <Countdown deadline={g.deadline} total={stepMs} size={36} />}
        </p>

        {myTurn && mine && (
          <div className="flex flex-wrap justify-center gap-2">
            {g.phase === "roll" && (
              <>
                <CBtn primary hotkey="R" onClick={() => void run({ type: "roll" })} disabled={busy}>
                  🎲 {g.rollAgain ? "Tung tiếp (đôi!)" : "Tung xúc xắc"}
                </CBtn>
                {mine.jail > 0 && (
                  <>
                    <CBtn hotkey="J" onClick={() => void run({ type: "payjail" })} disabled={busy || mine.cash < JAIL_FINE}>
                      Nộp {money(JAIL_FINE)} ra tù
                    </CBtn>
                    {mine.jailCards > 0 && (
                      <CBtn hotkey="K" onClick={() => void run({ type: "jailcard" })} disabled={busy}>
                        🗝️ Dùng thẻ ra tù
                      </CBtn>
                    )}
                  </>
                )}
              </>
            )}
            {g.phase === "buy" && here && isOwnable(here) && (
              <>
                <CBtn primary hotkey="B" onClick={() => void run({ type: "buy" })} disabled={busy || mine.cash < here.price}>
                  🏷️ Mua {here.name} · {money(here.price)}
                </CBtn>
                <CBtn hotkey="S" onClick={() => void run({ type: "skip" })} disabled={busy}>
                  Bỏ qua
                </CBtn>
                <BuyHint g={g} sq={here} meId={mine.id} />
              </>
            )}
            {g.phase === "end" && (
              <CBtn primary hotkey="E" onClick={() => void run({ type: "end" })} disabled={busy}>
                Kết thúc lượt ➜
              </CBtn>
            )}
            {g.phase !== "debt" && (
              <CBtn build hotkey="X" onClick={() => setShowBuild(true)} disabled={busy || !fullGroups.length} title={fullGroups.length ? undefined : view.settings.needGroup === false ? "Chưa có đất thành phố nào" : "Cần sở hữu đủ cả một nhóm màu"}>
                🏠 Xây nhà{fullGroups.length ? ` (${fullGroups.length} nhóm)` : ""}
              </CBtn>
            )}
            {g.phase !== "debt" && ownsLand && !assetsOpen && (
              <CBtn hotkey="A" onClick={onOpenAssets} disabled={busy}>
                💰 Thế chấp / Bán
              </CBtn>
            )}
            {debt && <DebtControls debt={debt} cash={mine.cash} busy={busy} run={run} onOpenAssets={ownsLand ? onOpenAssets : undefined} />}
          </div>
        )}
      </div>
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

/** One line under the Mua button: the rent you'd earn and how close you are to the full group. */
function BuyHint({ g, sq, meId }: { g: TPGameView; sq: Ownable; meId: string }) {
  let text: React.ReactNode;
  if (sq.kind === "prop") {
    const cells = groupPositions(sq.group);
    const have = cells.filter((p) => g.deeds[p]?.owner === meId).length;
    const others = cells.filter((p) => g.deeds[p] && g.deeds[p].owner !== meId).length;
    text = (
      <>
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: GROUP_COLORS[sq.group] }} />
        Thuê {money(sq.rent[0])} · khách sạn {money(sq.rent[5])} · nhóm {GROUP_NAMES[sq.group]}: bạn có {have}/{cells.length}
        {have + 1 === cells.length && others === 0 && <b className="text-emerald-700"> — mua là đủ nhóm!</b>}
        {others > 0 && <span className="text-rose-700"> (người khác đã giữ {others})</span>}
      </>
    );
  } else if (sq.kind === "air") {
    const have = Object.entries(g.deeds).filter(([pos, d]) => d.owner === meId && boardRef.current[Number(pos)].kind === "air").length;
    text = <>Thuê {AIR_RENT.map((r) => money(r)).join(" → ")} theo số sân bay · bạn có {have}/4</>;
  } else {
    text = <>Thuê = xúc xắc × {UTIL_MULT[0]} (có cả hai: × {UTIL_MULT[1]})</>;
  }
  return <p className="w-full rounded-lg bg-white/60 px-2 py-1 text-[11px] text-emerald-950 sm:text-xs">{text}</p>;
}
