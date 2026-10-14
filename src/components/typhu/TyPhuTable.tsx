"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { createContext, memo, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import NumberFlow from "@number-flow/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { toast as showToast } from "sonner";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { useGameRoom } from "@/components/games/gameClient";
import { PinchZoom } from "@/components/games/PinchZoom";
import { useHotkeys } from "@/components/games/useHotkeys";
import { SeatBubble, SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { DeltaBadge, ScoreboardModal, signed } from "@/components/tienlen/Scoreboard";
import {
  AIR_RENT,
  BOARD as STD_BOARD,
  GROUP_COLORS,
  MAP_LABEL,
  MAP_SIZES,
  type MapSize,
  boardOf,
  type Group,
  JAIL_FINE,
  MAX_HOUSES,
  type Ownable,
  START_CASH_OPTIONS,
  type Square,
  TIME_LIMIT_OPTIONS,
  UTIL_MULT,
  GO_SALARY,
  GO_SALARY_OPTIONS,
  LAND_SALE_OPTIONS,
  UNMORTGAGE_FEE_OPTIONS,
  groupPositions as groupPositionsIn,
  houseCost,
  houseRefund,
  isOwnable,
  landSaleValue,
  mortgageValue,
  unmortgageCost,
} from "@/lib/typhu/board";
import { SettingsTabs } from "@/components/games/SettingsTabs";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import { type Deed, LOAN_RATES, LOAN_TURNS, PIECE_COLORS, PIECE_EMOJIS, STEP_SECONDS_OPTIONS, TYPHU_WS_PATH, type TPGameView, type TPPlayerView, type TPRoomView, type TPSeatView, type TPSettings, type TradeSide } from "@/lib/typhu/protocol";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { MyTurnBadge, TurnRing } from "@/components/games/TurnIndicator";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { WinCelebration } from "@/components/games/WinCelebration";

const SCORE_NOTE =
  "Điểm theo thứ hạng: người còn trụ lại (hoặc giàu nhất khi hết giờ) Nhất, ai phá sản trước xếp sau. Chủ bàn chọn điểm Nhất / Nhì, các hạng cuối trừ tương ứng, tổng mỗi ván luôn bằng 0.";

/** A seat's token. A server from before token picking sends no `piece`: fall back to the starting token of the seat. */
export const pieceOfSeat = (seat: TPSeatView) => seat.piece ?? TOKENS[seat.color % TOKENS.length];

export const TOKENS = [
  { emoji: "🛵", color: "#ef4444" },
  { emoji: "🐃", color: "#3b82f6" },
  { emoji: "🚲", color: "#22c55e" },
  { emoji: "🚤", color: "#eab308" },
  { emoji: "🐉", color: "#a855f7" },
  { emoji: "🎩", color: "#f97316" },
];

/** Illustrated icons (public/games/typhu/icons/<name>.webp) for the special squares; the emoji stay as a fallback. */
const SQUARE_IMG: Partial<Record<Square["kind"], string>> = {
  go: "go",
  air: "air",
  chance: "chance",
  chest: "chest",
  tax: "tax",
  jail: "jail",
  parking: "parking",
  gotojail: "gotojail",
};

/** The picture for a square kind (utilities pick Điện / Nước by name), or null when it has none. */
const squareImg = (sq: Square): string | null => (sq.kind === "util" ? (sq.name.includes("Điện") ? "electric" : "water") : SQUARE_IMG[sq.kind] ?? null);

function ArtIcon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/games/typhu/icons/${name}.webp`} alt="" draggable={false} className={cn("inline-block shrink-0 object-contain", className)} />;
}


export const money = (n: number) => `${n.toLocaleString("vi-VN")}tr`;

type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

/** Shift server-clock deadlines onto the local clock. */
function localize(view: TPRoomView): TPRoomView {
  const g = view.current;
  if (!g) return view;
  const skew = Date.now() - view.serverTime;
  const shift = (t: number | null) => (t ? t + skew : t);
  return {
    ...view,
    current: {
      ...g,
      deadline: shift(g.deadline),
      endsAt: shift(g.endsAt),
      trade: g.trade ? { ...g.trade, deadline: g.trade.deadline + skew } : null,
      loan: g.loan ? { ...g.loan, deadline: g.loan.deadline + skew } : null,
    },
  };
}

/**
 * The clock lives in a context so that only the few components showing a countdown re-render every 500 ms —
 * not the whole table (board cells, player rows, panels). The provider renders its `children` prop, so React
 * skips them while only the context value changes.
 */
const NowContext = createContext(0);

function NowProvider({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <NowContext.Provider value={useNow(active)}>{children}</NowContext.Provider>;
}

/** Whole seconds until `t` (a server-clock deadline already shifted to the local clock), re-evaluated every tick. */
function useSecondsLeft() {
  const now = useContext(NowContext);
  return (t: number | null | undefined) => (t ? Math.max(0, Math.ceil((t - now) / 1000)) : null);
}

function NowClock({ endsAt }: { endsAt: number }) {
  const now = useContext(NowContext);
  return <>{formatClock(endsAt - now)}</>;
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

/**
 * The squares of the table's map. The server picks the map per game (40 / 48 / 56 squares), so this is
 * switched by the table component before it renders its children; every helper below reads it.
 */
let BOARD: Square[] = STD_BOARD;
const groupPositions = (group: Group) => groupPositionsIn(group, BOARD);

/**
 * The squares a token visits between two positions: forward one square at a time, or a few
 * squares back for "lùi 3 ô" cards. Entering jail walks to the Vào tù square first when the
 * dice put the player there, then jumps to the jail.
 */
function walkPath(from: number, to: number, enteredJail: boolean, dice: [number, number] | null): number[] {
  const BOARD_SIZE = BOARD.length;
  const GO_TO_JAIL_POS = BOARD.findIndex((q) => q.kind === "gotojail");
  const forward = (a: number, b: number) => {
    const steps: number[] = [];
    for (let p = a; p !== b; ) steps.push((p = (p + 1) % BOARD_SIZE));
    return steps;
  };
  if (enteredJail) {
    const landed = dice ? (from + dice[0] + dice[1]) % BOARD_SIZE : -1;
    return landed === GO_TO_JAIL_POS ? [...forward(from, GO_TO_JAIL_POS), to] : [to];
  }
  const ahead = (to - from + BOARD_SIZE) % BOARD_SIZE;
  if (BOARD_SIZE - ahead <= 3) return Array.from({ length: BOARD_SIZE - ahead }, (_, i) => (from - i - 1 + BOARD_SIZE) % BOARD_SIZE);
  return forward(from, to);
}

/**
 * Where each token is drawn. The server jumps a player straight to their new square; here the
 * token walks there square by square (faster for long card moves) so everyone can follow it.
 */
function useWalkingTokens(g: TPGameView | null) {
  const players = g?.players ?? [];
  const [shown, setShown] = useState<Record<string, number>>(() => Object.fromEntries(players.map((p) => [p.id, p.pos])));
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const jailRef = useRef<Record<string, number>>(Object.fromEntries(players.map((p) => [p.id, p.jail])));
  const dice = g?.dice ?? null;
  const key = players.map((p) => `${p.id}:${p.pos}:${p.jail}`).join("|");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // A new game puts everyone back on Khởi hành: no walk.
    const reset = players.length > 0 && players.every((p) => p.pos === 0) && players.some((p) => (shownRef.current[p.id] ?? 0) !== 0);
    for (const p of players) {
      const from = shownRef.current[p.id];
      const wasJailed = (jailRef.current[p.id] ?? 0) > 0;
      jailRef.current[p.id] = p.jail;
      if (from === p.pos) continue;
      if (from === undefined || reset) {
        setShown((m) => ({ ...m, [p.id]: p.pos }));
        continue;
      }
      const path = walkPath(from, p.pos, !wasJailed && p.jail > 0, dice);
      const step = Math.max(60, Math.min(220, 2600 / path.length));
      path.forEach((pos, i) => timers.push(setTimeout(() => setShown((m) => ({ ...m, [p.id]: pos })), step * (i + 1))));
    }
    return () => timers.forEach(clearTimeout);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (id: string, fallback: number) => shown[id] ?? fallback;
}

/** Grid cell (1-based row/col) of a board position, Khởi hành bottom-right; the ring has `side` squares per edge. */
function cellOf(i: number, side: number): { row: number; col: number; side: "bottom" | "left" | "top" | "right" | "corner" } {
  const last = side + 1;
  if (i % side === 0) {
    const corners = [
      { row: last, col: last },
      { row: last, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: last },
    ];
    return { ...corners[i / side], side: "corner" };
  }
  if (i < side) return { row: last, col: last - i, side: "bottom" };
  if (i < 2 * side) return { row: last - (i - side), col: 1, side: "left" };
  if (i < 3 * side) return { row: 1, col: 1 + (i - 2 * side), side: "top" };
  return { row: 1 + (i - 3 * side), col: last, side: "right" };
}

export default function TyPhuTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, call } = useGameRoom<TPRoomView>(TYPHU_WS_PATH, code, name, watch ? "watch" : "play", localize);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    showToast.error(toast);
    setToast(null);
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
    const full = error?.includes("đủ");
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-lg text-rose-300">{error}</p>
        <div className="mt-4 flex gap-2">
          {full && (
            <Link href={`/co-ty-phu/${code}?watch=1`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black">
              Vào xem 👀
            </Link>
          )}
          <Link href="/co-ty-phu" className="rounded-lg border border-white/25 px-4 py-2 font-semibold">
            Về sảnh
          </Link>
        </div>
      </div>
    );
  }
  if (!view) {
    return <p className="flex min-h-[70vh] animate-pulse items-center justify-center text-sky-100/80">Đang kết nối bàn {code}…</p>;
  }
  return (
    <>
      <Table view={view} reconnecting={status === "reconnecting"} act={act} />
      <ChatBox messages={view.chat} meId={view.meId} myName={name} onSend={(text) => act({ type: "chat", text })} onEmoji={(emoji) => void act({ type: "emoji", emoji })} row />
    </>
  );
}

function Table(props: { view: TPRoomView; reconnecting: boolean; act: Act }) {
  return (
    <NowProvider active={props.view.current?.status === "playing"}>
      <TableBody {...props} />
    </NowProvider>
  );
}

function TableBody({ view, reconnecting, act }: { view: TPRoomView; reconnecting: boolean; act: Act }) {
  const g = view.current;
  // A finished game keeps its own map (the room settings may already point at another one for the next game).
  BOARD = boardOf(g ? g.map ?? "std" : view.settings.map);
  const playing = g?.status === "playing";
  const spectator = view.role === "spectator";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const mine = g?.players.find((p) => p.id === view.meId) ?? null;
  const myTurn = !!mine && playing && !mine.bankrupt && g?.turn === view.meId;

  const seatOf = (id: string) => view.seats.find((s) => s?.id === id) ?? null;
  const nameOf = (id: string) =>
    seatOf(id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";
  const tokenOf = (id: string) => {
    const seat = seatOf(id);
    return seat ? pieceOfSeat(seat) : TOKENS[(g?.players.findIndex((p) => p.id === id) ?? 0) % TOKENS.length];
  };

  const shownPos = useWalkingTokens(g);
  // Who stands on each square right now (walking animation included): the cells only get what they draw.
  const hereByPos = new Map<number, CellToken[]>();
  for (const p of g?.players ?? []) {
    if (p.bankrupt) continue;
    const pos = shownPos(p.id, p.pos);
    const list = hereByPos.get(pos) ?? [];
    list.push({ id: p.id, ...tokenOf(p.id), turn: g?.turn === p.id });
    hereByPos.set(pos, list);
  }
  const [openSquare, setOpenSquare] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showLog, setShowLog] = useState(false);
  useHotkeys({ l: g ? () => setShowLog((v) => !v) : undefined }, true, ["l"]);
  const [showRules, setShowRules] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [busy, setBusy] = useState(false);
  const inDebt = myTurn && g?.phase === "debt" && !!g.debt;
  // The assets panel sits in the side column (below the board on phones) so it never covers the board;
  // it opens by itself while I'm in debt.
  const assetsOpen = !!mine && myTurn && (showAssets || inDebt);
  const assetsRef = useRef<HTMLDivElement>(null);
  const openAssets = () => {
    setShowAssets(true);
    // Below the board on phones: bring it into view.
    requestAnimationFrame(() => assetsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  useEffect(() => {
    if (!myTurn) setShowAssets(false);
  }, [myTurn]);

  const run = async (msg: Record<string, unknown> & { type: string }) => {
    setBusy(true);
    const ok = await act(msg);
    setBusy(false);
    return ok;
  };

  // Card reveal overlay whenever a new Cơ hội / Khí vận card is drawn.
  const [cardFx, setCardFx] = useState<TPGameView["lastCard"]>(null);
  // Start from the card already on the table when the page opens, so only new draws pop up.
  const lastCardAt = useRef(g?.lastCard?.at ?? 0);
  const drawnAt = g?.lastCard?.at;
  useEffect(() => {
    const c = g?.lastCard;
    if (!c || c.at === lastCardAt.current) return;
    lastCardAt.current = c.at;
    setCardFx(c);
  }, [drawnAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auto-hide on its own timer, so later state updates don't cancel it.
  useEffect(() => {
    if (!cardFx) return;
    const t = setTimeout(() => setCardFx(null), 3500);
    return () => clearTimeout(t);
  }, [cardFx]);

  const [playersRef] = useAutoAnimate<HTMLUListElement>({ duration: 160 });
  const [loansRef] = useAutoAnimate<HTMLUListElement>({ duration: 160 });
  // An offer addressed to me pops a toast (the card itself sits in the board centre, which may be off-screen on a phone).
  // The key must not contain the deadline: `localize` shifts it on every state update, which would toast again each time.
  const offerKey = g?.trade?.to === view.meId ? `t:${g.trade.from}:${JSON.stringify(g.trade.give)}:${JSON.stringify(g.trade.get)}` : g?.loan?.to === view.meId ? `l:${g.loan.from}:${g.loan.amount}:${g.loan.rate}` : "";
  useEffect(() => {
    if (!offerKey) return;
    const loan = offerKey.startsWith("l");
    showToast(loan ? "🏦 Có lời xin vay tiền gửi cho bạn" : "🤝 Có lời mời đổi đất gửi cho bạn", { id: "typhu-offer", description: "Xem thẻ ở giữa bàn cờ" });
  }, [offerKey]);

  // "Just built" banner, driven by the 🏠 lines in the log.
  const [buildFx, setBuildFx] = useState<{ id: number; text: string; hotel: boolean } | null>(null);
  const lastBuildId = useRef(g?.log.filter((e) => e.text.startsWith("🏠")).at(-1)?.id ?? 0);
  const latestBuild = g?.log.filter((e) => e.text.startsWith("🏠")).at(-1);
  useEffect(() => {
    if (!latestBuild || latestBuild.id <= lastBuildId.current) return;
    lastBuildId.current = latestBuild.id;
    setBuildFx({ id: latestBuild.id, text: latestBuild.text.replace(/^🏠\s*/, ""), hotel: latestBuild.text.includes("khách sạn") });
  }, [latestBuild?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!buildFx) return;
    const t = setTimeout(() => setBuildFx(null), 2200);
    return () => clearTimeout(t);
  }, [buildFx]);

  // "Phá sản!" effect whenever a player goes bankrupt (players already out when the page opened don't replay it).
  const [bankruptFx, setBankruptFx] = useState<{ id: string; name: string; me: boolean; at: number } | null>(null);
  const outRef = useRef<Set<string> | null>(null);
  const outKey = g?.players.filter((p) => p.bankrupt).map((p) => p.id).join(",") ?? "";
  useEffect(() => {
    const now = new Set(outKey ? outKey.split(",") : []);
    const prev = outRef.current;
    outRef.current = now;
    if (!prev) return;
    const fresh = [...now].find((id) => !prev.has(id));
    if (fresh) setBankruptFx({ id: fresh, name: nameOf(fresh), me: fresh === view.meId, at: Date.now() });
  }, [outKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!bankruptFx) return;
    const t = setTimeout(() => setBankruptFx(null), 3200);
    return () => clearTimeout(t);
  }, [bankruptFx]);

  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string): Reaction[] => live.filter((r) => r.playerId === id);

  // The Kích button asks for a second tap itself (ConfirmButton) — window.confirm is blocked in some in-app browsers.
  const kick = async (s: TPSeatView) => {
    await act({ type: "kick", playerId: s.id });
  };

  const [copied, setCopied] = useState(false);
  const copyInvite = async () => {
    const url = new URL(`/co-ty-phu/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };


  return (
    <div className="relative isolate mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-3 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] xl:max-w-none pt-2 sm:px-4 sm:pt-3 short:gap-2 short:pt-1.5">
      {/* Whole-screen backdrop: the board-centre picture, blurred and cropped to cover the screen (its longest side fits). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0b1d3a]">
        <div className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl" style={{ backgroundImage: "url(/games/typhu/center.webp)" }} />
        <div className="absolute inset-0 bg-black/55" />
      </div>
      <GameHeader
        primary={
          <>
            <Link href="/co-ty-phu" className={headerBtn}>
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
            {g && (
              <button onClick={() => setShowLog(true)} className={headerBtn} title="Toàn bộ diễn biến ván">
                📜 <HeaderLabel>Diễn biến</HeaderLabel>
              </button>
            )}
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
            {g?.endsAt && playing && (
              <span className="whitespace-nowrap font-mono" title="Hết giờ thì người giàu nhất thắng">
                ⏰ <NowClock endsAt={g.endsAt} />
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

      {spectator && (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-sky-100/80">
          <span>👀 Bạn đang xem với tư cách khán giả</span>
          {view.seats.some((s) => s === null) && !playing && (
            <Link href={`/co-ty-phu/${view.code}`} className="rounded-md bg-amber-400 px-3 py-1 font-semibold text-black">
              Vào chơi
            </Link>
          )}
        </div>
      )}

      {/* Sideways phone: board as tall as the screen allows on the left, the side panel scrolling on the right. */}
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,calc(100dvh-5rem))_20rem] lg:justify-center lg:gap-4 xl:grid-cols-[minmax(0,calc(100dvh-5rem))_22rem] short:grid-cols-[auto_minmax(0,1fr)] short:items-start short:gap-2">
        {/* Board */}
        <div className="relative mx-auto w-full max-w-[min(100%,calc(100dvh-7rem))] lg:max-w-none short:w-[calc(100dvh-3.75rem)] short:max-w-none">
          <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
          <PinchZoom className="rounded-xl shadow-2xl">
          <div
            className="grid aspect-square w-full gap-[2px] rounded-xl border-4 border-[#1e3a2f] bg-[#1e3a2f] shadow-2xl"
            style={{ gridTemplateColumns: `1.6fr repeat(${BOARD.length / 4 - 1}, 1fr) 1.6fr`, gridTemplateRows: `1.6fr repeat(${BOARD.length / 4 - 1}, 1fr) 1.6fr` }}
          >
            {BOARD.map((sq, i) => {
              const here = hereByPos.get(i);
              const deed = g?.deeds[i];
              return (
                <Cell
                  key={i}
                  index={i}
                  edge={BOARD.length / 4}
                  sq={sq}
                  deed={deed}
                  pot={sq.kind === "parking" ? g?.pot ?? 0 : 0}
                  owner={deed ? tokenOf(deed.owner) : null}
                  here={here ?? NO_TOKENS}
                  highlight={!!here?.some((t) => t.turn)}
                  onOpen={setOpenSquare}
                />
              );
            })}
            {/* Centre */}
            <div className="relative flex flex-col items-center justify-center-safe gap-2 overflow-y-auto overflow-x-hidden bg-[#0b1d3a] bg-cover bg-center p-[5%] text-emerald-950 short:gap-1 short:p-[3%]" style={{ gridColumn: `2 / ${BOARD.length / 4 + 1}`, gridRow: `2 / ${BOARD.length / 4 + 1}`, backgroundImage: "url(/games/typhu/center.webp)" }}>
              <CardOverlay card={cardFx} nameOf={nameOf} onClose={() => setCardFx(null)} />
              <BuildOverlay fx={buildFx} />
              <BankruptOverlay fx={bankruptFx} />
              <div className="flex max-h-full min-h-0 w-full max-w-md flex-none flex-col items-center justify-center-safe gap-2 overflow-y-auto rounded-[1.5rem] bg-[#dff1e5]/85 p-2 shadow-xl ring-1 ring-amber-300/50 sm:p-4 short:gap-1 short:p-1.5">
              {!g || g.status === "ended" ? (
                <Waiting view={view} me={me} act={act} nameOf={nameOf} />
              ) : (
                <Centre
                  g={g}
                  view={view}
                  myTurn={myTurn}
                  mine={mine}
                  busy={busy}
                  run={run}
                  nameOf={nameOf}
                  assetsOpen={assetsOpen}
                  onOpenAssets={openAssets}
                  onTrade={() => setShowTrade(true)}
                  onLoan={() => setShowLoan(true)}
                />
              )}
              </div>
            </div>
          </div>
          </PinchZoom>
        </div>

        {/* Side panel */}
        {/* Bottom padding below lg: lets the log scroll clear of the floating chat / emoji buttons. */}
        <aside className="flex flex-col gap-3 max-lg:pb-14 short:max-h-[calc(100dvh-3.75rem)] short:gap-2 short:overflow-y-auto">
          {assetsOpen && g && mine && (
            <div ref={assetsRef} className="scroll-mt-2">
              <AssetPanel
                g={g}
                mine={mine}
                settings={view.settings}
                busy={busy}
                run={run}
                deadline={g.deadline}
                onClose={inDebt ? undefined : () => setShowAssets(false)}
              />
            </div>
          )}
          {(!g || g.status === "ended") && (
            <div className="hidden rounded-2xl bg-[#f4efe1] p-3 text-sm text-emerald-950 shadow-xl max-sm:block short:block short:p-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900/60">⚙️ Luật bàn</p>
              <TableSettings view={view} isHost={!!me?.isHost && view.role === "player"} act={act} />
            </div>
          )}
          <div className="rounded-2xl bg-black/35 p-3 short:p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-100/60">Người chơi</p>
            <ul ref={playersRef} className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {view.seats
                .filter((s): s is TPSeatView => !!s)
                .map((s) => {
                  const p = g?.players.find((x) => x.id === s.id);
                  return (
                    <PlayerRow
                      key={s.id}
                      seat={s}
                      p={p ?? null}
                      g={g}
                      self={s.id === view.meId}
                      token={tokenOf(s.id)}
                      isTurn={g?.turn === s.id && playing}
                      reactions={reactionsFor(s.id)}
                      onOpen={setOpenSquare}
                      onPick={s.id === view.meId ? () => setPicking(true) : undefined}
                      onKick={me?.isHost && !s.connected && !s.kicked ? () => void kick(s) : undefined}
                    />
                  );
                })}
            </ul>
          </div>

          {g && !!g.loans?.length && (
            <div className="rounded-2xl bg-black/35 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-100/60">🏦 Khoản vay</p>
              <ul ref={loansRef} className="space-y-1 text-xs">
                {g.loans.map((l) => (
                  <li key={l.id} className={cn("rounded bg-white/5 px-2 py-1", l.borrower === view.meId && "ring-1 ring-rose-300/60")}>
                    <b>{nameOf(l.borrower)}</b> nợ <b>{nameOf(l.lender)}</b> <b className="text-amber-200">{money(l.owed)}</b>
                    <span className="text-white/50"> (gốc {money(l.amount)} + {l.rate}%) · còn {l.left} lượt</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {g && (
            <div className="rounded-2xl bg-black/35 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-100/60">Diễn biến</p>
                <button onClick={() => setShowLog(true)} className="rounded px-1.5 py-0.5 text-[11px] text-sky-200 hover:bg-white/10 max-sm:min-h-8">
                  Xem toàn bộ ({g.log.length}) ↗
                </button>
              </div>
              <LogList log={g.log} className="max-h-64" />
            </div>
          )}

        </aside>
      </div>

      {picking && me && <PiecePicker seats={view.seats} meId={view.meId} act={act} onClose={() => setPicking(false)} />}

      {openSquare !== null && (
        <SquareModal
          pos={openSquare}
          g={g}
          settings={view.settings}
          meId={view.meId}
          myTurn={myTurn}
          nameOf={nameOf}
          run={run}
          busy={busy}
          onClose={() => setOpenSquare(null)}
        />
      )}
      {showLoan && g && <LoanModal g={g} meId={view.meId} nameOf={nameOf} run={run} onClose={() => setShowLoan(false)} />}
      {showTrade && g && <TradeModal g={g} meId={view.meId} nameOf={nameOf} run={run} onClose={() => setShowTrade(false)} />}
      {showLog && g && <LogModal log={g.log} onClose={() => setShowLog(false)} />}
      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={SCORE_NOTE} />}
      <WinCelebration show={g?.status === "ended"} playing={!!playing} won={!!view.meId && g?.finished[0] === view.meId} title={g?.status === "ended" ? `🏆 ${nameOf(g.finished[0])} thắng` : undefined} />
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

const formatClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// ─── Board cells ────────────────────────────────────────────────────

/** A little house or hotel (illustrated icons, public/games/typhu/icons/{house,hotel}.webp). */
function Building({ hotel, className }: { hotel?: boolean; className?: string }) {
  return <ArtIcon name={hotel ? "hotel" : "house"} className={cn("drop-shadow-sm", className)} />;
}

/** Burst over a cell the moment a house / hotel is built there: flash, expanding ring and flying sparks (gold and bigger for a hotel). */
function BuildBurst({ count }: { count: number }) {
  const prev = useRef(count);
  const [burst, setBurst] = useState<{ key: number; hotel: boolean } | null>(null);
  useEffect(() => {
    const grew = count > prev.current;
    prev.current = count;
    if (!grew) return;
    setBurst({ key: Date.now(), hotel: count === MAX_HOUSES });
    const t = setTimeout(() => setBurst(null), 1100);
    return () => clearTimeout(t);
  }, [count]);
  if (!burst) return null;
  const n = burst.hotel ? 12 : 8;
  const color = burst.hotel ? "#fbbf24" : "#ffffff";
  return (
    <span key={burst.key} className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <motion.span className="absolute inset-0" style={{ background: color }} initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
      <motion.span
        className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ borderColor: color }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: burst.hotel ? 2.6 : 1.8, opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2;
        const dist = (burst.hotel ? 120 : 90) * (i % 2 ? 1 : 0.65);
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 size-[5px] rounded-full"
            style={{ background: i % 3 === 0 ? "#fbbf24" : "#ffffff", boxShadow: "0 0 4px rgba(0,0,0,.5)" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist * 0.28, y: Math.sin(angle) * dist * 0.28, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
}

/** Houses on a colour band; the newest one pops in when built. */
function Buildings({ count, vertical }: { count: number; vertical: boolean }) {
  // Only buildings added after the page opened get the pop-in.
  const initialCount = useRef(count);
  if (count <= 0) return null;
  const hotel = count === MAX_HOUSES;
  return (
    <span className={cn("flex h-full w-full items-center justify-center gap-[1px] p-[1px]", vertical && "flex-col")}>
      {(hotel ? [0] : Array.from({ length: count }, (_, i) => i)).map((i) => (
        <motion.span
          key={`${hotel ? "hotel" : "house"}-${i}`}
          initial={i < initialCount.current && (!hotel || initialCount.current === MAX_HOUSES) ? false : { scale: 0, y: -8 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 14 }}
          className={cn("flex items-center justify-center drop-shadow", vertical ? "w-full" : "h-full", hotel ? (vertical ? "h-[70%]" : "w-[70%]") : vertical ? "h-[30%]" : "w-[30%]")}
        >
          <Building hotel={hotel} className="h-full w-full [filter:drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)_drop-shadow(0_1px_0_#fff)_drop-shadow(0_-1px_0_#fff)]" />
        </motion.span>
      ))}
    </span>
  );
}

interface CellToken {
  id: string;
  emoji: string;
  color: string;
  turn: boolean;
}
const NO_TOKENS: CellToken[] = [];

/** Everything a square draws — the memo below compares these fields, not object identities (every server update brings fresh objects). */
interface CellProps {
  index: number;
  /** Squares per edge of the current map (the grid position depends on it). */
  edge: number;
  sq: Square;
  deed: Deed | undefined;
  /** Nghỉ chân's pot (0 elsewhere). */
  pot: number;
  owner: { emoji: string; color: string } | null;
  here: CellToken[];
  highlight: boolean;
  onOpen: (pos: number) => void;
}

const sameCell = (a: CellProps, b: CellProps) =>
  a.index === b.index &&
  a.edge === b.edge &&
  a.sq === b.sq &&
  a.pot === b.pot &&
  a.highlight === b.highlight &&
  a.onOpen === b.onOpen &&
  a.deed?.owner === b.deed?.owner &&
  a.deed?.houses === b.deed?.houses &&
  a.deed?.mortgaged === b.deed?.mortgaged &&
  a.owner?.emoji === b.owner?.emoji &&
  a.owner?.color === b.owner?.color &&
  a.here.length === b.here.length &&
  a.here.every((t, i) => t.id === b.here[i].id && t.emoji === b.here[i].emoji && t.color === b.here[i].color && t.turn === b.here[i].turn);

const Cell = memo(function Cell({ index, edge, sq, deed, pot, owner, here, highlight, onOpen }: CellProps) {
  const { row, col, side } = cellOf(index, edge);
  const band = sq.kind === "prop" ? GROUP_COLORS[sq.group] : null;
  const bandSide = side === "bottom" ? "top" : side === "top" ? "bottom" : side === "left" ? "right" : side === "right" ? "left" : null;
  const houses = deed?.houses ?? 0;
  // Owners already there when the page opened don't replay the badge animation.
  const initialOwner = useRef(deed?.owner);
  // Owner badge sits on the outer edge, away from the colour band.
  const badgePos =
    side === "bottom" ? "bottom-[1px] right-[1px]" : side === "top" ? "top-[1px] left-[1px]" : side === "left" ? "left-[1px] top-[1px]" : "right-[1px] bottom-[1px]";

  return (
    <button
      onClick={() => onOpen(index)}
      style={{
        gridRow: row,
        gridColumn: col,
        // Tint in the owner's colour, layered over the cream card colour.
        backgroundImage: owner ? `linear-gradient(135deg, ${owner.color}66, ${owner.color}26 65%, transparent)` : undefined,
        boxShadow: owner ? `inset 0 0 0 3px ${owner.color}` : undefined,
      }}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden bg-[#f4efe1] p-[1px] text-center leading-tight text-emerald-950 transition-colors hover:brightness-105",
        side === "corner" && "bg-[#e6f4ea]",
        highlight && "ring-2 ring-inset ring-amber-400",
        deed?.mortgaged && "opacity-60 grayscale-[40%]",
        band && bandSide === "top" && (houses ? "pt-[40%]" : "pt-[22%]"),
        band && bandSide === "bottom" && (houses ? "pb-[40%]" : "pb-[22%]"),
        band && bandSide === "left" && (houses ? "pl-[40%]" : "pl-[22%]"),
        band && bandSide === "right" && (houses ? "pr-[40%]" : "pr-[22%]"),
      )}
      title={deed ? `${sq.name} — chủ ${owner?.emoji}` : sq.name}
    >
      {band && bandSide && (
        <span
          className={cn(
            "absolute",
            bandSide === "top" && "inset-x-0 top-0",
            bandSide === "bottom" && "inset-x-0 bottom-0",
            bandSide === "left" && "inset-y-0 left-0",
            bandSide === "right" && "inset-y-0 right-0",
            bandSide === "top" || bandSide === "bottom" ? (houses ? "h-[40%]" : "h-[22%]") : houses ? "w-[40%]" : "w-[22%]",
          )}
          style={{ background: band }}
        >
          <Buildings count={houses} vertical={bandSide === "left" || bandSide === "right"} />
        </span>
      )}
      {band && <BuildBurst count={houses} />}
      <span className="pointer-events-none flex flex-col items-center px-[2px]">
        {squareImg(sq) ? (
          <ArtIcon name={squareImg(sq)!} className={cn(side === "corner" ? "size-5 sm:size-9 short:size-5" : "size-3.5 sm:size-6 short:size-3.5")} />
        ) : null}
        <span className={cn("line-clamp-2 font-semibold", side === "corner" ? "text-[8px] sm:text-xs short:text-[8px]" : "text-[6px] sm:text-[9px] xl:text-[10px] short:text-[6px]")}>
          {sq.kind === "air" ? sq.name.replace("Sân bay ", "SB ") : sq.name}
        </span>
        {isOwnable(sq) && !deed && <span className="hidden text-[8px] text-emerald-900/70 sm:block short:hidden">{money(sq.price)}</span>}
        {deed?.mortgaged && <span className="text-[6px] font-bold text-rose-700 sm:text-[8px] short:text-[6px]">THẾ CHẤP</span>}
        {sq.kind === "parking" && !!pot && (
          <span className="rounded bg-amber-300 px-1 text-[7px] font-bold text-amber-950 sm:text-[10px] short:text-[7px]">💰 {money(pot)}</span>
        )}
      </span>
      {owner && deed && (
        <motion.span
          key={deed.owner}
          initial={deed.owner === initialOwner.current ? false : { scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn(
            "pointer-events-none absolute flex aspect-square h-[30%] min-h-[10px] items-center justify-center rounded-full border border-white text-[6px] shadow sm:text-[10px] short:text-[6px]",
            badgePos,
          )}
          style={{ background: owner.color }}
        >
          {owner.emoji}
        </motion.span>
      )}
      {here.length > 0 && (
        <span className="absolute inset-0 flex flex-wrap items-center justify-center gap-[1px] p-[2px]">
          {here.map((p) => (
            <motion.span
              key={p.id}
              layoutId={`token-${p.id}`}
              // Short tween per square: the walk itself is the square-by-square steps.
              transition={{ layout: { type: "tween", ease: "easeOut", duration: 0.16 } }}
              className={cn(
                "flex h-[42%] min-h-[12px] w-auto aspect-square items-center justify-center rounded-full border border-white text-[8px] shadow-md sm:text-sm short:text-[8px]",
                p.turn && "ring-2 ring-amber-400",
              )}
              style={{ background: p.color }}
            >
              {p.emoji}
            </motion.span>
          ))}
        </span>
      )}
    </button>
  );
}, sameCell);

// ─── Centre controls ────────────────────────────────────────────────

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Die({ value, rolling }: { value: number; rolling: number }) {
  return (
    <motion.div
      key={rolling}
      initial={{ rotate: -200, scale: 0.4, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      className="grid h-10 w-10 grid-cols-3 grid-rows-3 gap-[2px] rounded-lg bg-white p-1.5 shadow-lg sm:h-14 sm:w-14 sm:p-2 short:h-8 short:w-8 short:p-1"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cn("rounded-full", PIPS[value]?.includes(i) && "bg-emerald-950")} />
      ))}
    </motion.div>
  );
}

function Centre({
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
  const here = current ? BOARD[current.pos] : null;
  const secondsLeft = useSecondsLeft();
  const secs = secondsLeft(g.deadline);
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
      {/* My turn: pulsing ring around the turn line + my controls. */}
      <div className={cn("relative flex w-full flex-col items-center gap-2 rounded-2xl", myTurn && "bg-rose-50/40 p-2 short:p-1.5")}>
        <TurnRing active={myTurn} className="inset-0" />
        <p className="flex items-center gap-2 text-xs sm:text-sm">
          {myTurn ? <MyTurnBadge /> : <span>Lượt của <b>{turnName}</b></span>}
          {secs !== null && <span className={cn("font-mono", secs <= 8 && "text-rose-600")}>⏱ {secs}s</span>}
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
        <div className="flex flex-wrap justify-center gap-2">
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
      {g.log.length > 0 && (
        <ul className="w-full space-y-0.5 text-[11px] text-emerald-950/80 lg:hidden short:hidden">
          {g.log.slice(debt || (g.phase === "buy" && myTurn) ? -1 : -2).map((e) => (
            <li key={e.id} className="truncate rounded bg-white/50 px-2 py-0.5">
              {e.text}
            </li>
          ))}
        </ul>
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
    const have = Object.entries(g.deeds).filter(([pos, d]) => d.owner === meId && BOARD[Number(pos)].kind === "air").length;
    text = <>Thuê {AIR_RENT.map((r) => money(r)).join(" → ")} theo số sân bay · bạn có {have}/4</>;
  } else {
    text = <>Thuê = xúc xắc × {UTIL_MULT[0]} (có cả hai: × {UTIL_MULT[1]})</>;
  }
  return <p className="w-full rounded-lg bg-white/60 px-2 py-1 text-[11px] text-emerald-950 sm:text-xs">{text}</p>;
}

const GROUP_NAMES: Record<Group, string> = {
  brown: "Nâu",
  lightblue: "Xanh nhạt",
  pink: "Hồng",
  orange: "Cam",
  red: "Đỏ",
  yellow: "Vàng",
  green: "Xanh lá",
  darkblue: "Xanh đậm",
};
const ALL_GROUPS = Object.keys(GROUP_NAMES) as Group[];

/** Colour groups `id` can build in: every city owned, or (without the full-group rule) at least one. */
function buildableGroups(g: TPGameView, id: string, needGroup: boolean): Group[] {
  return ALL_GROUPS.filter((grp) => {
    const cells = groupPositions(grp);
    return needGroup ? cells.every((p) => g.deeds[p]?.owner === id) : cells.some((p) => g.deeds[p]?.owner === id);
  });
}

/** One-line summary of the table's building rule. */
const buildRuleText = (st: TPSettings) =>
  (st.buildRule === "chain"
    ? "Xây theo chuỗi: nhà 2 / nhà 3 cần 2 ô trong nhóm có nhà 1 / nhà 2, nhà 4 cần cả nhóm 3 nhà, khách sạn cần cả nhóm 4 nhà."
    : "Xây đều từng ô trong nhóm; 4 nhà rồi lên khách sạn.") + (st.needGroup === false ? " Không cần đủ nhóm màu, nhưng chưa đủ nhóm thì tối đa 3 nhà (nhà 4 / khách sạn cần đủ nhóm)." : "");

/** Build on every group you can build in, without hunting for the squares on the board. Selling / mortgaging lives in AssetPanel. */
function BuildPanel({
  g,
  mine,
  settings,
  busy,
  run,
  onClose,
  onOpenAssets,
}: {
  g: TPGameView;
  mine: TPPlayerView;
  settings: TPSettings;
  busy: boolean;
  run: Act;
  onClose: () => void;
  onOpenAssets: () => void;
}) {
  const needGroup = settings.needGroup !== false;
  const groups = buildableGroups(g, mine.id, needGroup);
  const partial = needGroup ? ALL_GROUPS.filter((grp) => !groups.includes(grp) && groupPositions(grp).some((p) => g.deeds[p]?.owner === mine.id)) : [];
  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-1 text-lg font-bold text-amber-300">🏠 Xây nhà</h2>
      <p className="mb-3 text-xs text-sky-100/70">
        Tiền mặt: <b className="text-emerald-300">{money(mine.cash)}</b> · {buildRuleText(settings)}
      </p>
      {groups.length === 0 && <p className="text-sm text-sky-100/70">{needGroup ? "Bạn chưa sở hữu đủ nhóm màu nào." : "Bạn chưa có đất thành phố nào."}</p>}
      <div className="space-y-3">
        {groups.map((grp) => {
          const cells = groupPositions(grp);
          const anyMortgaged = cells.some((p) => g.deeds[p]?.owner === mine.id && g.deeds[p].mortgaged);
          return (
            <div key={grp} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between px-3 py-1.5 text-sm font-bold text-black" style={{ background: GROUP_COLORS[grp] }}>
                <span>Nhóm {GROUP_NAMES[grp]}</span>
                {anyMortgaged && <span className="rounded bg-black/30 px-1.5 text-[11px] text-white">có ô đang thế chấp</span>}
              </div>
              <ul className="divide-y divide-white/5">
                {cells.map((pos) => {
                  const sq = BOARD[pos] as Extract<Square, { kind: "prop" }>;
                  const d = g.deeds[pos];
                  if (!d || d.owner !== mine.id) {
                    return (
                      <li key={pos} className="flex items-center gap-2 px-3 py-2 text-sm text-sky-100/45">
                        <span className="min-w-0 flex-1 truncate">{sq.name}</span>
                        <span className="shrink-0 text-[11px]">{d ? "của người khác" : "chưa có chủ"}</span>
                      </li>
                    );
                  }
                  const buildWhy = g.manage?.[pos]?.build ?? null;
                  const full = d.houses >= MAX_HOUSES;
                  return (
                    <li key={pos} className="px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <b className="block truncate">{sq.name}</b>
                          <span className="flex h-5 items-end gap-0.5">
                            {d.mortgaged ? (
                              <span className="text-[11px] font-semibold text-rose-300">Đang thế chấp</span>
                            ) : d.houses === 0 ? (
                              <span className="text-[11px] text-sky-100/50">Đất trống · thuê {money(sq.rent[0])}</span>
                            ) : d.houses === MAX_HOUSES ? (
                              <Building hotel className="h-4" />
                            ) : (
                              Array.from({ length: d.houses }, (_, i) => <Building key={i} className="h-4" />)
                            )}
                            {d.houses > 0 && <span className="ml-1 text-[11px] text-sky-100/60">thuê {money(sq.rent[d.houses])}</span>}
                          </span>
                        </span>
                        {full ? (
                          <span className="shrink-0 text-[11px] font-semibold text-amber-200">🏨 Tối đa</span>
                        ) : (
                          <button
                            onClick={() => void run({ type: "build", pos })}
                            disabled={busy || !!buildWhy}
                            title={buildWhy ?? undefined}
                            className="min-h-9 shrink-0 whitespace-nowrap rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-black enabled:hover:bg-emerald-400 disabled:opacity-30"
                          >
                            + {d.houses === MAX_HOUSES - 1 ? "Khách sạn" : `Nhà ${d.houses + 1}`} · {money(houseCost(sq, d.houses + 1, settings))}
                          </button>
                        )}
                      </div>
                      {buildWhy && !full && <p className="mt-0.5 text-right text-[11px] text-sky-100/45">{buildWhy}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {partial.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-100/50">Còn thiếu để xây</p>
          <ul className="space-y-1 text-xs text-sky-100/70">
            {partial.map((grp) => (
              <li key={grp} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: GROUP_COLORS[grp] }} />
                Nhóm {GROUP_NAMES[grp]}: còn thiếu{" "}
                {groupPositions(grp)
                  .filter((p) => g.deeds[p]?.owner !== mine.id)
                  .map((p) => BOARD[p].name)
                  .join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => {
          onClose();
          onOpenAssets();
        }}
        className="mt-4 w-full rounded-lg border border-amber-300/40 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
      >
        💰 Bán nhà / thế chấp / bán đất →
      </button>
    </Modal>
  );
}

function CBtn({
  children,
  onClick,
  disabled,
  primary,
  danger,
  build,
  title,
  hotkey,
}: {
  children: React.ReactNode;
  onClick: () => void;
  /** Keyboard shortcut shown on the button (desktop only). */
  hotkey?: string;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  /** The house-building button: stands out next to the main action. */
  build?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold shadow transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm",
        primary && "bg-emerald-700 text-white enabled:hover:bg-emerald-600",
        danger && "bg-rose-600 text-white enabled:hover:bg-rose-500",
        build && "bg-gradient-to-b from-amber-300 to-orange-500 text-black shadow-[0_3px_0_#9a3412] enabled:hover:brightness-110 enabled:active:translate-y-0.5",
        !primary && !danger && !build && "border border-emerald-800/30 bg-white/70 enabled:hover:bg-white",
      )}
    >
      {children}
      {hotkey && (
        <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
    </button>
  );
}

/** Debt line + Trả nợ / Phá sản in the board centre: small, so the board around it stays visible. */
function DebtControls({
  debt,
  cash,
  busy,
  run,
  onOpenAssets,
}: {
  debt: NonNullable<TPGameView["debt"]>;
  cash: number;
  busy: boolean;
  run: Act;
  /** Scrolls to the assets panel (below the board on phones); absent when there's nothing to sell. */
  onOpenAssets?: () => void;
}) {
  const short = Math.max(0, debt.amount - cash);
  return (
    <div role="alert" className="flex w-full flex-col items-center gap-1.5">
      <p className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-900">
        💸 Nợ {money(debt.amount)} ({debt.reason}){short > 0 ? <> · thiếu <b>{money(short)}</b></> : " · đủ tiền trả"}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        <CBtn primary onClick={() => void run({ type: "paydebt" })} disabled={busy || short > 0}>
          Trả nợ
        </CBtn>
        {onOpenAssets && (
          <span className="lg:hidden short:hidden">
            <CBtn build onClick={onOpenAssets} disabled={busy}>
              💰 Bán / thế chấp ↓
            </CBtn>
          </span>
        )}
        <ConfirmButton
          onConfirm={() => void run({ type: "bankrupt" })}
          disabled={busy}
          confirmLabel="Bấm lần nữa để phá sản"
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow enabled:hover:bg-rose-500 disabled:opacity-40 sm:text-sm"
        >
          Phá sản
        </ConfirmButton>
      </div>
    </div>
  );
}

/** Why a lot can't be mortgaged: only my own houses in the group get in the way. */
function mortgageBlocker(g: TPGameView, meId: string, pos: number): string | null {
  const sq = BOARD[pos];
  const d = g.deeds[pos];
  if (!d || d.owner !== meId) return "Đây không phải đất của bạn";
  if (d.mortgaged) return "Đã thế chấp rồi";
  if (sq.kind === "prop" && groupPositions(sq.group).some((p) => g.deeds[p]?.owner === meId && g.deeds[p].houses > 0)) return "Bán hết nhà của bạn trong nhóm trước";
  return null;
}

/**
 * Everything I own with the ways to raise cash (sell a house, mortgage, sell land) and to buy a mortgage back.
 * Lives in the side column, not over the board; while in debt it also shows what's still missing.
 */
function AssetPanel({
  g,
  mine,
  settings,
  busy,
  run,
  deadline,
  onClose,
}: {
  g: TPGameView;
  mine: TPPlayerView;
  settings: TPSettings;
  busy: boolean;
  run: Act;
  deadline: number | null;
  /** Absent while in debt: the panel stays until the debt is settled. */
  onClose?: () => void;
}) {
  const seconds = useSecondsLeft()(deadline);
  const debt = g.phase === "debt" ? g.debt : null;
  const short = debt ? Math.max(0, debt.amount - mine.cash) : 0;
  const owned = Object.keys(g.deeds)
    .map(Number)
    .filter((pos) => g.deeds[pos].owner === mine.id)
    .sort((a, b) => a - b);
  // Cities by colour group, then airports / companies.
  const sections: { key: string; title: string; color?: string; cells: number[] }[] = [];
  for (const grp of ALL_GROUPS) {
    const cells = owned.filter((pos) => BOARD[pos].kind === "prop" && (BOARD[pos] as Extract<Square, { kind: "prop" }>).group === grp);
    if (cells.length) sections.push({ key: grp, title: `Nhóm ${GROUP_NAMES[grp]}`, color: GROUP_COLORS[grp], cells });
  }
  const others = owned.filter((pos) => BOARD[pos].kind !== "prop");
  if (others.length) sections.push({ key: "other", title: "Sân bay & công ty", cells: others });
  const sellLandOn = !!settings.sellLand;
  const fee = settings.unmortgageFee ?? 10;
  const btn = "min-h-8 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-30 sm:text-xs";

  return (
    <section
      aria-label="Thế chấp / bán tài sản"
      className={cn("rounded-2xl border p-3 short:p-2", debt ? "border-rose-400/70 bg-[#2a0f12]/90 shadow-[0_0_24px_rgba(244,63,94,0.3)]" : "border-amber-300/30 bg-black/45")}
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-sm font-bold text-amber-300">💰 Thế chấp / Bán</p>
        {onClose && (
          <button onClick={onClose} aria-label="Đóng" className="grid size-9 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white lg:size-7">
            ✕
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-sky-100/75">
        Tiền mặt <b className="text-emerald-300">{money(mine.cash)}</b>
        {debt && (
          <>
            {" "}
            · nợ <b className="text-rose-200">{money(debt.amount)}</b>
            {short > 0 ? (
              <>
                {" "}
                · còn thiếu <b className="text-amber-300">{money(short)}</b>
              </>
            ) : (
              <b className="text-emerald-300"> · đủ tiền trả</b>
            )}
            {seconds !== null && <span className="ml-1 font-mono text-rose-200/80">⏱ {seconds}s</span>}
          </>
        )}
      </p>
      {debt && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button onClick={() => void run({ type: "paydebt" })} disabled={busy || short > 0} className={cn(btn, "bg-emerald-500 px-3 text-black enabled:hover:bg-emerald-400")}>
            Trả nợ
          </button>
          <ConfirmButton
            onConfirm={() => void run({ type: "bankrupt" })}
            disabled={busy}
            confirmLabel="Bấm lần nữa để phá sản"
            className={cn(btn, "bg-rose-600 px-3 text-white enabled:hover:bg-rose-500")}
          >
            Phá sản
          </ConfirmButton>
          <span className="w-full text-[11px] text-rose-100/55">Hết giờ thì máy tự bán nhà / thế chấp rồi trả.</span>
        </div>
      )}
      {owned.length === 0 && <p className="text-xs text-sky-100/60">Bạn không còn đất nào.</p>}
      <div className="space-y-2 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:pr-0.5">
        {sections.map((sec) => (
          <div key={sec.key} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <p className="px-2 py-1 text-xs font-bold text-black" style={{ background: sec.color ?? "#cfe8d8" }}>
              {sec.title}
            </p>
            <ul className="divide-y divide-white/5">
              {sec.cells.map((pos) => {
                const sq = BOARD[pos] as Ownable;
                const d = g.deeds[pos];
                const m = g.manage?.[pos];
                const sellWhy = m?.sell ?? null;
                const mortWhy = mortgageBlocker(g, mine.id, pos);
                const unmortCost = unmortgageCost(sq, settings);
                return (
                  <li key={pos} className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 basis-28">
                      <b className="block truncate text-[13px]">{sq.name}</b>
                      <span className="flex h-4 items-end gap-0.5 text-[11px] text-sky-100/55">
                        {d.mortgaged ? (
                          <span className="font-semibold text-rose-300">Đang thế chấp</span>
                        ) : d.houses === 0 ? (
                          "Đất trống"
                        ) : d.houses === MAX_HOUSES ? (
                          <Building hotel className="h-3.5" />
                        ) : (
                          Array.from({ length: d.houses }, (_, i) => <Building key={i} className="h-3.5" />)
                        )}
                      </span>
                    </span>
                    {sq.kind === "prop" && d.houses > 0 && (
                      <button
                        onClick={() => void run({ type: "sell", pos })}
                        disabled={busy || !!sellWhy}
                        title={sellWhy ?? `Bán ${d.houses === MAX_HOUSES ? "khách sạn" : `nhà ${d.houses}`}, nhận ${money(houseRefund(sq, d.houses, settings))} (nửa giá đã xây)`}
                        className={cn(btn, "border border-white/20 enabled:hover:bg-white/10")}
                      >
                        🏚️ Bán nhà +{money(houseRefund(sq, d.houses, settings))}
                      </button>
                    )}
                    {!d.mortgaged && d.houses === 0 && (
                      <button
                        onClick={() => void run({ type: "mortgage", pos })}
                        disabled={busy || !!mortWhy}
                        title={mortWhy ?? `Thế chấp, nhận ${money(mortgageValue(sq))}`}
                        className={cn(btn, "border border-sky-300/40 text-sky-100 enabled:hover:bg-sky-400/10")}
                      >
                        🏦 Thế chấp +{money(mortgageValue(sq))}
                      </button>
                    )}
                    {d.mortgaged && (
                      <button
                        onClick={() => void run({ type: "unmortgage", pos })}
                        disabled={busy || !!debt || mine.cash < unmortCost}
                        title={debt ? "Đang nợ — chưa chuộc được" : `Chuộc lại: ${money(mortgageValue(sq))} + ${fee}% phí = ${money(unmortCost)}`}
                        className={cn(btn, "border border-emerald-300/40 text-emerald-200 enabled:hover:bg-emerald-400/10")}
                      >
                        Chuộc −{money(unmortCost)} {fee > 0 && <span className="font-normal opacity-70">(+{fee}%)</span>}
                      </button>
                    )}
                    {sellLandOn && m && d.houses === 0 && (
                      <ConfirmButton
                        onConfirm={() => void run({ type: "sellland", pos })}
                        disabled={busy || !!m.sellLand}
                        title={m.sellLand ?? `Bán đất cho ngân hàng, nhận ${money(m.landPrice)} — đất về chợ`}
                        confirmLabel={`Bán lấy ${money(m.landPrice)}?`}
                        className={cn(btn, "border border-amber-300/40 text-amber-200 enabled:hover:bg-amber-400/10")}
                      >
                        🏷️ Bán đất +{money(m.landPrice)}
                      </ConfirmButton>
                    )}
                    {sq.kind === "prop" && d.houses > 0 && sellWhy && <span className="w-full text-right text-[10px] text-sky-100/45">{sellWhy}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-sky-100/45">
        Bán nhà được nửa giá căn đó. Thế chấp nhận 50% giá đất{fee > 0 ? `, chuộc lại phải trả thêm ${fee}%` : ", chuộc lại đúng giá đó"}.
        {sellLandOn ? ` Bán đất được ${settings.landSalePct ?? 70}% giá${(settings.landSalePct ?? 70) > 50 ? " (hơn thế chấp)" : ""} nhưng mất đất — đất về chợ cho người khác mua. Đất đang thế chấp vẫn bán được, chỉ nhận phần chênh.` : ""}
      </p>
    </section>
  );
}

const MONEY_BITS = ["💸", "💵", "🪙", "💸", "💵", "🪙", "💸", "💵", "🪙", "💸", "💵", "🪙"];

/** Full-screen "PHÁ SẢN!" moment: a red flash, the name stamped in, money raining down. */
function BankruptOverlay({ fx }: { fx: { id: string; name: string; me: boolean; at: number } | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.at}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          <motion.div
            className="absolute inset-0 bg-rose-900"
            initial={{ opacity: 0.75 }}
            animate={{ opacity: [0.75, 0.35, 0.5] }}
            transition={{ duration: 0.9 }}
          />
          {MONEY_BITS.map((m, i) => (
            <motion.span
              key={i}
              className="absolute top-0 text-3xl sm:text-5xl"
              style={{ left: `${(i * 83) % 100}%` }}
              initial={{ y: "-10vh", rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", rotate: (i % 2 ? 1 : -1) * 360, opacity: [1, 1, 0.6] }}
              transition={{ duration: 2.2 + (i % 4) * 0.35, delay: (i % 6) * 0.12, ease: "easeIn" }}
            >
              {m}
            </motion.span>
          ))}
          <motion.div
            className="relative flex flex-col items-center gap-2 px-4 text-center"
            initial={{ scale: 3, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
          >
            <span className="rounded-2xl border-4 border-white bg-rose-600 px-5 py-2 text-4xl font-black tracking-widest text-white shadow-2xl sm:text-6xl">PHÁ SẢN!</span>
            <span className="rounded-full bg-black/70 px-4 py-1 text-base font-bold text-white sm:text-xl">
              {fx.me ? "Bạn đã phá sản 😵" : `${fx.name} đã phá sản`}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function BuildOverlay({ fx }: { fx: { id: number; text: string; hotel: boolean } | null }) {
  return (
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.id}
          className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: [0, 1.3, 1], rotate: 0 }}
            transition={{ duration: 0.5 }}
            className="h-14 drop-shadow-lg sm:h-20"
          >
            <Building hotel={fx.hotel} className="h-full" />
          </motion.div>
          <p className="mt-1 rounded-full bg-emerald-800 px-3 py-1 text-xs font-semibold text-white shadow sm:text-sm">{fx.text}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CardOverlay({ card, nameOf, onClose }: { card: TPGameView["lastCard"]; nameOf: (id: string) => string; onClose: () => void }) {
  return (
    <AnimatePresence>
      {card && (
        <motion.div
          key={card.at}
          onClick={onClose}
          className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/25 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Let clicks through as soon as it starts fading, so it never blocks the roll button.
          exit={{ opacity: 0, pointerEvents: "none", transition: { duration: 0.2 } }}
        >
          <motion.div
            initial={{ rotateY: 180, scale: 0.6 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className={cn(
              "w-full max-w-xs rounded-2xl border-4 p-4 text-center shadow-2xl",
              card.deck === "chance" ? "border-orange-400 bg-orange-50" : "border-sky-400 bg-sky-50",
            )}
          >
            <p className="flex justify-center"><ArtIcon name={card.deck === "chance" ? "chance" : "chest"} className="size-14" /></p>
            <p className="text-sm font-black uppercase tracking-wide">{card.deck === "chance" ? "Cơ hội" : "Khí vận"}</p>
            <p className="mt-2 text-sm">{card.text}</p>
            <p className="mt-2 text-xs text-black/50">— {nameOf(card.player)}</p>
            <p className="mt-2 text-[11px] text-black/40">Chạm để đóng</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Side panel ─────────────────────────────────────────────────────

function PlayerRow({
  seat,
  p,
  g,
  self,
  token,
  isTurn,
  reactions,
  onOpen,
  onPick,
  onKick,
}: {
  seat: TPSeatView;
  p: TPPlayerView | null;
  g: TPGameView | null;
  self: boolean;
  token: { emoji: string; color: string };
  isTurn: boolean;
  reactions: Reaction[];
  onOpen: (pos: number) => void;
  /** Own row only: opens the token picker. */
  onPick?: () => void;
  onKick?: () => void;
}) {
  const owned = g ? Object.entries(g.deeds).filter(([, d]) => d.owner === seat.id).map(([pos]) => Number(pos)) : [];
  return (
    <li className={cn("relative rounded-xl p-2", isTurn ? "bg-amber-400/15 ring-1 ring-amber-300/60" : "bg-white/5", p?.bankrupt && "opacity-50")}>
      <div className="flex items-center gap-2">
        <span className="relative">
          <SeatBubble reactions={reactions} />
          <button
            type="button"
            disabled={!onPick}
            onClick={onPick}
            title={onPick ? "Đổi quân cờ & màu" : undefined}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-lg",
              (!seat.connected || seat.kicked) && "grayscale",
              onPick && "cursor-pointer ring-amber-300 hover:ring-2 max-sm:min-h-9",
            )}
            style={{ background: token.color }}
          >
            {token.emoji}
          </button>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {seat.isHost && <span title="Chủ bàn">👑</span>}
            <SeatAvatar name={seat.name} className="grid size-5 shrink-0 place-items-center rounded-full text-[11px]" fallbackClassName="bg-white/15 font-bold" />
            <span className="truncate">{seat.name}</span>
            {self && <span className="text-xs font-normal text-white/60">(bạn)</span>}
          </p>
          <p className="flex flex-wrap items-center gap-1 text-[11px] text-white/70">
            {p && !p.bankrupt && (
              <span className="font-mono text-emerald-300">
                💰 <NumberFlow value={p.cash} locales="vi-VN" suffix="tr" />
              </span>
            )}
            {p && !p.bankrupt && (
              <span className="font-mono text-white/50" title="Tổng tài sản">
                ≈ <NumberFlow value={p.netWorth} locales="vi-VN" suffix="tr" />
              </span>
            )}
            {p?.jail ? <span className="rounded bg-zinc-600 px-1">🚔 Ở tù</span> : null}
            {p && p.jailCards > 0 && <span title="Thẻ ra tù">🗝️×{p.jailCards}</span>}
            {p?.bankrupt && <span className="rounded bg-rose-900/60 px-1">Phá sản</span>}
            {!seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Mất kết nối</span>}
            {seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Bị kích</span>}
            {seat.games > 0 && <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")}>{signed(seat.points)}đ</span>}
          </p>
        </div>
        {onKick && (
          <ConfirmButton
            onConfirm={onKick}
            confirmLabel="Chắc chắn?"
            title={p && !p.bankrupt ? "Kích người mất kết nối — họ bị tính phá sản" : "Mời người mất kết nối ra khỏi bàn"}
            className="rounded bg-rose-600 px-1.5 text-[11px] font-semibold text-white hover:bg-rose-500 max-sm:min-h-8 max-sm:px-2.5"
          >
            Kích
          </ConfirmButton>
        )}
      </div>
      {owned.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {owned.map((pos) => {
            const sq = BOARD[pos];
            const d = g!.deeds[pos];
            return (
              <button
                key={pos}
                onClick={() => onOpen(pos)}
                title={sq.name}
                className={cn("flex h-5 items-center justify-center gap-0.5 rounded px-1 text-[10px] font-semibold text-black max-sm:h-7 max-sm:min-w-7 max-sm:px-1.5 max-sm:text-[11px] short:h-6 short:min-w-6", d.mortgaged && "opacity-40 line-through")}
                style={{ background: sq.kind === "prop" ? GROUP_COLORS[sq.group] : "#e5e7eb" }}
              >
                {sq.kind === "air" ? "✈️" : sq.kind === "util" ? (sq.name.includes("Điện") ? "💡" : "🚰") : null}
                {sq.kind === "prop" ? sq.name.split(" ").map((w) => w[0]).join("") : ""}
                {d.houses > 0 && <span>{d.houses === MAX_HOUSES ? "🏨" : `${d.houses}🏠`}</span>}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

// ─── Square details / management ────────────────────────────────────

function SquareModal({
  pos,
  g,
  settings,
  meId,
  myTurn,
  nameOf,
  run,
  busy,
  onClose,
}: {
  pos: number;
  g: TPGameView | null;
  settings: TPSettings;
  meId: string;
  myTurn: boolean;
  nameOf: (id: string) => string;
  run: Act;
  busy: boolean;
  onClose: () => void;
}) {
  const sq = BOARD[pos];
  const deed = g?.deeds[pos];
  const mineHere = !!deed && deed.owner === meId && myTurn;
  const inDebt = g?.phase === "debt";
  const group = sq.kind === "prop" ? groupPositions(sq.group) : [];
  const ownsSet = sq.kind === "prop" && !!g && group.every((p) => g.deeds[p]?.owner === meId);
  const m = g?.manage?.[pos];
  const due = g ? rentDue(g, pos) : null;
  const buildWhy = inDebt ? "Đang nợ — không xây được" : m ? m.build : ownsSet ? null : "Sở hữu đủ cả nhóm màu mới được xây nhà.";

  return (
    <Modal onClose={onClose}>
      <div className="overflow-hidden rounded-xl bg-[#f4efe1] text-emerald-950">
        <div className="p-3 text-center" style={{ background: sq.kind === "prop" ? GROUP_COLORS[sq.group] : "#cfe8d8" }}>
          <p className="flex justify-center text-2xl">{squareImg(sq) ? <ArtIcon name={squareImg(sq)!} className="size-12" /> : "📍"}</p>
          <p className="text-lg font-black">{sq.name}</p>
          {sq.kind === "prop" && <p className="text-xs">{sq.region}</p>}
        </div>
        <div className="space-y-2 p-4 text-sm">
          {isOwnable(sq) ? <OwnableInfo sq={sq} settings={settings} activeRow={due?.row} /> : <p>{SQUARE_TEXT[sq.kind]?.(sq)}</p>}
          {sq.kind === "parking" && settings.parkingPot && (
            <p className="mt-2 rounded-lg bg-amber-300/90 px-3 py-2 font-semibold text-amber-950">
              💰 Quỹ đang giữ: {money(g?.pot ?? 0)}
              <span className="mt-0.5 block text-xs font-normal">Tiền phạt/thuế dồn vào đây — ai dừng ở Nghỉ chân sẽ lấy hết.</span>
            </p>
          )}
          {due && (
            <p className={cn("rounded-lg px-3 py-2 text-center", due.free ? "bg-emerald-200/70 text-emerald-900" : "bg-rose-100 text-rose-900 ring-1 ring-rose-300")}>
              <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-70">{deed?.owner === meId ? "Người khác dừng ở đây phải trả" : "Dừng ở đây phải trả"}</span>
              <b className="text-xl font-black">{due.text}</b>
            </p>
          )}
          {deed && (
            <p className="rounded bg-white/70 px-2 py-1">
              Chủ: <b>{nameOf(deed.owner)}</b>
              {deed.houses > 0 && <> · {deed.houses === MAX_HOUSES ? "1 khách sạn" : `${deed.houses} nhà`}</>}
              {deed.mortgaged && <b className="text-rose-700"> · đang thế chấp</b>}
            </p>
          )}
          {deed && deed.houses > 0 && (
            <div className="flex h-10 items-end justify-center gap-1 rounded bg-emerald-900/10 p-1">
              {deed.houses === MAX_HOUSES ? (
                <Building hotel className="h-full" />
              ) : (
                Array.from({ length: deed.houses }, (_, i) => <Building key={i} className="h-full" />)
              )}
            </div>
          )}
          {g && g.players.some((p) => p.pos === pos && !p.bankrupt) && (
            <p className="text-xs text-emerald-900/70">Đang đứng ở đây: {g.players.filter((p) => p.pos === pos && !p.bankrupt).map((p) => nameOf(p.id)).join(", ")}</p>
          )}
          {mineHere && isOwnable(sq) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {sq.kind === "prop" && !deed.mortgaged && deed.houses < MAX_HOUSES && (
                <CBtn primary onClick={() => void run({ type: "build", pos })} disabled={busy || !!buildWhy} title={buildWhy ?? undefined}>
                  🏠 Xây {deed.houses === MAX_HOUSES - 1 ? "khách sạn" : `nhà ${deed.houses + 1}`} ({money(houseCost(sq, deed.houses + 1, settings))})
                </CBtn>
              )}
              {sq.kind === "prop" && deed.houses > 0 && (
                <CBtn onClick={() => void run({ type: "sell", pos })} disabled={busy || !!m?.sell} title={m?.sell ?? undefined}>
                  Bán 1 nhà (+{money(houseRefund(sq, deed.houses, settings))})
                </CBtn>
              )}
              {!deed.mortgaged && deed.houses === 0 && g && (
                <CBtn onClick={() => void run({ type: "mortgage", pos })} disabled={busy || !!mortgageBlocker(g, meId, pos)} title={mortgageBlocker(g, meId, pos) ?? undefined}>
                  Thế chấp (+{money(mortgageValue(sq))})
                </CBtn>
              )}
              {m && settings.sellLand && deed.houses === 0 && (
                <ConfirmButton
                  onConfirm={() => void run({ type: "sellland", pos })}
                  disabled={busy || !!m.sellLand}
                  title={m.sellLand ?? "Đất về chợ, ai cũng mua lại được"}
                  confirmLabel="Chắc chắn bán?"
                  className="rounded-lg border border-emerald-800/30 bg-white/70 px-3 py-1.5 text-xs font-semibold shadow enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                >
                  🏷️ Bán đất (+{money(m.landPrice)})
                </ConfirmButton>
              )}
              {deed.mortgaged && (
                <CBtn onClick={() => void run({ type: "unmortgage", pos })} disabled={busy || inDebt}>
                  Chuộc lại ({money(unmortgageCost(sq, settings))}{settings.unmortgageFee !== 0 ? `, +${settings.unmortgageFee ?? 10}%` : ""})
                </CBtn>
              )}
            </div>
          )}
          {mineHere && sq.kind === "prop" && buildWhy && deed.houses < MAX_HOUSES && <p className="text-xs text-emerald-900/60">{buildWhy}</p>}
          {deed?.owner === meId && !myTurn && <p className="text-xs text-emerald-900/60">Xây nhà / thế chấp được trong lượt của bạn.</p>}
        </div>
      </div>
    </Modal>
  );
}

/** What landing on an owned square costs right now: the amount (null = depends on the dice) and the row of the rent table it comes from. */
function rentDue(g: TPGameView, pos: number): { text: string; row: number | null; free?: boolean } | null {
  const d = g.deeds[pos];
  const b = BOARD[pos];
  if (!d || !isOwnable(b)) return null;
  if (d.mortgaged) return { text: "0 — đang thế chấp", row: null, free: true };
  if (b.kind === "prop") {
    if (d.houses > 0) return { text: money(b.rent[d.houses]), row: d.houses };
    const full = groupPositions(b.group).every((p) => g.deeds[p]?.owner === d.owner);
    return { text: money(full ? b.rent[0] * 2 : b.rent[0]), row: 0 };
  }
  const count = Object.entries(g.deeds).filter(([p, x]) => x.owner === d.owner && BOARD[Number(p)].kind === b.kind).length;
  if (b.kind === "air") return { text: money(AIR_RENT[Math.max(0, count - 1)]), row: count - 1 };
  return { text: `tổng xúc xắc × ${UTIL_MULT[count >= 2 ? 1 : 0]}`, row: count >= 2 ? 1 : 0 };
}

function OwnableInfo({ sq, settings, activeRow }: { sq: Ownable; settings: TPSettings; activeRow?: number | null }) {
  if (sq.kind === "prop") {
    const labels = ["Đất trống", "1 nhà", "2 nhà", "3 nhà", "4 nhà", "Khách sạn"];
    return (
      <>
        <p>
          Giá <b>{money(sq.price)}</b> · nhà đầu <b>{money(houseCost(sq, 1, settings))}</b>
          {settings.risingCost === false ? ", căn nào cũng giá đó" : ", mỗi căn sau đắt hơn 25%"}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-emerald-900/50">
              <th className="py-0.5 text-left font-semibold" />
              <th className="py-0.5 text-right font-semibold">Thuê</th>
              <th className="py-0.5 text-right font-semibold">Giá xây</th>
            </tr>
          </thead>
          <tbody>
            {sq.rent.map((r, i) => (
              <tr key={i} className={cn("border-b border-emerald-900/10", activeRow === i && "bg-amber-200/70 font-black")}>
                <td className="py-0.5">{labels[i]}</td>
                <td className="py-0.5 text-right font-mono">{money(r)}</td>
                <td className="py-0.5 text-right font-mono text-emerald-900/70">{i === 0 ? "—" : money(houseCost(sq, i, settings))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-emerald-900/70">
          Có đủ nhóm màu mà chưa xây: tiền thuê đất trống ×2. Thế chấp nhận {money(mortgageValue(sq))} (chuộc {money(unmortgageCost(sq, settings))}).
          {settings.sellLand && <> Bán đất cho ngân hàng: {money(landSaleValue(sq, settings))}.</>}
        </p>
      </>
    );
  }
  if (sq.kind === "air") {
    return (
      <>
        <p>
          Giá <b>{money(sq.price)}</b>
        </p>
        <p className="text-xs">
          Tiền thuê theo số sân bay cùng chủ:{" "}
          {AIR_RENT.map((r, i) => (
            <span key={i} className={cn(activeRow === i && "rounded bg-amber-200/70 px-1 font-black")}>
              {i > 0 && " · "}
              {i + 1} → {money(r)}
            </span>
          ))}
        </p>
      </>
    );
  }
  return (
    <>
      <p>
        Giá <b>{money(sq.price)}</b>
      </p>
      <p className="text-xs">
        Tiền thuê = tổng xúc xắc × {UTIL_MULT[0]} (có 1 công ty) hoặc × {UTIL_MULT[1]} (có cả điện lẫn nước).
      </p>
    </>
  );
}

const SQUARE_TEXT: Partial<Record<Square["kind"], (sq: Square) => string>> = {
  go: () => "Mỗi lần đi qua hoặc dừng ở đây nhận lương (mặc định 200tr, chủ bàn chỉnh được).",
  chance: () => "Rút một thẻ Cơ hội: có thể được tiền, phải di chuyển, hoặc vào tù.",
  chest: () => "Rút một thẻ Khí vận: phần lớn là tiền thưởng, đôi khi phải chi.",
  tax: (sq) => `Nộp ${money((sq as Extract<Square, { kind: "tax" }>).amount)} cho ngân hàng.`,
  jail: () => `Chỉ ghé thăm thì không sao. Ở tù: mỗi lượt tung đôi để ra, hoặc nộp ${money(JAIL_FINE)} / dùng thẻ ra tù. Sau 3 lượt phải nộp phạt.`,
  parking: () => "Nghỉ chân uống ly cà phê.",
  gotojail: () => "Đi thẳng vào tù, không qua Khởi hành.",
};

// ─── Loans ──────────────────────────────────────────────────────────

function LoanCard({ loan, nameOf, incoming, outgoing, onAnswer }: { loan: NonNullable<TPGameView["loan"]>; nameOf: (id: string) => string; incoming: boolean; outgoing: boolean; onAnswer: (accept: boolean) => void }) {
  const seconds = useSecondsLeft()(loan.deadline) ?? 0;
  const owed = loan.amount + Math.ceil((loan.amount * loan.rate) / 100);
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("rounded-2xl p-3 text-sm text-white shadow-lg", incoming ? "bg-amber-950/95 ring-2 ring-amber-300" : "bg-emerald-950/90")}>
      <p className="mb-1 font-semibold">
        🏦 {nameOf(loan.from)} xin vay {nameOf(loan.to)} <span className="font-mono text-xs text-white/60">({seconds}s)</span>
      </p>
      <p className="text-xs">
        Vay <b>{money(loan.amount)}</b>, lãi {loan.rate}% — trả <b className="text-amber-200">{money(owed)}</b> sau {LOAN_TURNS} lượt của người vay.
      </p>
      {incoming && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onAnswer(true)} className="flex-1 rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-black hover:bg-emerald-400 max-sm:min-h-10">
            Cho vay
          </button>
          <button onClick={() => onAnswer(false)} className="flex-1 rounded-lg border border-white/30 px-3 py-1 hover:bg-white/10 max-sm:min-h-10">
            Từ chối
          </button>
        </div>
      )}
      {outgoing && (
        <button onClick={() => onAnswer(false)} className="mt-2 w-full rounded-lg border border-white/30 px-3 py-1 text-xs hover:bg-white/10 max-sm:min-h-9">
          Rút lời xin vay
        </button>
      )}
    </motion.div>
  );
}

function LoanModal({ g, meId, nameOf, run, onClose }: { g: TPGameView; meId: string; nameOf: (id: string) => string; run: Act; onClose: () => void }) {
  const others = g.players.filter((p) => p.id !== meId && !p.bankrupt);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [rate, setRate] = useState(LOAN_RATES[0]);
  const lender = g.players.find((p) => p.id === to);
  const open = (g.loans ?? []).filter((l) => l.borrower === meId).length;
  const owed = amount + Math.ceil((amount * rate) / 100);
  const bad = !to ? "Chọn người cho vay" : amount < 10 ? "Vay tối thiểu 10tr" : amount > (lender?.cash ?? 0) ? `${nameOf(to)} chỉ có ${money(lender?.cash ?? 0)}` : open >= 2 ? "Bạn đã vay tối đa 2 khoản" : null;
  const send = async () => {
    if (await run({ type: "loan", to, amount, rate })) onClose();
  };
  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-3 text-lg font-bold text-amber-300">🏦 Vay tiền người chơi</h2>
      {others.length === 0 ? (
        <p className="text-sm">Không còn ai để vay.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/60">Vay của</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1.5">
              {others.map((p) => (
                <option key={p.id} value={p.id} className="text-black">
                  {nameOf(p.id)} ({money(p.cash)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-white/60">Số tiền vay</span>
            <input
              type="number"
              min={10}
              max={lender?.cash ?? 0}
              step={10}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="min-h-9 w-24 rounded-md bg-white/10 px-2 py-1 font-mono text-sm"
            />
            <span className="text-white/40">tr</span>
          </label>
          <div role="radiogroup" aria-label="Lãi suất" className="flex items-center gap-2 text-xs">
            <span className="text-white/60">Lãi</span>
            {LOAN_RATES.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={rate === r}
                onClick={() => setRate(r)}
                className={cn("min-h-9 rounded-lg border px-3 font-semibold", rate === r ? "border-amber-300 bg-amber-400/20 text-amber-200" : "border-white/20 hover:bg-white/10")}
              >
                {r}%
              </button>
            ))}
          </div>
          <p className="rounded-lg bg-white/5 px-3 py-2 text-xs">
            Sau <b>{LOAN_TURNS} lượt</b> của bạn phải trả <b className="text-base text-amber-300">{money(owed)}</b> (gốc {money(amount)} + lãi {money(owed - amount)}). Không đủ tiền thì phải bán / thế chấp hoặc phá sản.
          </p>
          {bad && <p className="text-xs text-rose-300">{bad}</p>}
          <button onClick={() => void send()} disabled={!!bad} className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-40">
            Gửi lời xin vay
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Trading ────────────────────────────────────────────────────────

function TradeCard({
  trade,
  nameOf,
  incoming,
  outgoing,
  deadline,
  onAnswer,
}: {
  trade: NonNullable<TPGameView["trade"]>;
  nameOf: (id: string) => string;
  incoming: boolean;
  outgoing: boolean;
  deadline: number;
  onAnswer: (accept: boolean) => void;
}) {
  const seconds = useSecondsLeft()(deadline) ?? 0;
  const side = (s: TradeSide) =>
    [...s.props.map((p) => BOARD[p].name), s.cash ? money(s.cash) : null].filter(Boolean).join(", ") || "không gì";
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("rounded-2xl p-3 text-sm text-white shadow-lg", incoming ? "bg-amber-950/95 ring-2 ring-amber-300" : "bg-emerald-950/90")}
    >
      <p className="mb-1 font-semibold">
        🤝 {nameOf(trade.from)} → {nameOf(trade.to)} <span className="font-mono text-xs text-white/60">({seconds}s)</span>
      </p>
      <p className="text-xs">
        <span className="text-white/60">Đưa:</span> {side(trade.give)}
      </p>
      <p className="text-xs">
        <span className="text-white/60">Đổi lấy:</span> {side(trade.get)}
      </p>
      {incoming && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onAnswer(true)} className="flex-1 rounded-lg bg-emerald-500 px-3 py-1 font-semibold max-sm:min-h-10 text-black hover:bg-emerald-400">
            Đồng ý
          </button>
          <button onClick={() => onAnswer(false)} className="flex-1 rounded-lg border border-white/30 px-3 py-1 hover:bg-white/10 max-sm:min-h-10">
            Từ chối
          </button>
        </div>
      )}
      {outgoing && (
        <button onClick={() => onAnswer(false)} className="mt-2 w-full rounded-lg border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
          Rút lời mời
        </button>
      )}
    </motion.div>
  );
}

function TradeModal({ g, meId, nameOf, run, onClose }: { g: TPGameView; meId: string; nameOf: (id: string) => string; run: Act; onClose: () => void }) {
  const others = g.players.filter((p) => p.id !== meId && !p.bankrupt);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);
  const me = g.players.find((p) => p.id === meId);
  const them = g.players.find((p) => p.id === to);

  // Built lots trade too — the houses go with the land.
  const tradable = (owner: string) =>
    Object.entries(g.deeds)
      .filter(([, d]) => d.owner === owner)
      .map(([pos]) => Number(pos))
      .sort((a, b) => a - b);

  const toggle = (list: number[], set: (v: number[]) => void, pos: number) => set(list.includes(pos) ? list.filter((x) => x !== pos) : [...list, pos]);

  const Picker = ({ owner, list, set }: { owner: string; list: number[]; set: (v: number[]) => void }) => {
    const props = tradable(owner);
    if (!props.length) return <p className="text-xs text-white/50">Không có đất để đổi.</p>;
    return (
      <div className="flex flex-wrap gap-1">
        {props.map((pos) => {
          const sq = BOARD[pos];
          const on = list.includes(pos);
          return (
            <button
              key={pos}
              onClick={() => toggle(list, set, pos)}
              aria-pressed={on}
              className={cn(
                "min-h-8 rounded-md px-2 py-1 text-xs font-semibold text-black transition-[opacity,box-shadow]",
                on ? "ring-2 ring-white ring-offset-1 ring-offset-[#0c2233]" : "opacity-55 saturate-50 hover:opacity-80",
              )}
              style={{ background: sq.kind === "prop" ? GROUP_COLORS[sq.group] : "#e5e7eb" }}
            >
              {on && "✓ "}
              {sq.name}
              {g.deeds[pos].houses > 0 && ` ${g.deeds[pos].houses === MAX_HOUSES ? "🏨" : `🏠${g.deeds[pos].houses}`}`}
              {g.deeds[pos].mortgaged && " (TC)"}
            </button>
          );
        })}
      </div>
    );
  };

  const send = async () => {
    if (await run({ type: "trade", to, give: { props: give, cash: giveCash }, get: { props: get, cash: getCash } })) onClose();
  };

  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-3 text-lg font-bold text-amber-300">🤝 Đổi đất / mua bán</h2>
      {others.length === 0 ? (
        <p className="text-sm">Không còn ai để đổi.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/60">Đổi với</span>
            <select
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setGet([]);
                setGetCash(0);
              }}
              className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1.5"
            >
              {others.map((p) => (
                <option key={p.id} value={p.id} className="text-black">
                  {nameOf(p.id)} ({money(p.cash)})
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="mb-1 text-xs text-white/60">Bạn đưa</p>
            <Picker owner={meId} list={give} set={setGive} />
            <CashInput value={giveCash} max={me?.cash ?? 0} onChange={setGiveCash} />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/60">Bạn nhận từ {nameOf(to)}</p>
            <Picker owner={to} list={get} set={setGet} />
            <CashInput value={getCash} max={them?.cash ?? 0} onChange={setGetCash} />
          </div>
          <p className="text-xs text-white/50">Đất đang thế chấp (TC) chuyển nguyên trạng. Người kia có 30 giây để trả lời.</p>
          <button
            onClick={() => void send()}
            disabled={!to || (!give.length && !get.length)}
            className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
          >
            Gửi lời mời
          </button>
        </div>
      )}
    </Modal>
  );
}

function CashInput({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-1 flex items-center gap-2 text-xs">
      <span className="text-white/60">+ tiền</span>
      <input
        type="number"
        min={0}
        max={max}
        step={10}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))))}
        className="min-h-9 w-24 rounded-md bg-white/10 px-2 py-1 font-mono"
      />
      <span className="text-white/40">tr (tối đa {money(max)})</span>
    </label>
  );
}

// ─── Waiting / results ──────────────────────────────────────────────

function Waiting({ view, me, act, nameOf }: { view: TPRoomView; me: TPSeatView | null; act: Act; nameOf: (id: string) => string }) {
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
      <TableSettings view={view} isHost={isHost} act={act} className="mb-3 max-sm:hidden short:hidden" />
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

/** The table rules (host edits, everyone else reads). */
/** One-tap rule sets: what the group usually plays with 2 players / with more. */
const RULE_PRESETS = {
  two: { label: "⚡ Luật 2 người", hint: "Dừng Khởi hành ×2 · đến khi còn 1 người · 45 giây/bước", rules: { doubleGo: true, timeLimit: 0, stepSeconds: 45 } },
  many: {
    label: "⚡ Luật 3+ người",
    hint: "Như 2 người + ván 45 phút · xây theo chuỗi · không cần đủ nhóm (tối đa 3 nhà)",
    rules: { doubleGo: true, timeLimit: 45, stepSeconds: 45, buildRule: "chain" as const, needGroup: false },
  },
};

function TableSettings({ view, isHost, act, className }: { view: TPRoomView; isHost: boolean; act: Act; className?: string }) {
  const count = view.seats.filter(Boolean).length;
  const suggested = count > 2 ? "many" : "two";
  return (
    <div className={className}>
      <div className="mb-2 rounded-lg bg-white/50 p-2 text-emerald-950">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900/60">Luật nhanh</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(RULE_PRESETS) as (keyof typeof RULE_PRESETS)[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={!isHost}
              title={RULE_PRESETS[k].hint}
              onClick={() => void act({ type: "settings", ...RULE_PRESETS[k].rules })}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-9",
                k === suggested ? "border-emerald-700 bg-emerald-700 text-white enabled:hover:bg-emerald-800" : "border-emerald-900/25 bg-white enabled:hover:bg-emerald-50",
              )}
            >
              {RULE_PRESETS[k].label}
              {k === suggested && <span className="ml-1 font-normal opacity-80">(hợp với {count} người)</span>}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-emerald-900/60">{RULE_PRESETS[suggested].hint}</p>
      </div>
        <SettingsTabs
          light
          className="text-emerald-950"
          tabs={[
            {
              id: "money",
              label: "💰 Tiền",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Tiền khởi đầu</span>
                    <select
                      value={view.settings.startCash}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", startCash: Number(e.target.value) })}
                      className={SELECT}
                    >
                      {START_CASH_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {money(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SettingSelect
                    label="Qua Khởi hành nhận"
                    value={view.settings.goSalary ?? GO_SALARY}
                    options={GO_SALARY_OPTIONS.map((v) => [v, money(v)])}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", goSalary: v })}
                  />
                  <Toggle
                    label={`Dừng đúng Khởi hành nhận gấp đôi (${money((view.settings.goSalary ?? GO_SALARY) * 2)})`}
                    checked={!!view.settings.doubleGo}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", doubleGo: v })}
                  />
                  <Toggle
                    label="Quỹ Nghỉ chân ☕: thuế & tiền phạt dồn vào, ai dừng đó hốt hết"
                    checked={!!view.settings.parkingPot}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", parkingPot: v })}
                  />
                  <SettingSelect
                    label="Phí chuộc thế chấp"
                    value={view.settings.unmortgageFee ?? 10}
                    options={UNMORTGAGE_FEE_OPTIONS.map((v) => [v, v ? `+${v}%` : "Không phí"])}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", unmortgageFee: v })}
                  />
                  <SettingSelect
                    label="Bán đất cho ngân hàng được"
                    value={view.settings.landSalePct ?? 70}
                    options={LAND_SALE_OPTIONS.map((v) => [v, `${v}% giá đất`])}
                    disabled={!isHost || !view.settings.sellLand}
                    onChange={(v) => void act({ type: "settings", landSalePct: v })}
                  />
                </div>
              ),
            },
            {
              id: "map",
              label: "🗺️ Bản đồ",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Kích thước bản đồ</span>
                    <select
                      value={view.settings.map ?? "std"}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", map: e.target.value as MapSize })}
                      className={SELECT}
                    >
                      {MAP_SIZES.map((m) => (
                        <option key={m} value={m}>
                          {MAP_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] leading-snug text-emerald-900/60">
                    Bản đồ lớn thêm ô giữa các cạnh: thêm đất cho các nhóm màu (Sóc Trăng, Pleiku, Mộc Châu, Cát Bà… ), thêm ô Cơ hội / Khí vận và thuế. Đổi trước khi bắt đầu ván.
                  </p>
                </div>
              ),
            },
            {
              id: "time",
              label: "⏱️ Lượt",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Giới hạn ván</span>
                    <select
                      value={view.settings.timeLimit}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", timeLimit: Number(e.target.value) })}
                      className={SELECT}
                    >
                      {TIME_LIMIT_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v ? `${v} phút` : "Đến khi còn 1 người"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span>Thời gian mỗi bước</span>
                    <select
                      value={view.settings.stepSeconds ?? 30}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", stepSeconds: Number(e.target.value) })}
                      className={SELECT}
                    >
                      {STEP_SECONDS_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v} giây
                        </option>
                      ))}
                    </select>
                  </label>
                  <Toggle
                    label="Tung đôi được tung tiếp (đôi 3 lần liền vào tù)"
                    checked={view.settings.doubleRoll !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", doubleRoll: v })}
                  />
                  <Toggle
                    label="Đang ở tù vẫn thu tiền thuê"
                    checked={view.settings.jailRent !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", jailRent: v })}
                  />
                </div>
              ),
            },
            {
              id: "house",
              label: "🏠 Luật nhà",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Luật xây nhà</span>
                    <select
                      value={view.settings.buildRule ?? "even"}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", buildRule: e.target.value as "even" | "chain" })}
                      className={SELECT}
                    >
                      <option value="even">Xây đều</option>
                      <option value="chain">Xây theo chuỗi</option>
                    </select>
                  </label>
                  <p className="text-[11px] leading-snug text-emerald-900/60">{buildRuleText(view.settings)}</p>
                  <Toggle
                    label="Phải đủ cả nhóm màu mới được xây"
                    checked={view.settings.needGroup !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", needGroup: v })}
                  />
                  <Toggle
                    label="Giá nhà tăng dần (căn sau +25%, khách sạn ×2)"
                    checked={view.settings.risingCost !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", risingCost: v })}
                  />
                  <Toggle
                    label={`Cho bán đất cho ngân hàng (${view.settings.landSalePct ?? 70}% giá, đất về chợ)`}
                    checked={!!view.settings.sellLand}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", sellLand: v })}
                  />
                  <label className="flex items-center justify-between gap-2">
                    <span>Đất của người phá sản</span>
                    <select
                      value={view.settings.bankruptTo ?? "bank"}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", bankruptTo: e.target.value as "bank" | "creditor" })}
                      className={SELECT}
                    >
                      <option value="bank">Về ngân hàng — mua lại được</option>
                      <option value="creditor">Về tay chủ nợ</option>
                    </select>
                  </label>
                </div>
              ),
            },
            {
              id: "points",
              label: "🏆 Điểm",
              content: (
                <RankPointsPicker
                  first={view.settings.first ?? 2}
                  second={view.settings.second ?? 1}
                  players={count}
                  editable={isHost}
                  onChange={(v) => void act({ type: "settings", ...v })}
                  className="[&_select]:bg-white [&_select]:text-emerald-950"
                />
              ),
            },
          ]}
        />
      {!isHost && <p className="mt-1 text-xs text-emerald-900/50">Chỉ chủ bàn đổi được luật.</p>}
    </div>
  );
}

const SELECT = "rounded-md border border-emerald-900/20 bg-white px-2 py-0.5 disabled:opacity-60 max-sm:min-h-9 short:min-h-8";

function SettingSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: [number, string][];
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SELECT}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center justify-between gap-2", !disabled && "cursor-pointer")}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 accent-emerald-700" />
    </label>
  );
}

// ─── Rules ──────────────────────────────────────────────────────────

export function TyPhuRules() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>2–6 người, mỗi người bắt đầu với số tiền chủ bàn chọn (mặc định 1.500tr). Mỗi vòng qua Khởi hành nhận 200tr (chủ bàn chỉnh được).</li>
      <li>Tung 2 xúc xắc rồi đi. Tung đôi được tung tiếp; đôi 3 lần liền thì vào tù.</li>
      <li>Dừng ở đất, sân bay hay công ty chưa có chủ thì được mua. Không mua thì đất vẫn thuộc ngân hàng.</li>
      <li>Dừng ở đất người khác thì trả tiền thuê. Có đủ cả nhóm màu thì tiền thuê ×2 và được xây nhà — xây đều từng ô, 4 nhà rồi lên khách sạn.</li>
      <li>
        Luật nhà (chủ bàn chọn): <b>xây đều</b>, hoặc <b>xây theo chuỗi</b> — nhà 1 xây bình thường, nhà 2 cần ít nhất 2 ô trong nhóm đã có nhà 1, nhà 3 cần 2 ô đã có
        nhà 2, nhà 4 cần mọi ô trong nhóm có 3 nhà, khách sạn cần mọi ô có 4 nhà. Có thể bỏ điều kiện đủ nhóm màu.
      </li>
      <li>Mỗi căn nhà xây sau trên cùng ô đắt hơn căn trước 25% (khách sạn gấp đôi giá nhà đầu; chủ bàn có thể tắt để căn nào cũng một giá); bán lại được nửa giá căn đó. Nếu bàn cho phép, bán đất (không còn nhà) cho ngân hàng được 70% giá (chỉnh được 50–90%) — nhiều hơn thế chấp nhưng mất đất, đất về chợ cho ai dừng ở đó mua lại.</li>
      <li>Phá sản: tiền còn lại về tay chủ nợ; đất trả về ngân hàng để người khác mua như bình thường (hoặc về tay chủ nợ, tuỳ luật bàn).</li>
      <li>Sân bay: càng nhiều sân bay càng thu nhiều (25 → 200tr). Điện / nước: tổng xúc xắc × 4, có cả hai thì × 10.</li>
      <li>Thiếu tiền: bán nhà (được nửa giá) hoặc thế chấp đất (nhận 50% giá, chuộc lại phải trả thêm 10% — chủ bàn chỉnh được). Không xoay nổi thì phá sản.</li>
      <li>Ở tù: tung đôi để ra, hoặc nộp {money(JAIL_FINE)} / dùng thẻ ra tù trước khi tung. Sau 3 lượt thì phải nộp phạt.</li>
      <li>Đổi đất với nhau bất cứ lúc nào (kèm tiền nếu muốn); đất có nhà đổi được, nhà đi theo đất. Người còn lại cuối cùng — hoặc giàu nhất khi hết giờ — thắng.</li>
      <li>Mỗi bước có thời gian chủ bàn chọn (mặc định 30 giây); hết giờ hoặc mất kết nối thì máy tự đi (không mua gì).</li>
    </ul>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-3 text-lg font-bold text-amber-300">📖 Luật Cờ Tỷ Phú</h2>
      <TyPhuRules />
    </Modal>
  );
}

/**
 * Dialog: a bottom sheet on phones (backdrop above it to tap away, a full-width "Đóng" bar at the bottom),
 * centred from `sm` up. The ✕ stays put while the content scrolls; Esc closes too.
 */
function Modal({ children, onClose, dark }: { children: React.ReactNode; onClose: () => void; dark?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Portalled to <body>: a dialog opened from inside the board centre must not be trapped by its overflow / filter containing block.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className={cn(
          "relative flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl text-left shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl",
          dark ? "border border-white/10 bg-[#0c2233] text-sky-50" : "bg-[#f4efe1]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={cn(
            "absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full text-lg leading-none shadow",
            dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/35 text-white hover:bg-black/50",
          )}
          aria-label="Đóng"
        >
          ✕
        </button>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", dark && "p-5 [&>h2:first-child]:pr-10")}>{children}</div>
        <button
          onClick={onClose}
          className={cn(
            "shrink-0 border-t py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold sm:hidden",
            dark ? "border-white/10 bg-black/20 text-sky-100" : "border-emerald-900/15 bg-white/60 text-emerald-950",
          )}
        >
          Đóng
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Pick my token's emoji and colour (also the colour of my houses). Ones another player holds are greyed out. */
function PiecePicker({ seats, meId, act, onClose }: { seats: (TPSeatView | null)[]; meId: string; act: Act; onClose: () => void }) {
  const me = seats.find((s) => s?.id === meId);
  const others = seats.filter((s): s is TPSeatView => !!s && s.id !== meId);
  const emojiTaken = (e: string) => others.some((o) => pieceOfSeat(o).emoji === e);
  const colorTaken = (c: string) => others.some((o) => pieceOfSeat(o).color === c);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!me) return null;
  const mine = pieceOfSeat(me);
  const choose = (emoji: string, color: string) => void act({ type: "pick", emoji, color });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#111013] p-5 text-white shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-amber-300">Quân cờ &amp; màu nhà</h2>
        <p className="mb-3 text-xs text-white/55">Không trùng với người chơi khác — ô mờ là đã có người dùng.</p>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full border-2 border-white text-2xl" style={{ background: mine.color }}>
            {mine.emoji}
          </span>
          <span className="text-sm text-white/70">Quân của bạn</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Quân cờ">
          {PIECE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={mine.emoji === e}
              disabled={emojiTaken(e)}
              onClick={() => choose(e, mine.color)}
              className={cn("grid size-10 place-items-center rounded-lg border text-xl disabled:cursor-not-allowed disabled:opacity-25", mine.emoji === e ? "border-amber-300 bg-amber-400/20" : "border-white/15 hover:bg-white/10")}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Màu">
          {PIECE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={mine.color === c}
              aria-label={c}
              disabled={colorTaken(c)}
              onClick={() => choose(mine.emoji, c)}
              className={cn("size-8 rounded-full border-2 disabled:cursor-not-allowed disabled:opacity-25", mine.color === c ? "border-white" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}

/** Game log, newest first, coloured by tone. */
function LogList({ log, className }: { log: TPGameView["log"]; className?: string }) {
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
function LogModal({ log, onClose }: { log: TPGameView["log"]; onClose: () => void }) {
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
