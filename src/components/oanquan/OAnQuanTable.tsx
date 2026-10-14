"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import { SettingsTabs } from "@/components/games/SettingsTabs";
import { MyTurnBadge, TurnRing, TurnTimerBorder } from "@/components/games/TurnIndicator";
import { useGameRoom } from "@/components/games/gameClient";
import { useHotkeys } from "@/components/games/useHotkeys";
import { SeatBubble, SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { DeltaBadge, ScoreboardModal, signed } from "@/components/tienlen/Scoreboard";
import { QUAN_NON_MIN, QUAN_VALUE_OPTIONS, TURN_SECONDS_OPTIONS, rowOf } from "@/lib/oanquan/board";
import { OANQUAN_WS_PATH, type OQGameView, type OQPlayerView, type OQRoomView, type OQSeatView } from "@/lib/oanquan/protocol";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { type BoardPlayer, OQBoard, SIDE_COLORS, type SowFrame, useSowReplay } from "./Board";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { WinCelebration } from "@/components/games/WinCelebration";

type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

const SCORE_NOTE =
  "Điểm theo thứ hạng (xếp theo điểm ván, bằng điểm thì chung hạng): hạng nhất nhận điểm Nhất, hạng nhì điểm Nhì, các hạng cuối bị trừ tương ứng; hai người hoà thì không ai được trừ điểm. Chủ bàn chọn điểm Nhất / Nhì.";

function localize(view: OQRoomView): OQRoomView {
  const g = view.current;
  if (!g?.deadline) return view;
  const skew = Date.now() - view.serverTime;
  return { ...view, current: { ...g, deadline: g.deadline + skew } };
}

function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

export default function OAnQuanTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, call } = useGameRoom<OQRoomView>(OANQUAN_WS_PATH, code, name, watch ? "watch" : "play", localize);
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
            <Link href={`/o-an-quan/${code}?watch=1`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black">
              Vào xem 👀
            </Link>
          )}
          <Link href="/o-an-quan" className="rounded-lg border border-white/25 px-4 py-2 font-semibold">
            Về sảnh
          </Link>
        </div>
      </div>
    );
  }
  if (!view) return <p className="flex min-h-[70vh] animate-pulse items-center justify-center text-amber-100/80">Đang kết nối bàn {code}…</p>;
  return (
    <>
      <Table view={view} reconnecting={status === "reconnecting"} act={act} toast={toast} />
      <ChatBox messages={view.chat} meId={view.meId} myName={name} onSend={(text) => act({ type: "chat", text })} onEmoji={(emoji) => void act({ type: "emoji", emoji })} row />
    </>
  );
}

