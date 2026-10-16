"use client";

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { toast as showToast } from "sonner";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { useGameRoom, useRoomLooks } from "@/components/games/gameClient";
import { PinchZoom } from "@/components/games/PinchZoom";
import { useHotkeys } from "@/components/games/useHotkeys";
import { SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { ScoreboardModal } from "@/components/tienlen/Scoreboard";
import { boardOf } from "@/lib/typhu/board";
import { TYPHU_WS_PATH, type TPGameView, type TPRoomView, type TPSeatView } from "@/lib/typhu/protocol";
import { type Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { Celebration } from "@/components/game-ui/Celebration";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
import { GamePanel } from "@/components/game-ui/GamePanel";
import { GameThemeScope } from "@/components/game-ui/theme";
import { boardRef } from "./board-ref";
import { NowProvider, NowClock } from "./now";
import { TOKENS, money, pieceOfSeat, type Act } from "./shared";
import { seatTokens } from "./tokens";
import { useWalkingTokens } from "./board/walk";
import { usePhonePortrait, useTyPhuPrefs } from "./prefs";
import { TableOptions } from "./TableOptions";
import { isCompact, sideCellPx } from "./board/layout";
import { type CellToken, NO_TOKENS, Cell } from "./board/Cell";
import { ActionBar } from "./centre/ActionBar";
import { Centre } from "./centre/Centre";
import { AssetPanel } from "./panels/AssetPanel";
import { BankruptOverlay, BuildOverlay, CardOverlay } from "./fx/Overlays";
import { PlayerRow } from "./players/PlayerRow";
import { PlayerStrip } from "./players/PlayerStrip";
import { SquareModal } from "./dialogs/SquareDialog";
import { LoanModal } from "./dialogs/LoanDialog";
import { TradeModal } from "./dialogs/TradeDialog";
import { RulesModal } from "./dialogs/RulesDialog";
import { LogList, LogModal } from "./dialogs/LogDialog";
import { LookDialog } from "./dialogs/LookDialog";
import { Waiting } from "./waiting/Waiting";
// Only needed before a game starts / after it ends (and Base UI tabs are heavy): fetched on demand.
const TableSettings = lazy(() => import("./waiting/TableSettings").then((m) => ({ default: m.TableSettings })));

export { money, pieceOfSeat, TOKENS } from "./shared";
export { TyPhuRules } from "./dialogs/RulesDialog";

const SCORE_NOTE =
  "Điểm theo thứ hạng: người còn trụ lại (hoặc giàu nhất khi hết giờ) Nhất, ai phá sản trước xếp sau. Chủ bàn chọn điểm Nhất / Nhì, các hạng cuối trừ tương ứng, tổng mỗi ván luôn bằng 0.";

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
  boardRef.current = boardOf(g ? g.map ?? "std" : view.settings.map);
  const playing = g?.status === "playing";
  const spectator = view.role === "spectator";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const mine = g?.players.find((p) => p.id === view.meId) ?? null;
  const myTurn = !!mine && playing && !mine.bankrupt && g?.turn === view.meId;

  const seatOf = (id: string) => view.seats.find((s) => s?.id === id) ?? null;
  const nameOf = (id: string) =>
    seatOf(id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";
  // Tokens wear each player's site look (icon + colour); a colour already taken at the table is swapped for a free one.
  const looks = useRoomLooks();
  const seated = view.seats.filter((s): s is TPSeatView => !!s);
  const tokens = seatTokens(seated, looks, (id) => pieceOfSeat(seated.find((s) => s.id === id)!));
  const tokenOf = (id: string) => tokens.get(id) ?? TOKENS[(g?.players.findIndex((p) => p.id === id) ?? 0) % TOKENS.length];
  const [editingLook, setEditingLook] = useState(false);
  // Colours of the seats before mine: picking one of them gets me a free colour on the board instead.
  const myIndex = seated.findIndex((s) => s.id === view.meId);
  const colorsBeforeMe = myIndex < 0 ? [] : seated.slice(0, myIndex).map((s) => tokenOf(s.id).color);

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
  const [showTrade, setShowTrade] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showLog, setShowLog] = useState(false);
  useHotkeys({ l: g ? () => setShowLog((v) => !v) : undefined }, true, ["l"]);
  const [showRules, setShowRules] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  // Phone strip: whose details are open (a seat id).
  const [viewPlayer, setViewPlayer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Compact squares (no names): phones held upright only, and only while the squares are narrower than 64 px (measured on the board grid).
  const boardEl = useRef<HTMLDivElement>(null);
  const phonePortrait = usePhonePortrait();
  // Action buttons: this viewer's choice (phones held upright only); everywhere else they stay in the board centre.
  const [prefs, setPrefs] = useTyPhuPrefs();
  const placement = phonePortrait && prefs.actions === "bottom" ? "bottom" : "center";
  // Minimal view (phones held upright only): no square names, no players panel (the chips above the board stay).
  const minimal = phonePortrait && prefs.view === "minimal";
  const [showBuild, setShowBuild] = useState(false);
  // Height of the bottom bar (it grows when the buttons wrap): the page leaves that much room under its content.
  const [barHeight, setBarHeight] = useState(120);
  const [narrow, setNarrow] = useState(false);
  const compact = phonePortrait && narrow;
  const edge = boardRef.current.length / 4;
  // Layout effect: the first paint on a phone already has the compact squares.
  useLayoutEffect(() => {
    const el = boardEl.current;
    if (!el) return;
    // Measure now (before the first paint) as well as on every resize; clientWidth is the grid without its border, like contentRect.
    setNarrow(isCompact(sideCellPx(el.clientWidth, edge)));
    const ro = new ResizeObserver(([entry]) => setNarrow(isCompact(sideCellPx(entry.contentRect.width, edge))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [edge]);
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
  const ownsLand = !!mine && Object.values(g?.deeds ?? {}).some((d) => d.owner === mine.id);
  // Same condition as the Đổi đất / Vay buttons in the board centre.
  const canTrade = view.role === "player" && !!mine && !mine.bankrupt;
  const canPropose = canTrade && !g?.trade && !g?.loan;
  // Chip tap: everybody gets their details (mine holds the piece picker, and "Tài sản" while my turn lets the assets open).
  const openPlayer = (id: string) => setViewPlayer(id);

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

  // The Kích button asks for a second tap itself (GameButton confirm) — window.confirm is blocked in some in-app browsers.
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

  // The bottom bar shows the turn line to everybody while a game is on; the page leaves room below for it.
  const showBar = placement === "bottom" && !!g && g.status !== "ended";
  return (
    <GameThemeScope game="typhu" className="contents">
    <div className={cn("relative isolate mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-3 px-2 xl:max-w-none pt-2 sm:px-4 sm:pt-3 short:gap-2 short:pt-1.5", !showBar && "pb-[max(1rem,env(safe-area-inset-bottom))]")} style={showBar ? { paddingBottom: barHeight + 8 } : undefined}>
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
            {/* Not in `extra`: on phones that folds into the ⋯ menu, which closes (and unmounts the dialog) when tapped. */}
            {phonePortrait && <TableOptions prefs={prefs} onChange={setPrefs} />}
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
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 lg:grid-cols-[minmax(0,calc(100dvh-5rem))_20rem] lg:justify-center lg:gap-4 xl:grid-cols-[minmax(0,calc(100dvh-5rem))_22rem] short:grid-cols-[auto_minmax(0,1fr)] short:items-start short:gap-2">
        {/* Phones held upright: the players above the board, the short log and quick buttons below it. */}
        {minimal && <PlayerStrip seats={view.seats} g={g} meId={view.meId} tokenOf={tokenOf} onOpen={openPlayer} />}
        {/* Board */}
        <div className="relative mx-auto w-full max-w-[min(100%,calc(100dvh-7rem))] lg:max-w-none short:w-[calc(100dvh-3.75rem)] short:max-w-none">
          <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
          <PinchZoom className="rounded-xl shadow-2xl">
          <div
            ref={boardEl}
            className="grid aspect-square w-full gap-[2px] rounded-xl border-4 border-[#1e3a2f] bg-[#1e3a2f] shadow-2xl"
            style={{ gridTemplateColumns: `1.6fr repeat(${boardRef.current.length / 4 - 1}, 1fr) 1.6fr`, gridTemplateRows: `1.6fr repeat(${boardRef.current.length / 4 - 1}, 1fr) 1.6fr` }}
          >
            {boardRef.current.map((sq, i) => {
              const here = hereByPos.get(i);
              const deed = g?.deeds[i];
              return (
                <Cell
                  key={i}
                  index={i}
                  edge={boardRef.current.length / 4}
                  sq={sq}
                  deed={deed}
                  pot={sq.kind === "parking" ? g?.pot ?? 0 : 0}
                  owner={deed ? tokenOf(deed.owner) : null}
                  here={here ?? NO_TOKENS}
                  highlight={!!here?.some((t) => t.turn)}
                  compact={compact}
                  onOpen={setOpenSquare}
                />
              );
            })}
            {/* Centre */}
            <div className="relative flex flex-col items-center justify-center-safe gap-2 overflow-y-auto overflow-x-hidden bg-[#0b1d3a] bg-cover bg-center p-[2%] text-emerald-950 short:gap-1 short:p-[1.5%]" style={{ gridColumn: `2 / ${boardRef.current.length / 4 + 1}`, gridRow: `2 / ${boardRef.current.length / 4 + 1}`, backgroundImage: "url(/games/typhu/center.webp)" }}>
              <CardOverlay card={cardFx} nameOf={nameOf} onClose={() => setCardFx(null)} />
              <BuildOverlay fx={buildFx} />
              <BankruptOverlay fx={bankruptFx} />
              <div className="flex max-h-full min-h-0 w-full max-w-md flex-none flex-col items-center justify-center-safe gap-2 overflow-y-auto rounded-[1.5rem] bg-[#dff1e5]/60 p-1.5 shadow-xl ring-1 ring-amber-300/50 backdrop-blur-[2px] sm:p-2.5 short:gap-1 short:p-1">
              {!g || g.status === "ended" ? (
                <Waiting view={view} me={me} act={act} nameOf={nameOf} />
              ) : (
                <Centre
                  placement={placement}
                  showBuild={showBuild}
                  setShowBuild={setShowBuild}
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

        {g && (
          <div className="flex flex-col gap-2 lg:hidden short:hidden">
            {g.log.length > 0 && (
              <button type="button" onClick={() => setShowLog(true)} aria-label="Xem toàn bộ diễn biến" className="flex flex-col gap-0.5 rounded-xl text-left text-xs text-white/80">
                {g.log.slice(-3).reverse().map((e) => (
                  <span key={e.id} className="truncate rounded bg-white/10 px-2 py-1">
                    {e.text}
                  </span>
                ))}
              </button>
            )}
            {playing && (
              <div className="flex flex-wrap gap-2">
                {ownsLand && myTurn && !assetsOpen && (
                  <GameButton size="sm" onClick={openAssets}>
                    💰 Tài sản
                  </GameButton>
                )}
                {canPropose && (
                  <>
                    <GameButton size="sm" onClick={() => setShowTrade(true)}>
                      🤝 Đổi đất
                    </GameButton>
                    <GameButton size="sm" onClick={() => setShowLoan(true)}>
                      🏦 Vay
                    </GameButton>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Side panel */}
        {/* Bottom padding below lg: lets the log scroll clear of the floating chat / emoji buttons. */}
        <aside className="flex flex-col gap-3 max-lg:pb-14 short:max-h-[calc(100dvh-3.75rem)] short:gap-2 short:overflow-y-auto">
          {assetsOpen && g && mine && (
            <div ref={assetsRef} className="scroll-mt-2" style={showBar ? { scrollMarginBottom: barHeight + 8 } : undefined}>
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
              <Suspense fallback={null}>
                <TableSettings view={view} isHost={!!me?.isHost && view.role === "player"} act={act} />
              </Suspense>
            </div>
          )}
          <GamePanel className={cn("p-3 sm:p-3 short:p-2", minimal && "hidden")}>
            <ul ref={playersRef} aria-label="Người chơi" className="grid grid-cols-2 gap-2 lg:grid-cols-1">
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
                      onEditLook={s.id === view.meId ? () => setEditingLook(true) : undefined}
                      onKick={me?.isHost && !s.connected && !s.kicked ? () => void kick(s) : undefined}
                    />
                  );
                })}
            </ul>
          </GamePanel>

          {g && !!g.loans?.length && (
            <GamePanel title="🏦 Khoản vay" className="p-3 sm:p-3">
              <ul ref={loansRef} className="space-y-1 text-xs">
                {g.loans.map((l) => (
                  <li key={l.id} className={cn("rounded bg-white/5 px-2 py-1", l.borrower === view.meId && "ring-1 ring-rose-300/60")}>
                    <b>{nameOf(l.borrower)}</b> nợ <b>{nameOf(l.lender)}</b> <b className="text-amber-200">{money(l.owed)}</b>
                    <span className="text-white/50"> (gốc {money(l.amount)} + {l.rate}%) · còn {l.left} lượt</span>
                  </li>
                ))}
              </ul>
            </GamePanel>
          )}

          {g && (
            <GamePanel
              title="Diễn biến"
              className="p-3 sm:p-3 max-lg:hidden short:block"
              actions={
                <button onClick={() => setShowLog(true)} className="rounded px-1.5 py-0.5 text-[11px] font-normal text-sky-200 hover:bg-white/10 max-sm:min-h-8">
                  Xem toàn bộ ({g.log.length}) ↗
                </button>
              }
            >
              <LogList log={g.log} className="max-h-64" />
            </GamePanel>
          )}

        </aside>
      </div>

      {viewPlayer && seatOf(viewPlayer) && (
        <GameDialog
          open
          onOpenChange={(o) => !o && setViewPlayer(null)}
          title={nameOf(viewPlayer)}
          footer={
            <>
              {viewPlayer === view.meId && mine && myTurn && !mine.bankrupt && (
                <GameButton
                  size="sm"
                  onClick={() => {
                    setViewPlayer(null);
                    openAssets();
                  }}
                >
                  💰 Tài sản
                </GameButton>
              )}
              <GameButton size="sm" onClick={() => setViewPlayer(null)}>
                Đóng
              </GameButton>
            </>
          }
        >
          <ul>
            <PlayerRow
              seat={seatOf(viewPlayer)!}
              p={g?.players.find((x) => x.id === viewPlayer) ?? null}
              g={g}
              self={viewPlayer === view.meId}
              token={tokenOf(viewPlayer)}
              isTurn={g?.turn === viewPlayer && playing}
              reactions={reactionsFor(viewPlayer)}
              onOpen={(pos) => {
                setViewPlayer(null);
                setOpenSquare(pos);
              }}
              onEditLook={viewPlayer === view.meId ? () => { setViewPlayer(null); setEditingLook(true); } : undefined}
              onKick={me?.isHost && !seatOf(viewPlayer)!.connected && !seatOf(viewPlayer)!.kicked ? () => { setViewPlayer(null); void kick(seatOf(viewPlayer)!); } : undefined}
            />
          </ul>
        </GameDialog>
      )}

      {showBar && g && (
        <ActionBar placement="bottom" g={g} view={view} myTurn={myTurn} mine={mine} busy={busy} run={run} nameOf={nameOf} assetsOpen={assetsOpen} onOpenAssets={openAssets} onBuild={() => setShowBuild(true)} onHeight={setBarHeight} />
      )}


      {editingLook && me && <LookDialog name={me.name} takenColors={colorsBeforeMe} onClose={() => setEditingLook(false)} />}

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
      <Celebration show={g?.status === "ended"} playing={!!playing} won={!!view.meId && g?.finished[0] === view.meId} title={g?.status === "ended" ? `🏆 ${nameOf(g.finished[0])} thắng` : undefined} />
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
    </GameThemeScope>
  );
}
