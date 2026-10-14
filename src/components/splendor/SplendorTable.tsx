"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { DraggableRow, useHandOrder } from "@/components/games/DraggableHand";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import { useGameRoom } from "@/components/games/gameClient";
import { useHotkeys } from "@/components/games/useHotkeys";
import { SeatBubble, SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { DeltaBadge, ScoreboardModal, signed } from "@/components/tienlen/Scoreboard";
import {
  CARD_BY_ID,
  GEMS,
  GEM_NAMES,
  type Gem,
  MAX_RESERVED,
  MAX_TOKENS,
  TARGET_OPTIONS,
  TOKENS,
  TURN_SECONDS_OPTIONS,
  type Token,
} from "@/lib/splendor/cards";
import { SPLENDOR_WS_PATH, type SPGameView, type SPPlayerView, type SPRoomView, type SPSeatView } from "@/lib/splendor/protocol";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { BonusPip, CardBack, DevCardView, GemCount, GemIcon, MD_SLOT, NobleTile, TokenChip } from "./Pieces";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { WinCelebration } from "@/components/games/WinCelebration";

type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

const SCORE_NOTE =
  "Điểm theo thứ hạng (điểm uy tín cao hơn xếp trên, bằng nhau thì ai ít thẻ hơn xếp trên). Chủ bàn chọn điểm Nhất / Nhì, các hạng cuối trừ tương ứng, tổng mỗi ván luôn bằng 0.";

function localize(view: SPRoomView): SPRoomView {
  const g = view.current;
  if (!g?.deadline) return view;
  const skew = Date.now() - view.serverTime;
  return { ...view, current: { ...g, deadline: g.deadline + skew } };
}

function useNow(active: boolean, every = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

/** Desktop shortcut per gem colour (V = Vàng, only used when returning tokens). */
const GEM_KEYS: Record<Token, string> = { white: "w", blue: "u", green: "g", red: "r", black: "k", gold: "v" };

/** Small key hint on a button; hidden on small and touch screens. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{children}</kbd>
  );
}

const emptyPick = (): Record<Token, number> => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const tokenSum = (t: Record<Token, number>) => TOKENS.reduce((a, k) => a + t[k], 0);

/**
 * How buying `cardId` works out for this player — mirrors be_game `paymentFor`:
 * card bonuses discount the cost, tokens of that colour pay the rest, gold covers any shortfall.
 */
function paymentPlan(cardId: number, p: SPPlayerView) {
  const card = CARD_BY_ID[cardId];
  const rows = GEMS.filter((gem) => card.cost[gem]).map((gem) => {
    const cost = card.cost[gem] ?? 0;
    const bonus = Math.min(cost, p.bonuses[gem]);
    const tokens = Math.min(cost - bonus, p.tokens[gem]);
    return { gem, cost, bonus: p.bonuses[gem], tokens: p.tokens[gem], short: cost - bonus - tokens };
  });
  const short = rows.reduce((a, r) => a + r.short, 0);
  const goldUsed = Math.min(short, p.tokens.gold);
  return { rows, short, goldUsed, missing: short - goldUsed };
}

export default function SplendorTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, call } = useGameRoom<SPRoomView>(SPLENDOR_WS_PATH, code, name, watch ? "watch" : "play", localize);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const act = useCallback<Act>(
    async (msg) => {
      const res = await call(msg);
      if (!res.ok) setToast(res.error);
      return res.ok;
    },
    [call],
  );

  if (status === "error") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-lg text-rose-300">{error}</p>
        <div className="mt-4 flex gap-2">
          {error?.includes("đủ") && (
            <Link href={`/splendor/${code}?watch=1`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black">
              Vào xem 👀
            </Link>
          )}
          <Link href="/splendor" className="rounded-lg border border-white/25 px-4 py-2 font-semibold">
            Về sảnh
          </Link>
        </div>
      </div>
    );
  }
  if (!view) return <p className="flex min-h-[70vh] animate-pulse items-center justify-center text-violet-100/80">Đang kết nối bàn {code}…</p>;
  return (
    <>
      <Table view={view} reconnecting={status === "reconnecting"} act={act} toast={toast} />
      <ChatBox messages={view.chat} meId={view.meId} myName={name} onSend={(text) => act({ type: "chat", text })} onEmoji={(emoji) => void act({ type: "emoji", emoji })} row />
    </>
  );
}