function Table({ view, reconnecting, act, toast }: { view: OQRoomView; reconnecting: boolean; act: Act; toast: string | null }) {
  const g = view.current;
  const playing = g?.status === "playing";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const mine = g?.players.find((p) => p.id === view.meId) ?? null;
  const frame = useSowReplay(g);
  const animating = !!frame;
  const myTurn = !!mine && playing && g?.turn === view.meId;
  const canMove = myTurn && !animating;
  const now = useNow(!!playing);
  const nameOf = (id: string) => view.seats.find((s) => s?.id === id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";

  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setSelected(null), [g?.turn, g?.moves]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(id);
  }, [notice]);
  // "Rải quân" announcement when a row had to be reseeded.
  const reseedSeq = g?.lastReseed?.seq;
  const [reseedSeen, setReseedSeen] = useState(reseedSeq);
  if (reseedSeq !== reseedSeen) {
    setReseedSeen(reseedSeq);
    const r = g?.lastReseed;
    const via = r?.lenders?.map((l) => `${nameOf(l.id)} ${l.n}`).join(", ");
    if (r) setNotice(`${r.player === view.meId ? "Bạn" : nameOf(r.player)} hết dân trên hàng — rải quân 5 dân${r.borrowed ? ` (vay ${via || r.borrowed})` : ""}`);
  }

  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string): Reaction[] => live.filter((r) => r.playerId === id);

  const [copied, setCopied] = useState(false);
  const copyInvite = async () => {
    const url = new URL(`/o-an-quan/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };

  const kick = async (s: OQSeatView) => {
    // The Kích button asks for a second tap itself (window.confirm is blocked in some in-app browsers).
    await act({ type: "kick", playerId: s.id });
  };

  const sow = async (dir: 1 | -1) => {
    if (selected === null || !canMove) return;
    setBusy(true);
    const ok = await act({ type: "move", cell: selected, dir });
    setBusy(false);
    if (ok) setSelected(null);
  };

  const n = g?.players.length ?? 2;
  const bottomSide = mine?.side ?? 0;
  const bottomPlayer = g?.players.find((p) => p.side === bottomSide) ?? null;
  /** Everyone else, in turn order after the bottom player. */
  const others = (g?.players ?? []).filter((p) => p.side !== bottomSide).sort((a, b) => ((a.side - bottomSide + n) % n) - ((b.side - bottomSide + n) % n));
  const selectable = canMove && g && mine && !busy ? rowOf(mine.side).filter((c) => g.dan[c] > 0) : [];
  // Keyboard (desktop): 1–5 pick a square on your row (left → right), ←/A and →/D sow left/right (same guards as the
  // direction buttons), Esc clears the selection. Nothing fires while a dialog is open or a move is replaying.
  const myRow = mine ? rowOf(mine.side) : [];
  const pickKey = (i: number) => (myRow[i] !== undefined && selectable.includes(myRow[i]) ? () => setSelected((cur) => (cur === myRow[i] ? null : myRow[i])) : undefined);
  const sowKey = (dir: 1 | -1) => (selected !== null && canMove && !busy ? () => void sow(dir) : undefined);
  const clearKey = selected !== null && canMove && !showScores && !showRules ? () => setSelected(null) : undefined;
  useHotkeys({ "1": pickKey(0), "2": pickKey(1), "3": pickKey(2), "4": pickKey(3), "5": pickKey(4), ArrowLeft: sowKey(-1), a: sowKey(-1), ArrowRight: sowKey(1), d: sowKey(1), Escape: clearKey });
  const boardPlayers: BoardPlayer[] = (g?.players ?? []).map((p) => ({
    side: p.side,
    name: nameOf(p.id),
    isTurn: playing && g?.turn === p.id,
    out: p.out,
    self: p.id === view.meId,
  }));
  const ended = g?.status === "ended";
  const showResult = ended && !animating;
  const turnMs = view.settings.turnSeconds * 1000;
  const secondsLeft = g?.deadline ? Math.max(0, Math.ceil((g.deadline - now) / 1000)) : null;
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showResult) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showResult]);

  /** Player strips sit above/below the board; on sideways phones they move to the side column. */
  const panel = (p: OQPlayerView | null, className: string, compact = false) => {
    if (!p || !g) return null;
    const seat = view.seats.find((s) => s?.id === p.id) ?? null;
    return (
      <PlayerStrip
        key={p.id}
        className={className}
        compact={compact}
        p={p}
        g={g}
        name={nameOf(p.id)}
        seat={seat}
        self={p.id === view.meId}
        isTurn={playing && g.turn === p.id}
        secondsLeft={secondsLeft}
        frame={frame}
        reactions={reactionsFor(p.id)}
        onKick={me?.isHost && seat && !seat.connected && !seat.kicked && p.id !== view.meId ? () => void kick(seat) : undefined}
      />
    );
  };

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-3 px-2 pb-24 pt-2 sm:px-4 sm:pt-3 lg:pb-3 2xl:max-w-7xl short:gap-2 short:pb-16 short:pt-3">
      <WinCelebration show={g?.status === "ended"} playing={!!playing} won={!!mine && g?.status === "ended" && mine.rank === 0 && !!g.winner} title={g?.status === "ended" ? (g.winner ? `🏆 ${nameOf(g.winner)} thắng` : "🤝 Hoà") : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/o-an-quan" className={headerBtn}>
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
              <span className="whitespace-nowrap" title="Giá trị một quan khi tính điểm">
                👑 = {g.quanValue}
                <span className="hidden sm:inline"> dân</span>
              </span>
            )}
            {g?.quanNon && (
              <span className="hidden whitespace-nowrap min-[420px]:inline" title={`Ô quan còn quan mà dưới ${QUAN_NON_MIN} dân thì chưa ăn được`}>
                🌱 Quan non
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

      {!g ? (
        <div className="relative flex flex-1 items-center justify-center">
          <SpectatorReactions reactions={live} />
          <Waiting view={view} me={me} act={act} nameOf={nameOf} />
        </div>
      ) : (
        <div className="grid flex-1 content-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem] short:grid-cols-[minmax(0,1fr)_15rem] short:gap-2">
          <section className="relative flex min-w-0 flex-col gap-2.5 short:gap-1.5">
            <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
            {n > 2 ? <div className={cn("grid gap-1.5 short:hidden", n === 3 ? "grid-cols-2" : "grid-cols-3")}>{others.map((p) => panel(p, "", true))}</div> : panel(others[0] ?? null, "short:hidden")}

            <div
              className="relative mx-auto w-full px-0.5 py-2 short:py-1"
              style={n > 2 ? { maxWidth: `min(100%, max(16rem, calc((100dvh - 16rem) * ${n === 3 ? 1.11 : 1})))` } : undefined}
            >
              {canMove && <TurnTimerBorder deadline={g.deadline} totalMs={turnMs} now={now} radius={28} />}
              <TurnRing active={canMove} className={n > 2 ? "rounded-[1.8rem]" : "rounded-[2rem]"} />
              <OQBoard
                dan={frame?.dan ?? g.dan}
                quan={frame?.quan ?? g.quan}
                bottomSide={bottomSide}
                selectable={selectable}
                selected={canMove ? selected : null}
                onSelect={setSelected}
                onSow={(d) => void sow(d)}
                frame={frame}
                lastCell={g.lastMove?.cell ?? null}
                players={boardPlayers}
              />
            </div>

            {/* What to do now / direction picker (bigger targets than the arrows on the cup). */}
            <div className="flex min-h-11 flex-wrap items-center justify-center gap-2 text-sm">
              {showResult ? null : canMove ? (
                selected === null ? (
                  <span className="flex items-center gap-2">
                    <MyTurnBadge />
                    <span className="text-amber-100/85">Chọn một ô dân bên bạn</span>
                    <span className="hidden text-[11px] text-white/45 lg:inline [@media(pointer:coarse)]:hidden">Phím tắt: 1–5 = chọn ô (từ trái sang) · ←/A rải trái · →/D rải phải · Esc bỏ chọn</span>
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => void sow(-1)}
                      disabled={busy}
                      className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black shadow hover:bg-amber-300 disabled:opacity-40"
                    >
                      ⬅️ Rải trái
                      <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">←</kbd>
                    </button>
                    <button onClick={() => setSelected(null)} className="rounded-xl border border-white/25 px-3 py-2 text-xs hover:bg-white/10">
                      Bỏ chọn
                      <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">Esc</kbd>
                    </button>
                    <button
                      onClick={() => void sow(1)}
                      disabled={busy}
                      className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black shadow hover:bg-amber-300 disabled:opacity-40"
                    >
                      Rải phải ➡️
                      <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">→</kbd>
                    </button>
                  </>
                )
              ) : animating ? (
                <span className="text-amber-100/70">
                  {nameOf(frame.player)} đang rải{frame.hand > 0 ? ` — trên tay ${frame.hand} dân` : "…"}
                </span>
              ) : playing ? (
                <span className="text-amber-100/70">
                  Lượt của <b className="text-amber-200">{nameOf(g.turn ?? "")}</b>
                  {secondsLeft !== null && <span className={cn("ml-2 font-mono", secondsLeft <= 5 && "text-rose-400")}>⏱ {secondsLeft}s</span>}
                </span>
              ) : null}
            </div>

            {panel(bottomPlayer, "short:hidden")}

            {showResult && (
              <div ref={resultRef} className="flex scroll-mt-2 justify-center lg:hidden short:flex">
                <Waiting view={view} me={me} act={act} nameOf={nameOf} />
              </div>
            )}
          </section>

          <aside className="flex min-w-0 flex-col gap-3 short:gap-2">
            {showResult && (
              <div className="hidden lg:block short:hidden [&>div]:max-w-none">
                <Waiting view={view} me={me} act={act} nameOf={nameOf} />
              </div>
            )}
            {others.map((p) => panel(p, "hidden short:flex"))}
            {panel(bottomPlayer, "hidden short:flex")}
            <div className="rounded-2xl bg-black/35 p-3 short:p-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-100/60">Diễn biến</p>
              <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto text-xs lg:max-h-[60vh] short:max-h-[34dvh]">
                {g.log
                  .slice()
                  .reverse()
                  .map((e) => (
                    <li
                      key={e.id}
                      className={cn(
                        "rounded px-2 py-1",
                        e.tone === "win" ? "bg-amber-500/25 font-semibold text-amber-100" : e.tone === "quan" ? "bg-amber-500/15 text-amber-100" : e.tone === "capture" ? "bg-emerald-500/15" : "text-white/75",
                      )}
                    >
                      {e.text}
                    </li>
                  ))}
                {!g.log.length && <li className="text-white/40">Chưa có nước đi nào.</li>}
              </ul>
            </div>
          </aside>
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 top-14 z-50 w-max max-w-[92vw] -translate-x-1/2 rounded-full bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-black shadow-lg"
          >
            🫘 {notice}
          </motion.div>
        )}
        {toast && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-20 left-1/2 z-50 w-max max-w-[92vw] -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={SCORE_NOTE} />}
      {showRules && (
        <Modal onClose={() => setShowRules(false)}>
          <h2 className="mb-3 text-lg font-bold text-amber-300">📖 Luật Ô Ăn Quan</h2>
          <OAnQuanRules />
        </Modal>
      )}
    </div>
  );
}

function PlayerStrip({
  p,
  g,
  name,
  seat,
  self,
  isTurn,
  secondsLeft,
  frame,
  reactions,
  className,
  compact,
  onKick,
}: {
  p: OQPlayerView;
  g: OQGameView;
  name: string;
  seat: OQSeatView | null;
  self: boolean;
  isTurn: boolean;
  secondsLeft: number | null;
  frame: SowFrame | null;
  reactions: Reaction[];
  className?: string;
  /** Narrow card for the opponents when 3–4 play. */
  compact?: boolean;
  onKick?: () => void;
}) {
  // While a move replays, the mover's pile counts up as each capture lands.
  const pending = frame?.pending[p.id] ?? { dan: 0, quan: 0 };
  const dan = p.captured.dan - pending.dan;
  const quan = p.captured.quan - pending.quan;
  const score = p.score - pending.dan - pending.quan * g.quanValue;
  const myTurn = self && isTurn;
  const winner = g.status === "ended" && g.winner === p.id;
  const multi = g.players.length > 2;
  const color = SIDE_COLORS[p.side];
  const tags = (
    <>
      {p.borrowed > 0 && (
        <span className="rounded bg-rose-900/60 px-1 text-rose-200" title="Dân vay người khác để rải quân (trừ khi tính điểm)">
          vay {p.borrowed}
        </span>
      )}
      {p.lent > 0 && (
        <span className="rounded bg-emerald-900/60 px-1 text-emerald-200" title="Dân cho người khác vay (cộng khi tính điểm)">
          cho vay {p.lent}
        </span>
      )}
      {p.out && <span className="rounded bg-rose-900/60 px-1 text-rose-200" title="Hết dân để rải quân — bỏ lượt, ô còn lại vẫn nằm trên bàn">Bị loại</span>}
    </>
  );
  if (compact) {
    return (
      <div
        className={cn(
          "relative flex min-w-0 flex-col gap-0.5 rounded-xl px-2 py-1.5",
          isTurn ? "bg-amber-400/15 ring-1 ring-amber-300/60" : "bg-black/35",
          p.out && "opacity-55",
          winner && "ring-2 ring-amber-300",
          className,
        )}
        style={{ borderTop: `3px solid ${color}` }}
      >
        <span className="relative flex items-center gap-1 text-xs font-semibold">
          <SeatBubble reactions={reactions} />
          {seat?.isHost && <span title="Chủ bàn">👑</span>}
          <span className="truncate">{name}</span>
          {winner && <span title="Thắng">🏆</span>}
        </span>
        <span className="flex items-end justify-between gap-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-white/65">
            <span title="Dân đã ăn">🫘{dan}</span>
            <span title="Quan đã ăn">
              👑{quan}
              <span className="text-white/40">×{g.quanValue}</span>
            </span>
          </span>
          <span className="text-xl font-black leading-none text-amber-300">{score}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-white/65 empty:hidden">
          {tags}
          {seat && !seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Mất kết nối</span>}
          {seat?.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Bị kích</span>}
          {isTurn && secondsLeft !== null && <span className={cn("font-mono", secondsLeft <= 5 ? "text-rose-300" : "text-amber-100/80")}>⏱ {secondsLeft}s</span>}
        </span>
        {onKick && (
          <ConfirmButton onConfirm={onKick} confirmLabel="Chắc chắn?" title="Kích người mất kết nối" className="absolute -top-2 right-1 rounded bg-rose-600 px-1.5 text-[11px] font-semibold text-white max-sm:min-h-8 max-sm:px-2.5">
            Kích
          </ConfirmButton>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-2xl px-2.5 py-2 sm:gap-3 sm:px-3 short:py-1.5",
        myTurn ? "bg-rose-500/10" : isTurn ? "bg-amber-400/15 ring-1 ring-amber-300/60" : "bg-black/35",
        winner && "ring-2 ring-amber-300",
        p.out && "opacity-55",
        className,
      )}
      style={multi ? { borderLeft: `4px solid ${color}` } : undefined}
    >
      <TurnRing active={myTurn} />
      <span className="relative">
        <SeatBubble reactions={reactions} />
        <SeatAvatar
          name={name}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          fallbackClassName="bg-gradient-to-br from-amber-200 to-orange-700 font-bold text-black"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-sm font-semibold">
          {seat?.isHost && <span title="Chủ bàn">👑</span>}
          <span className="truncate">{name}</span>
          {self && <span className="text-xs font-normal text-white/60">(bạn)</span>}
          {winner && <span title="Thắng">🏆</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/65">
          <span title="Dân đã ăn">🫘 {dan}</span>
          <span title="Quan đã ăn">
            👑 {quan}
            <span className="text-white/40">×{g.quanValue}</span>
          </span>
          {tags}
          {seat && !seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Mất kết nối</span>}
          {seat?.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Bị kích</span>}
          {seat && seat.games > 0 && (
            <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")} title="Điểm xếp hạng trong phòng">
              {signed(seat.points)}đ
            </span>
          )}
        </span>
      </span>
      {isTurn && !self && secondsLeft !== null && (
        <span className={cn("rounded-full bg-black/50 px-2 py-0.5 font-mono text-xs", secondsLeft <= 5 ? "text-rose-300" : "text-amber-100/80")}>⏱ {secondsLeft}s</span>
      )}
      {myTurn && <MyTurnBadge className="max-[380px]:hidden short:hidden" />}
      <span className="text-right">
        <span className="block text-2xl font-black leading-none text-amber-300">{score}</span>
        <span className="text-[10px] text-white/50">điểm</span>
      </span>
      {onKick && (
        <ConfirmButton onConfirm={onKick} confirmLabel="Chắc chắn?" title="Kích người mất kết nối" className="absolute -top-2 right-2 rounded bg-rose-600 px-1.5 text-[11px] font-semibold text-white max-sm:min-h-8 max-sm:px-2.5">
          Kích
        </ConfirmButton>
      )}
    </div>
  );
}

const END_REASON: Record<string, string> = {
  board: "Hết quan — mỗi người còn trong ván thu dân trên hàng mình.",
  stuck: "Chỉ còn một người trụ lại — những người hết dân để rải quân đã bị loại.",
  forfeit: "Những người còn lại thắng — có người đã rời ván.",
  limit: "Quá số nước đi — kéo quân về tính điểm.",
};

function Waiting({ view, me, act, nameOf }: { view: OQRoomView; me: OQSeatView | null; act: Act; nameOf: (id: string) => string }) {
  const g = view.current;
  const count = view.seats.filter(Boolean).length;
  const maxSeats = Math.max(view.seats.length, 2);
  const ended = g?.status === "ended";
  const last = view.history[view.history.length - 1];
  const isHost = !!me?.isHost && view.role === "player";
  const s = view.settings;
  const select = "min-h-8 rounded-md bg-black/40 px-1.5 py-1 text-white disabled:opacity-70";
  return (
    <div className="w-full max-w-md rounded-3xl border border-amber-200/15 bg-black/50 p-4 backdrop-blur sm:p-5">
      {ended && g ? (
        <>
          <h2 className="mb-1 text-xl font-black text-amber-300">{g.winner ? `🏆 ${nameOf(g.winner)} thắng!` : "🤝 Hoà!"}</h2>
          {g.endReason && <p className="mb-3 text-xs text-white/60">{END_REASON[g.endReason]}</p>}
          <ol className="mb-4 space-y-1.5 text-sm">
            {g.finished.map((id) => {
              const p = g.players.find((x) => x.id === id);
              const multi = g.players.length > 2;
              const d = last?.results.find((r) => r.id === id)?.delta;
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    {multi && p?.rank != null && <span className="mr-1 font-mono text-xs text-amber-300">#{p.rank + 1}</span>}
                    <b className="mr-1">{nameOf(id)}</b>
                    {id === view.meId && <span className="text-white/60">(bạn)</span>}
                    {p && (
                      <span className="block text-xs text-white/60">
                        <b className="text-amber-300">{p.score}</b> = {p.captured.dan} dân + {p.captured.quan} quan × {g.quanValue}
                        {p.borrowed ? ` − vay ${p.borrowed}` : ""}
                        {p.lent ? ` + cho vay ${p.lent}` : ""}
                        {p.out ? " · bị loại" : ""}
                      </span>
                    )}
                  </span>
                  {d !== undefined && <DeltaBadge delta={d} />}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-xl font-black text-amber-300">🪨 Ô Ăn Quan</h2>
          <p className="mb-2 text-sm text-amber-100/80">{count}/{maxSeats} người (2–{maxSeats}) · gửi link mời để bạn bè vào bàn</p>
          {/* Who is at the table. */}
          <ul className="mb-3 flex flex-wrap gap-1.5 text-sm">
            {view.seats.map(
              (seat) =>
                seat && (
                  <li
                    key={seat.id}
                    className={cn(
                      "flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1",
                      seat.id === view.meId ? "border-amber-300/50 bg-amber-400/15" : "border-white/10 bg-white/5",
                      !seat.connected && "opacity-60",
                    )}
                    title={seat.connected ? undefined : "Mất kết nối"}
                  >
                    {seat.isHost && <span title="Chủ bàn">👑</span>}
                    <SeatAvatar name={seat.name} className="grid size-5 shrink-0 place-items-center rounded-full text-[11px]" fallbackClassName="bg-white/15 font-bold" />
                    <span className="truncate">{seat.name}</span>
                    {seat.id === view.meId && <span className="text-xs text-white/60">(bạn)</span>}
                    {!seat.connected && <span aria-label="Mất kết nối">📴</span>}
                    {seat.games > 0 && (
                      <span className={cn("font-mono text-xs", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "text-white/50")}>{signed(seat.points)}đ</span>
                    )}
                  </li>
                ),
            )}
            {count < 2 && <li className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-white/45">Đang chờ thêm người…</li>}
          </ul>
        </>
      )}
      <SettingsTabs
        className="mb-4"
        tabs={[
          {
            id: "rules",
            label: "🪨 Luật",
            content: (
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2">
                  <span>Một quan bằng</span>
                  <select value={s.quanValue} disabled={!isHost} onChange={(e) => void act({ type: "settings", quanValue: Number(e.target.value) })} className={select}>
                    {QUAN_VALUE_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v} dân
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>
                    Quan non <span className="text-white/50">(ô quan dưới {QUAN_NON_MIN} dân chưa ăn được)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={s.quanNon}
                    disabled={!isHost}
                    onChange={(e) => void act({ type: "settings", quanNon: e.target.checked })}
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>
              </div>
            ),
          },
          {
            id: "time",
            label: "⏱️ Lượt",
            content: (
              <label className="flex items-center justify-between gap-2">
                <span>Thời gian mỗi lượt</span>
                <select value={s.turnSeconds} disabled={!isHost} onChange={(e) => void act({ type: "settings", turnSeconds: Number(e.target.value) })} className={select}>
                  {TURN_SECONDS_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v} giây
                    </option>
                  ))}
                </select>
              </label>
            ),
          },
          {
            id: "points",
            label: "🏆 Điểm",
            content: <RankPointsPicker first={s.first} second={s.second} players={g ? g.players.length : Math.max(count, 2)} editable={isHost} onChange={(v) => void act({ type: "settings", ...v })} />,
          },
        ]}
      />
      {!isHost && <p className="-mt-2 mb-3 text-xs text-white/40">Chỉ chủ bàn đổi được luật.</p>}
      {isHost ? (
        <button
          onClick={() => void act({ type: "start" })}
          disabled={count < 2}
          className="w-full rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 disabled:opacity-40"
        >
          {count < 2 ? "Cần ít nhất 2 người" : ended ? "Ván mới" : count > 2 ? `Bắt đầu (${count} người)` : "Bắt đầu"}
        </button>
      ) : (
        <p className="text-sm text-amber-100/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
      )}
    </div>
  );
}

export function OAnQuanRules() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>
        Chơi <b>2–4 người</b>. Bàn là một vòng khép kín: mỗi người có một đoạn gồm 5 <b>ô dân</b> (ban đầu mỗi ô 5 dân) và một <b>ô quan</b> ở đầu đoạn (1 quan). 2 người: bàn 2 hàng quen thuộc với 2 ô quan hình bán nguyệt;
        3–4 người: vòng tam giác / hình vuông, mỗi người một cạnh (ô quan ở góc), cạnh của bạn luôn ở phía dưới.
      </li>
      <li>
        Đến lượt (lần lượt theo vòng), chọn một ô dân có quân bên mình và hướng <b>trái / phải</b>. Bốc hết quân trong ô, rải lần lượt mỗi ô một viên (kể cả ô quan và ô của người khác, đi vòng quanh cả bàn).
      </li>
      <li>
        Rải hết thì xem ô kế tiếp: là <b>ô dân có quân</b> (của bất kỳ ai) thì bốc lên rải tiếp; là <b>ô quan có quân</b> thì dừng (không được bốc ô quan).
      </li>
      <li>
        Ô kế tiếp <b>trống</b> mà ô sau nó có quân thì <b>ăn</b> hết ô đó (ăn cả quan nếu là ô quan — kể cả của người khác). Sau đó nếu lại có một ô trống rồi một ô có quân thì <b>ăn tiếp</b> (ăn liên tiếp).
        Gặp hai ô trống liền nhau thì mất lượt.
      </li>
      <li>
        <b>Quan non</b> (chủ bàn bật/tắt): ô quan còn quan mà chưa đủ {QUAN_NON_MIN} dân thì chưa được ăn — gặp nó coi như dừng.
      </li>
      <li>
        Đầu lượt mà cả 5 ô bên mình đều trống thì phải <b>rải quân</b>: lấy 5 dân đã ăn đặt vào mỗi ô một viên. Thiếu thì vay người kế tiếp trong vòng lượt (còn thiếu thì vay tiếp người sau nữa) — cuối ván trả lại.
        Nếu những người còn chơi cũng không đủ dân để cho vay thì bạn <b>bị loại</b>: bỏ lượt, các ô còn lại của bạn vẫn nằm trên bàn (người khác vẫn rải qua và ăn được). Chỉ còn một người thì người đó thắng.
      </li>
      <li>
        Khi mọi ô quan đều hết quân thì ván kết thúc, mỗi người còn trong ván thu dân còn trên hàng mình. Điểm = dân + quan × giá quan (5 hoặc 10 dân) − dân đã vay + dân đã cho vay. Xếp hạng theo điểm (bằng điểm thì chung hạng), rồi tính điểm xếp hạng Nhất / Nhì.
      </li>
      <li>Hết giờ lượt hoặc mất kết nối thì máy tự rải một ô ngẫu nhiên giúp bạn.</li>
    </ul>
  );
}

/** Bottom sheet on phones (big "Đóng" button), centred dialog from `sm` up. */
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
        className="relative flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#24150a] text-left text-amber-50 shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl short:max-h-[94dvh] short:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-lg leading-none text-white shadow hover:bg-white/20"
          aria-label="Đóng"
        >
          ✕
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [&>h2:first-child]:pr-10">{children}</div>
        <button
          onClick={onClose}
          className="shrink-0 border-t border-white/10 bg-black/20 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold text-amber-100 sm:hidden"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
