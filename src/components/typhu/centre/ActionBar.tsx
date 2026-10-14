"use client";

import { useLayoutEffect, useRef } from "react";
import { AIR_RENT, GROUP_COLORS, JAIL_FINE, type Ownable, UTIL_MULT, isOwnable } from "@/lib/typhu/board";
import { type TPGameView, type TPPlayerView, type TPRoomView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { Countdown } from "@/components/game-ui/Countdown";
import { GameBadge } from "@/components/game-ui/GameBadge";
import { boardRef, groupPositions } from "../board-ref";
import { CBtn, GROUP_NAMES, buildableGroups, money, type Act } from "../shared";
import { DebtControls } from "../panels/DebtControls";

/** be_game's default step time (`stepSeconds` is optional in the room settings). */
const DEFAULT_STEP_SECONDS = 30;
/** be_game DEBT_MS: a debt has its own deadline, whatever the step time is. */
const DEBT_MS = 60_000;

// The cream centre panel hides the countdown's defaults (white track, yellow arc, pale urgent digit): darken them there.
// The urgent arc keeps its own red (`stroke-rose-500`), so it is left out of the arc override.
const COUNTDOWN_ON_CREAM =
  "[&_circle:first-child]:stroke-emerald-900/20 [&_circle:last-child:not(.stroke-rose-500)]:stroke-emerald-700 [&>span]:text-emerald-950";

/**
 * The turn line and my controls: in the board centre (`center`) or in a bar stuck to the bottom of the screen
 * (`bottom`, phones held upright). Same buttons and conditions either way; the hotkeys live in `Centre`.
 */
export function ActionBar({
  placement,
  g,
  view,
  myTurn,
  mine,
  busy,
  run,
  nameOf,
  assetsOpen,
  onOpenAssets,
  onBuild,
  onHeight,
}: {
  placement: "center" | "bottom";
  g: TPGameView;
  view: TPRoomView;
  myTurn: boolean;
  mine: TPPlayerView | null;
  busy: boolean;
  run: Act;
  nameOf: (id: string) => string;
  assetsOpen: boolean;
  onOpenAssets: () => void;
  onBuild: () => void;
  /** `bottom` only: reports the bar's height (it grows when the buttons wrap) so the page can leave room under its content. */
  onHeight?: (px: number) => void;
}) {
  const bottom = placement === "bottom";
  const turnName = g.turn ? nameOf(g.turn) : "";
  const current = g.players.find((p) => p.id === g.turn);
  const here = current ? boardRef.current[current.pos] : null;
  // Per-turn step time (the server's default is 30 s when the room never set one); `timeLimit` is the whole-game clock.
  const stepMs = (view.settings.stepSeconds ?? DEFAULT_STEP_SECONDS) * 1000;
  const fullGroups = mine ? buildableGroups(g, mine.id, view.settings.needGroup !== false) : [];
  const ownsLand = !!mine && Object.values(g.deeds).some((d) => d.owner === mine.id);
  const debt = myTurn && g.phase === "debt" ? g.debt : null;

  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(Math.ceil(el.getBoundingClientRect().height));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight, bottom]);

  // My turn: a light runs around the turn line + my controls.
  const content = (
    <div className={cn("relative flex w-full flex-col items-center gap-2 rounded-2xl", myTurn && (bottom ? "p-1.5" : "bg-rose-50/40 p-2 short:p-1.5"))}>
      {myTurn && <span aria-hidden className="game-beam" />}
      <p className="flex items-center gap-2 text-xs sm:text-sm">
        {myTurn ? <GameBadge tone="accent" role="status">Lượt của bạn</GameBadge> : <span>Lượt của <b>{turnName}</b></span>}
        {g.deadline && <Countdown deadline={g.deadline} total={g.phase === "debt" ? DEBT_MS : stepMs} size={36} className={bottom ? undefined : COUNTDOWN_ON_CREAM} />}
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
              {/* The bar stays short: the rent hint is for the board centre. */}
              {!bottom && <BuyHint g={g} sq={here} meId={mine.id} />}
            </>
          )}
          {g.phase === "end" && (
            <CBtn primary hotkey="E" onClick={() => void run({ type: "end" })} disabled={busy}>
              Kết thúc lượt ➜
            </CBtn>
          )}
          {g.phase !== "debt" && (
            <CBtn build hotkey="X" onClick={onBuild} disabled={busy || !fullGroups.length} title={fullGroups.length ? undefined : view.settings.needGroup === false ? "Chưa có đất thành phố nào" : "Cần sở hữu đủ cả một nhóm màu"}>
              🏠 Xây nhà{fullGroups.length ? ` (${fullGroups.length} nhóm)` : ""}
            </CBtn>
          )}
          {g.phase !== "debt" && ownsLand && !assetsOpen && (
            // Phones held upright already get "💰 Tài sản" in the quick buttons under the board.
            <CBtn hotkey="A" onClick={onOpenAssets} disabled={busy} className="max-lg:hidden short:inline-flex">
              💰 Thế chấp / Bán
            </CBtn>
          )}
          {debt && <DebtControls debt={debt} cash={mine.cash} busy={busy} run={run} onOpenAssets={ownsLand ? onOpenAssets : undefined} />}
        </div>
      )}
    </div>
  );

  if (!bottom) return content;
  return (
    // pr-24 leaves room for the chat / emoji buttons floating in the bottom-right corner.
    <div ref={barRef} className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[oklch(0.2_0.03_290)]/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 pr-24 text-white backdrop-blur">
      {content}
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