function Table({ view, reconnecting, act, toast }: { view: SPRoomView; reconnecting: boolean; act: Act; toast: string | null }) {
  const g = view.current;
  const playing = g?.status === "playing";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const mine = g?.players.find((p) => p.id === view.meId) ?? null;
  const myTurn = !!mine && playing && g?.turn === view.meId;
  const now = useNow(!!playing);
  const nameOf = (id: string) => view.seats.find((s) => s?.id === id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";

  const [pick, setPick] = useState<Record<Token, number>>(emptyPick);
  const [focus, setFocus] = useState<{ card?: number; tier?: 1 | 2 | 3; reserved?: boolean } | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmTake, setConfirmTake] = useState(false);
  useEffect(() => {
    setPick(emptyPick());
    setConfirmTake(false);
  }, [g?.turn, g?.phase]);

  const run = async (msg: Record<string, unknown> & { type: string }) => {
    setBusy(true);
    const ok = await act(msg);
    setBusy(false);
    return ok;
  };

  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string): Reaction[] => live.filter((r) => r.playerId === id);

  const [copied, setCopied] = useState(false);
  const copyInvite = async () => {
    const url = new URL(`/splendor/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };

  const kick = async (s: SPSeatView) => {
    // The Kích button asks for a second tap itself (window.confirm is blocked in some in-app browsers).
    await act({ type: "kick", playerId: s.id });
  };

  // Gem picking: 3 different, or 2 of one colour (pile ≥ 4).
  const picked = GEMS.flatMap((gem) => Array.from({ length: pick[gem] }, () => gem));
  const togglePick = (gem: Gem) => {
    if (!myTurn || g?.phase !== "turn" || !g) return;
    setPick((p) => {
      const n = { ...p };
      const total = GEMS.reduce((t, x) => t + p[x], 0);
      if (p[gem] === 1 && total === 1 && g.bank[gem] >= 4) n[gem] = 2;
      else if (p[gem] > 0) n[gem] = 0;
      else if (total < 3 && !GEMS.some((x) => p[x] === 2) && g.bank[gem] > 0) n[gem] = 1;
      return n;
    });
  };
  const myTokens = mine ? tokenSum(mine.tokens) : 0;
  const afterTake = myTokens + picked.length;
  const doTake = async (confirmed = false) => {
    // Going over 10 means returning the excess right after — warn first.
    if (!confirmed && afterTake > MAX_TOKENS) {
      setConfirmTake(true);
      return;
    }
    setConfirmTake(false);
    if (await run({ type: "take", gems: picked })) setPick(emptyPick());
  };

  // Desktop shortcuts. Gem keys pick like a click on the bank; Enter / Space = the visible "Lấy đá" button
  // (or "OK, lấy đá" in the over-10 warning); Esc clears the selection. Dialogs block everything but Enter / Esc.
  const canTake = myTurn && g?.phase === "turn" && !!picked.length && !busy;
  const dialogOpen = !!focus || confirmTake || showScores || showRules;
  const gemKeys: Record<string, (() => void) | undefined> = {};
  for (const gem of GEMS) gemKeys[GEM_KEYS[gem]] = myTurn && g?.phase === "turn" ? () => togglePick(gem) : undefined;
  const confirmOrTake = () => {
    if (confirmTake) {
      if (myTurn && g?.phase === "turn" && !busy) void doTake(true);
    } else if (canTake && !dialogOpen) void doTake();
  };
  useHotkeys(
    {
      ...gemKeys,
      Enter: confirmOrTake,
      " ": confirmTake ? undefined : confirmOrTake,
      Escape: !dialogOpen && picked.length ? () => setPick(emptyPick()) : undefined,
    },
    true,
    ["Enter"],
  );

  const canAfford = (cardId: number) => !!mine && paymentPlan(cardId, mine).missing === 0;

  const secondsLeft = g?.deadline ? Math.max(0, Math.ceil((g.deadline - now) / 1000)) : null;

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-3 px-2 pb-24 pt-2 sm:px-4 sm:pt-3 lg:pb-2 xl:max-w-[100rem] short:gap-2 short:pt-1.5">
      <WinCelebration show={g?.status === "ended"} playing={!!playing} won={!!view.meId && g?.finished[0] === view.meId} title={g?.status === "ended" ? `🏆 ${nameOf(g.finished[0])} thắng` : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/splendor" className={headerBtn}>
              ← Sảnh
            </Link>
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-amber-300">{view.code}</span>
          </>
        }
        extra={
          <>
            <button onClick={copyInvite} className={headerBtn} title="Chép link mời">
              {copied ? "✓" : "🔗"}
              <HeaderLabel>{copied ? "Đã chép link" : "Chép link mời"}</HeaderLabel>
            </button>
            <button onClick={() => setShowScores(true)} className={headerBtn} title="Bảng điểm">
              🏆 <HeaderLabel>Bảng điểm</HeaderLabel>
            </button>
            <button onClick={() => setShowRules(true)} className={headerBtn} title="Luật chơi">
              📖 <HeaderLabel>Luật chơi</HeaderLabel>
            </button>
          </>
        }
        status={
          <>
            {g && (
              <span className="whitespace-nowrap" title="Điểm uy tín để thắng">
                🎯 {g.target}
                <span className="hidden sm:inline"> điểm</span>
              </span>
            )}
            {view.spectators.length > 0 && (
              <span className="whitespace-nowrap" title={view.spectators.join(", ")}>
                👀 {view.spectators.length}
              </span>
            )}
            {reconnecting && <span className="animate-pulse whitespace-nowrap text-amber-300">Đang kết nối lại…</span>}
          </>
        }
      />

      {!g || g.status === "ended" ? (
        <div className="relative flex flex-1 items-center justify-center">
          {/* No player panels between games, so everyone's emoji shows in the corner. */}
          <SpectatorReactions reactions={live} />
          <Waiting view={view} me={me} act={act} nameOf={nameOf} />
        </div>
      ) : (
        <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] short:grid-cols-[minmax(0,1fr)_16rem] short:gap-2">
          {/* Market */}
          <div className="relative flex min-w-0 flex-col gap-3 rounded-3xl lg:gap-2 border border-amber-200/10 bg-[radial-gradient(ellipse_at_top,#3b1d5c_0%,#1a0f2b_70%)] p-3 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)] sm:p-4 short:gap-2 short:self-start short:p-2">
            <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2 lg:hidden short:hidden">
                {g.nobleRow.map((n) => (
                  <NobleTile key={n} id={n} />
                ))}
              </div>
              <p className="text-sm text-violet-100/80">
                {myTurn ? <b className="text-amber-300">Lượt của bạn</b> : <>Lượt của <b>{nameOf(g.turn ?? "")}</b></>}
                {secondsLeft !== null && <span className={cn("ml-2 font-mono", secondsLeft <= 8 && "text-rose-400")}>⏱ {secondsLeft}s</span>}
                {g.endTriggered && <span className="ml-2 rounded bg-amber-500/30 px-1.5 text-amber-200">Vòng cuối!</span>}
              </p>
            </div>

            {/* PCs and sideways phones: the noble tiles stand in a column beside the card rows; sideways phones
                also get the bank as a column on the right, so the whole market fits the short screen. */}
            <div className="flex min-w-0 flex-wrap gap-3 lg:justify-center xl:gap-x-5 short:flex-nowrap short:gap-2">
              <div className="flex min-w-0 flex-col gap-3 lg:gap-2 short:gap-2">
                {[3, 2, 1].map((tier) => (
                  <div key={tier} className="flex min-w-0 items-center gap-2 pb-1 short:gap-1.5 short:pb-0">
                    <div className={MD_SLOT}>
                      <CardBack
                        size="fluid"
                        tier={tier as 1 | 2 | 3}
                        count={g.deckCounts[tier - 1]}
                        onClick={g.deckCounts[tier - 1] ? () => setFocus({ tier: tier as 1 | 2 | 3 }) : undefined}
                      />
                    </div>
                    {g.board[tier - 1].map((c, i) => (
                      <div key={c === null ? `e${i}` : c} className={MD_SLOT}>
                        {c === null ? (
                          <div className="aspect-[5/7] w-full rounded-lg border border-dashed border-white/15" />
                        ) : (
                          <motion.div initial={{ scale: 0.6, opacity: 0, rotateY: 90 }} animate={{ scale: 1, opacity: 1, rotateY: 0 }}>
                            <DevCardView size="fluid" id={c} onClick={() => setFocus({ card: c })} affordable={myTurn && canAfford(c)} highlight={g.last?.card === c} />
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="hidden shrink-0 flex-col gap-2 lg:flex short:flex short:gap-1.5" aria-label="Quý tộc">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-amber-200/60">Quý tộc</p>
                {g.nobleRow.map((n) => (
                  <NobleTile key={n} id={n} />
                ))}
              </div>

              {/* Bank */}
              <div className="flex basis-full flex-wrap items-center gap-2 rounded-2xl bg-black/30 p-2 min-[400px]:gap-3 short:grid short:basis-auto short:grid-cols-2 short:gap-1.5 short:self-start short:p-1.5">
                {TOKENS.map((t) => (
                  <TokenChip
                    key={t}
                    gem={t}
                    count={g.bank[t]}
                    size="lg"
                    selected={t === "gold" ? 0 : pick[t as Gem]}
                    dimmed={g.bank[t] === 0}
                    onClick={t === "gold" ? undefined : () => togglePick(t as Gem)}
                    hotkey={t !== "gold" && myTurn && g.phase === "turn" ? GEM_KEYS[t].toUpperCase() : undefined}
                    title={t === "gold" ? "Vàng — chỉ lấy khi giữ thẻ" : `${GEM_NAMES[t]} — bấm để chọn (bấm lần 2 để lấy 2 viên nếu còn ≥ 4)`}
                  />
                ))}
                {myTurn && g.phase === "turn" && (
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2 short:col-span-2 short:ml-0 short:flex-col short:gap-1">
                    <button
                      onClick={() => void doTake()}
                      disabled={!picked.length || busy}
                      className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 disabled:opacity-40 short:whitespace-nowrap short:px-2 short:py-1.5 short:text-xs"
                    >
                      💎 Lấy {picked.length ? picked.length : ""} đá
                      <Kbd>Enter</Kbd>
                    </button>
                    {!!picked.length && (
                      <button onClick={() => setPick(emptyPick())} className="rounded-lg border border-white/25 px-3 py-2 text-sm short:px-2 short:py-1.5 short:text-xs">
                        Bỏ chọn
                        <Kbd>Esc</Kbd>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {myTurn && g.phase === "turn" && (
              <p className="hidden text-[11px] text-white/45 lg:block [@media(pointer:coarse)]:hidden">
                Phím tắt: W trắng · U lam · G lục · R đỏ · K đen = chọn đá (bấm lần 2 = lấy 2 viên) · Enter / Space = lấy đá · Esc = bỏ chọn · trong thẻ: B mua · G giữ.
              </p>
            )}

            {myTurn && g.phase === "discard" && mine && <DiscardPanel p={mine} need={g.discardNeed} run={run} busy={busy} secondsLeft={secondsLeft} />}
          </div>

          {/* Players */}
          <aside className="grid content-start gap-3 sm:grid-cols-2 lg:flex lg:flex-col short:grid-cols-1 short:gap-2">
            {g.players.map((p) => {
              const seat = view.seats.find((s) => s?.id === p.id);
              return (
                <PlayerPanel
                  key={p.id}
                  p={p}
                  name={nameOf(p.id)}
                  seat={seat ?? null}
                  self={p.id === view.meId}
                  isTurn={g.turn === p.id}
                  target={g.target}
                  reactions={reactionsFor(p.id)}
                  onReserved={(c) => setFocus({ card: c, reserved: true })}
                  orderKey={p.id === view.meId ? `splendor:order:${view.code}:${view.meId}` : null}
                  onKick={me?.isHost && seat && !seat.connected && !seat.kicked ? () => void kick(seat) : undefined}
                />
              );
            })}
            <div className="rounded-2xl bg-black/35 p-3 sm:col-span-2 short:col-span-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-100/60">Diễn biến</p>
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-xs">
                {g.log
                  .slice()
                  .reverse()
                  .map((e) => (
                    <li key={e.id} className={cn("rounded px-2 py-1", e.tone === "noble" ? "bg-amber-500/20 text-amber-100" : e.tone === "buy" ? "bg-emerald-500/15" : "text-white/75")}>
                      {e.text}
                    </li>
                  ))}
              </ul>
            </div>
          </aside>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {focus && g && (
        <CardModal
          focus={focus}
          g={g}
          mine={mine}
          myTurn={myTurn}
          busy={busy}
          canAfford={canAfford}
          run={run}
          onClose={() => setFocus(null)}
        />
      )}
      {confirmTake && myTurn && g?.phase === "turn" && (
        <Modal onClose={() => setConfirmTake(false)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-lg font-bold text-amber-300">⚠️ Vượt quá {MAX_TOKENS} viên đá</h2>
            <div className="flex items-center gap-1.5">
              {picked.map((gem, i) => (
                <GemIcon key={i} gem={gem} className="h-9 w-9" />
              ))}
            </div>
            <p className="text-sm text-white/85">
              Bạn đang có <b>{myTokens}</b> viên, lấy thêm <b>{picked.length}</b> viên sẽ thành <b className="text-rose-300">{afterTake}</b> viên.
            </p>
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-100 ring-1 ring-rose-400/40">
              Mỗi người chỉ giữ tối đa {MAX_TOKENS} viên — sau khi lấy, bạn sẽ phải chọn <b>{afterTake - MAX_TOKENS}</b> viên để trả lại ngân hàng.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => void doTake(true)}
                disabled={busy}
                className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 disabled:opacity-40"
              >
                OK, lấy đá
                <Kbd>Enter</Kbd>
              </button>
              <button onClick={() => setConfirmTake(false)} className="rounded-lg border border-white/25 px-4 py-2 font-semibold hover:bg-white/10">
                Chọn lại
                <Kbd>Esc</Kbd>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={SCORE_NOTE} />}
      {showRules && (
        <Modal onClose={() => setShowRules(false)}>
          <h2 className="mb-3 text-lg font-bold text-amber-300">📖 Luật Đá Quý</h2>
          <SplendorRules />
        </Modal>
      )}
    </div>
  );
}

function PlayerPanel({
  p,
  name,
  seat,
  self,
  isTurn,
  target,
  reactions,
  onReserved,
  onKick,
  orderKey,
}: {
  p: SPPlayerView;
  name: string;
  seat: SPSeatView | null;
  self: boolean;
  isTurn: boolean;
  target: number;
  reactions: Reaction[];
  onReserved: (card: number) => void;
  onKick?: () => void;
  /** Your own panel: drag to arrange your reserved cards. */
  orderKey?: string | null;
}) {
  const mineReserved = p.reserved.filter((c): c is number => c !== null);
  const reservedOrder = useHandOrder(mineReserved, orderKey ?? null);
  const tokenTotal = Object.values(p.tokens).reduce((a, b) => a + b, 0);
  const myTurn = self && isTurn;
  return (
    <div
      className={cn(
        "relative rounded-2xl p-2.5 sm:p-3 short:p-2",
        myTurn ? "bg-rose-500/10 ring-2 ring-rose-400" : isTurn ? "bg-amber-400/15 ring-1 ring-amber-300/60" : "bg-black/35",
        self && "max-lg:order-first",
      )}
    >
      {/* My turn: a softly pulsing amber-red glow (static under reduced motion). */}
      {myTurn && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[1.1rem] shadow-[0_0_18px_4px_rgba(251,113,133,0.45)] ring-2 ring-amber-400/70 motion-safe:animate-pulse"
        />
      )}
      {myTurn && (
        <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2.5 py-0.5 text-[11px] font-black text-black shadow-lg">
          Lượt của bạn
        </span>
      )}
      <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2 short:mb-1">
        <span className="relative flex min-w-0 items-center gap-2">
          <SeatBubble reactions={reactions} />
          <SeatAvatar
            name={name}
            className="flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-full"
            fallbackClassName="bg-gradient-to-br from-violet-300 to-fuchsia-600 font-bold text-black"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate text-sm font-semibold">
              {seat?.isHost && <span title="Chủ bàn">👑</span>}
              <span className="truncate">{name}</span>
              {self && <span className="text-xs font-normal text-white/60">(bạn)</span>}
            </span>
            <span className="flex flex-wrap gap-1 text-[11px] text-white/60">
              {seat && !seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Mất kết nối</span>}
              {seat?.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Bị kích</span>}
              {/* Inline, so it never sits on the score. */}
              {onKick && (
                <ConfirmButton onConfirm={onKick} confirmLabel="Chắc chắn?" title="Kích người mất kết nối" className="rounded bg-rose-600 px-2 text-[11px] font-semibold text-white hover:bg-rose-500 max-sm:min-h-8 max-sm:px-2.5">
                  Kích
                </ConfirmButton>
              )}
              {seat && seat.games > 0 && <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")}>{signed(seat.points)}đ</span>}
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className="text-xl font-black leading-none text-amber-300 sm:block sm:text-2xl short:inline short:text-xl">{p.prestige}</span>
          <span className="text-[10px] text-white/50"> / {target} điểm</span>
        </span>
      </div>
      {/* Card bonuses and gems share one line when there is room (phones: one short panel per player). */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:gap-x-3">
        <div className="flex items-center gap-1" title="Thẻ đã mua (giảm giá vĩnh viễn)">
          <span className="text-[10px] text-white/50 max-sm:hidden">Thẻ</span>
          {GEMS.map((gem) => (
            <BonusPip key={gem} gem={gem} n={p.bonuses[gem]} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-white/50">Đá {tokenTotal}/10</span>
          {TOKENS.filter((t) => p.tokens[t]).map((t) => (
            <TokenChip key={t} gem={t} count={p.tokens[t]} size="sm" />
          ))}
        </div>
        {/* Other players' reserved cards and nobles stay on the same line. */}
        {!self && (p.reserved.length > 0 || p.nobles.length > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {p.reserved.map((c, i) =>
              c === null ? (
                <span key={i} className="flex h-7 w-5 items-center justify-center rounded bg-stone-700 text-[10px]" title="Thẻ đang giữ (úp)">
                  📌
                </span>
              ) : (
                <DevCardView key={c} id={c} size="sm" />
              ),
            )}
            {p.nobles.map((n) => (
              <NobleTile key={n} id={n} size="sm" />
            ))}
          </div>
        )}
      </div>
      {self && (p.reserved.length > 0 || p.nobles.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {self && mineReserved.length > 0 && (
            <DraggableRow
              items={reservedOrder.ordered}
              onMove={reservedOrder.move}
              className="gap-1"
              renderItem={(c) => <DevCardView id={c} size="sm" onClick={() => onReserved(c)} />}
            />
          )}
          {p.nobles.map((n) => (
            <NobleTile key={n} id={n} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function CardModal({
  focus,
  g,
  mine,
  myTurn,
  busy,
  canAfford,
  run,
  onClose,
}: {
  focus: { card?: number; tier?: 1 | 2 | 3; reserved?: boolean };
  g: SPGameView;
  mine: SPPlayerView | null;
  myTurn: boolean;
  busy: boolean;
  canAfford: (c: number) => boolean;
  run: Act;
  onClose: () => void;
}) {
  const canAct = myTurn && g.phase === "turn" && !!mine;
  const reserveFull = (mine?.reserved.length ?? 0) >= MAX_RESERVED;
  const done = (p: Promise<boolean>) => void p.then((ok) => ok && onClose());
  const plan = focus.card !== undefined && mine ? paymentPlan(focus.card, mine) : null;
  // B = Mua, G = Giữ — same guards as the two buttons below. Only this dialog is open, so the table's own keys are off.
  const canBuy = canAct && focus.card !== undefined && !busy && canAfford(focus.card);
  const canReserve = canAct && !focus.reserved && !busy && !reserveFull;
  useHotkeys(
    {
      b: canBuy ? () => done(run({ type: "buy", card: focus.card! })) : undefined,
      g: canReserve ? () => done(run(focus.card !== undefined ? { type: "reserve", card: focus.card } : { type: "reserve", tier: focus.tier! })) : undefined,
    },
    true,
    ["b", "g"],
  );
  return (
    <Modal onClose={onClose}>
      {/* Sideways phones: card on the left, cost and buttons beside it, so nothing needs scrolling. */}
      <div className="flex flex-col items-center gap-3 short:flex-row short:items-center short:gap-4">
        {focus.card !== undefined ? <DevCardView id={focus.card} size="lg" /> : <CardBack tier={focus.tier!} count={g.deckCounts[focus.tier! - 1]} />}
        <div className="flex w-full min-w-0 flex-col items-center gap-3 short:pr-5">
          {focus.card !== undefined && (
            <p className="text-center text-sm text-white/80">
              Thẻ <b>{GEM_NAMES[CARD_BY_ID[focus.card].bonus]}</b> · {CARD_BY_ID[focus.card].points} điểm · giảm vĩnh viễn 1 {GEM_NAMES[CARD_BY_ID[focus.card].bonus]} cho các lần mua sau
            </p>
          )}
          {plan && mine && <CostCompare plan={plan} gold={mine.tokens.gold} />}
          {canAct ? (
            <div className="flex flex-wrap justify-center gap-2">
              {focus.card !== undefined && (
                <button
                  onClick={() => done(run({ type: "buy", card: focus.card! }))}
                  disabled={busy || !canAfford(focus.card)}
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400 disabled:opacity-40"
                >
                  🛒 Mua
                  <Kbd>B</Kbd>
                </button>
              )}
              {!focus.reserved && (
                <button
                  onClick={() => done(run(focus.card !== undefined ? { type: "reserve", card: focus.card } : { type: "reserve", tier: focus.tier! }))}
                  disabled={busy || reserveFull}
                  className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 disabled:opacity-40"
                >
                  📌 Giữ {focus.card === undefined ? "1 thẻ úp" : ""} {g.bank.gold > 0 ? "+ 1 Vàng" : ""}
                  <Kbd>G</Kbd>
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/50">Mua hoặc giữ thẻ trong lượt của bạn.</p>
          )}
          {canAct && reserveFull && !focus.reserved && <p className="text-xs text-white/50">Bạn đã giữ đủ {MAX_RESERVED} thẻ.</p>}
        </div>
      </div>
    </Modal>
  );
}

/** Card cost vs what I have: top row = cost per colour, bottom row = my cards + tokens, with the shortfall. */
function CostCompare({ plan, gold }: { plan: ReturnType<typeof paymentPlan>; gold: number }) {
  const cols = plan.rows.length + (gold > 0 ? 1 : 0);
  return (
    <div className="w-full rounded-xl bg-black/35 p-3">
      <div className="grid items-center gap-x-2 gap-y-2 text-center" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}>
        <span className="text-left text-[11px] font-semibold uppercase tracking-wide text-white/55">Cần</span>
        {plan.rows.map((r) => (
          <span key={r.gem} className="flex justify-center">
            <GemCount gem={r.gem} n={r.cost} className="h-10 w-10 text-lg" />
          </span>
        ))}
        {gold > 0 && <span className="text-[11px] text-white/40">—</span>}

        <span className="text-left text-[11px] font-semibold uppercase tracking-wide text-white/55">Bạn có</span>
        {plan.rows.map((r) => (
          <span key={r.gem} className="flex flex-col items-center gap-0.5">
            <span className={cn("text-lg font-black leading-none", r.short ? "text-rose-300" : "text-emerald-300")}>{r.bonus + r.tokens}</span>
            <span className="text-[10px] leading-tight text-white/55">
              {r.bonus} thẻ + {r.tokens} đá
            </span>
            {r.short > 0 ? (
              <span className="rounded bg-rose-500/25 px-1.5 text-xs font-black text-rose-300">−{r.short}</span>
            ) : (
              <span className="text-xs font-bold text-emerald-400">✓</span>
            )}
          </span>
        ))}
        {gold > 0 && (
          <span className="flex flex-col items-center gap-0.5" title="Vàng thay được mọi màu">
            <span className="relative">
              <GemIcon gem="gold" className="h-8 w-8" />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-black/85 px-1 text-[11px] font-bold text-white">{gold}</span>
            </span>
            <span className="text-[10px] leading-tight text-amber-200/80">{plan.goldUsed ? `bù ${plan.goldUsed}` : "Vàng"}</span>
          </span>
        )}
      </div>
      <p className={cn("mt-3 rounded-lg px-3 py-1.5 text-center text-sm font-bold", plan.missing ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200")}>
        {plan.missing ? `Thiếu ${plan.missing} đá` : "Đủ để mua"}
        {plan.goldUsed > 0 && (
          <span className="ml-1 font-normal text-amber-200/90">{plan.missing ? `(đã tính ${plan.goldUsed} Vàng)` : `· dùng ${plan.goldUsed} Vàng`}</span>
        )}
      </p>
    </div>
  );
}

/** Return tokens down to 10: tap a gem you hold to put it in the "return" pile, tap it there to take it back. */
function DiscardPanel({ p, need, run, busy, secondsLeft }: { p: SPPlayerView; need: number; run: Act; busy: boolean; secondsLeft: number | null }) {
  const [give, setGive] = useState<Record<Token, number>>(emptyPick);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces: newer browsers return a Promise from scrollIntoView, which an effect must not return.
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const total = tokenSum(give);
  const left = need - total;
  const held = TOKENS.filter((t) => p.tokens[t] - give[t] > 0);
  const giving = TOKENS.filter((t) => give[t] > 0);
  const add = (t: Token) => setGive((g) => (tokenSum(g) >= need ? g : { ...g, [t]: Math.min(p.tokens[t], g[t] + 1) }));
  const remove = (t: Token) => setGive((g) => ({ ...g, [t]: Math.max(0, g[t] - 1) }));
  // Gem keys put one held gem in the return pile (like tapping it); Enter = the "Trả lại" button; Esc = "Chọn lại".
  const discardKeys: Record<string, (() => void) | undefined> = {};
  for (const t of TOKENS) discardKeys[GEM_KEYS[t]] = left > 0 && held.includes(t) ? () => add(t) : undefined;
  useHotkeys({
    ...discardKeys,
    Enter: !busy && left === 0 ? () => void run({ type: "discard", tokens: give }) : undefined,
    Escape: total > 0 ? () => setGive(emptyPick()) : undefined,
  });
  return (
    <div ref={ref} className="rounded-2xl bg-rose-500/15 p-3 ring-2 ring-rose-400/60">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-rose-100">
          Trả lại {need} viên đá (bạn đang có {tokenSum(p.tokens)}/{MAX_TOKENS})
        </p>
        {secondsLeft !== null && <span className={cn("font-mono text-xs", secondsLeft <= 8 ? "text-rose-300" : "text-white/60")}>⏱ {secondsLeft}s</span>}
      </div>
      <p className="mb-1 text-xs text-white/65">Bấm vào đá bạn muốn trả:</p>
      <div className="flex min-h-12 flex-wrap gap-3">
        {held.map((t) => (
          <TokenChip
            key={t}
            gem={t}
            count={p.tokens[t] - give[t]}
            dimmed={left === 0}
            onClick={left > 0 ? () => add(t) : undefined}
            hotkey={left > 0 ? GEM_KEYS[t].toUpperCase() : undefined}
            title={`Trả 1 ${GEM_NAMES[t]}`}
          />
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-dashed border-rose-300/40 bg-black/25 p-2">
        <p className="mb-1 text-xs text-white/65">
          Sẽ trả ({total}/{need}){giving.length > 0 && " — bấm để lấy lại"}:
        </p>
        <div className="flex min-h-11 flex-wrap items-center gap-3">
          {giving.length ? (
            giving.map((t) => <TokenChip key={t} gem={t} count={give[t]} onClick={() => remove(t)} title={`Giữ lại 1 ${GEM_NAMES[t]}`} />)
          ) : (
            <span className="text-xs text-white/40">Chưa chọn viên nào</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void run({ type: "discard", tokens: give })}
          disabled={busy || left !== 0}
          className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 disabled:opacity-40"
        >
          {left > 0 ? `Chọn thêm ${left} viên` : `Trả lại ${need} viên`}
          {left === 0 && <Kbd>Enter</Kbd>}
        </button>
        {total > 0 && (
          <button onClick={() => setGive(emptyPick())} className="rounded-lg border border-white/25 px-3 py-2 text-sm hover:bg-white/10">
            Chọn lại
            <Kbd>Esc</Kbd>
          </button>
        )}
      </div>
      <p className="mt-2 hidden text-[11px] text-white/50 lg:block [@media(pointer:coarse)]:hidden">Phím tắt: W / U / G / R / K / V = trả 1 đá trắng / lam / lục / đỏ / đen / vàng · Enter = trả lại · Esc = chọn lại.</p>
    </div>
  );
}

function Waiting({ view, me, act, nameOf }: { view: SPRoomView; me: SPSeatView | null; act: Act; nameOf: (id: string) => string }) {
  const g = view.current;
  const count = view.seats.filter(Boolean).length;
  const ended = g?.status === "ended";
  const last = view.history[view.history.length - 1];
  const isHost = !!me?.isHost && view.role === "player";
  const s = view.settings;
  return (
    <div className="w-full max-w-md rounded-3xl border border-amber-200/15 bg-black/45 p-5 backdrop-blur">
      {ended && g ? (
        <>
          <h2 className="mb-2 text-xl font-black text-amber-300">🏆 {nameOf(g.finished[0])} thắng!</h2>
          <ol className="mb-4 space-y-1 text-sm">
            {g.finished.map((id, i) => {
              const p = g.players.find((x) => x.id === id);
              const d = last?.results.find((r) => r.id === id)?.delta;
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span>
                    <b className="mr-2 text-amber-300">#{i + 1}</b>
                    {nameOf(id)}
                    {id === view.meId && " (bạn)"}
                    {p && <span className="ml-2 text-white/60">{p.prestige} điểm · {p.owned.length} thẻ</span>}
                  </span>
                  {d !== undefined && <DeltaBadge delta={d} />}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-xl font-black text-amber-300">💎 Đá Quý</h2>
          <p className="mb-3 text-sm text-violet-100/80">{count}/4 người · gửi link mời để bạn bè vào bàn</p>
        </>
      )}
      {/* Who is at the table (there are no player panels between games). */}
      <ul className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {view.seats
          .filter((x): x is SPSeatView => !!x)
          .map((x) => (
            <li key={x.id} className={cn("flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-0.5 pr-2.5", !x.connected && "opacity-50")}>
              <SeatAvatar
                name={x.name}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                fallbackClassName="bg-gradient-to-br from-violet-300 to-fuchsia-600 font-bold text-black"
              />
              {x.isHost && <span title="Chủ bàn">👑</span>}
              <span className="max-w-[9rem] truncate">{x.name}</span>
              {x.id === view.meId && <span className="text-xs text-white/50">(bạn)</span>}
            </li>
          ))}
      </ul>
      <div className="mb-4 space-y-2 rounded-xl bg-white/5 p-3 text-xs">
        <p className="font-semibold uppercase tracking-wide text-violet-100/60">Luật bàn</p>
        <label className="flex items-center justify-between gap-2">
          <span>Điểm uy tín để thắng</span>
          <select value={s.target} disabled={!isHost} onChange={(e) => void act({ type: "settings", target: Number(e.target.value) })} className="min-h-8 rounded bg-black/40 px-1.5 py-0.5 max-sm:min-h-9">
            {TARGET_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} điểm
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>Thời gian mỗi lượt</span>
          <select value={s.turnSeconds} disabled={!isHost} onChange={(e) => void act({ type: "settings", turnSeconds: Number(e.target.value) })} className="min-h-8 rounded bg-black/40 px-1.5 py-0.5 max-sm:min-h-9">
            {TURN_SECONDS_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} giây
              </option>
            ))}
          </select>
        </label>
        <RankPointsPicker first={s.first} second={s.second} players={count} editable={isHost} onChange={(v) => void act({ type: "settings", ...v })} className="[&_select]:min-h-8 max-sm:[&_select]:min-h-9" />
        {!isHost && <p className="text-white/40">Chỉ chủ bàn đổi được luật.</p>}
      </div>
      {isHost ? (
        <button
          onClick={() => void act({ type: "start" })}
          disabled={count < 2}
          className="w-full rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 disabled:opacity-40"
        >
          {count < 2 ? "Cần ít nhất 2 người" : ended ? "Ván mới" : "Bắt đầu"}
        </button>
      ) : (
        <p className="text-sm text-violet-100/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
      )}
    </div>
  );
}

export function SplendorRules() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>2–4 người buôn đá quý. Mỗi lượt chọn đúng <b>1</b> việc:</li>
      <li>
        <b>Lấy đá:</b> 3 viên khác màu, hoặc 2 viên cùng màu (khi đống đó còn ít nhất 4 viên). Bấm vào đá ở ngân hàng để chọn, bấm lần 2 để lấy 2 viên.
      </li>
      <li>
        <b>Giữ thẻ:</b> lấy 1 thẻ đang ngửa (hoặc 1 thẻ úp từ chồng bài) vào tay, kèm 1 Vàng nếu còn. Giữ tối đa 3 thẻ.
      </li>
      <li>
        <b>Mua thẻ:</b> trả đá theo giá (Vàng thay được mọi màu). Mỗi thẻ đã mua giảm vĩnh viễn 1 viên màu đó cho các lần mua sau, và nhiều thẻ có điểm uy tín.
      </li>
      <li>Giữ tối đa 10 viên đá; dư thì phải trả lại.</li>
      <li>Có đủ số thẻ theo yêu cầu của một Quý tộc thì họ tự đến thăm cuối lượt (+3 điểm).</li>
      <li>Khi có người đạt số điểm thắng (mặc định 15), chơi nốt vòng đó cho đều lượt. Nhiều điểm nhất thắng; bằng điểm thì ai ít thẻ hơn thắng.</li>
    </ul>
  );
}

/**
 * Dialog (same behaviour as Cờ Tỷ Phú's): a bottom sheet on phones with a full-width "Đóng" bar,
 * centred from `sm` up; the ✕ stays put while the content scrolls; Esc and the backdrop close it.
 */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#1b1030] text-violet-50 shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl short:max-h-[94dvh] short:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-lg leading-none text-white shadow hover:bg-white/20"
          aria-label="Đóng"
        >
          ✕
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 short:p-4 [&>h2:first-child]:pr-10">{children}</div>
        <button
          onClick={onClose}
          className="shrink-0 border-t border-white/10 bg-black/20 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold text-violet-100 sm:hidden"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
