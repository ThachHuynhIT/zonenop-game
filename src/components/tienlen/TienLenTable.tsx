"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Card,
  type Reaction,
  type RoomView,
  type SeatView,
  type TienLenSettings,
  DEFAULT_TIENLEN_SETTINGS,
  INSTANT_WIN_NAMES,
  MAX_RANK_POINTS,
  TURN_SECONDS,
  canBeat,
  cardLabel,
  comboName,
  detectCombo,
  isChop,
  rankOf,
  suitOf,
  tienlenRankPoints,
} from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { MyTurnBadge, TurnRing as MyTurnRing } from "@/components/games/TurnIndicator";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { DraggableRow, useHandOrder } from "@/components/games/DraggableHand";
import { BurnOverlay, ChopOverlay, SeatBubble, Shake, SpectatorReactions, useBurnEffect, useChopEffect, useLiveReactions } from "./Effects";
import { CardBack, PlayingCard } from "./PlayingCard";
import { MoveHistory } from "./MoveHistory";
import { DeltaBadge, ScoreboardModal, rankTitle, signed } from "./Scoreboard";
import { inviteLink, useTienLenRoom } from "./useTienLen";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { useHotkeys } from "@/components/games/useHotkeys";
import { WinCelebration } from "@/components/games/WinCelebration";

type SortMode = "rank" | "suit";

function sortHand(hand: Card[], mode: SortMode) {
  const h = hand.slice();
  return mode === "rank" ? h.sort((a, b) => a - b) : h.sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b));
}

/** Remaining seconds of the current turn, ticking locally. */
function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline ? Math.max(0, (deadline - now) / 1000) : null;
}

export default function TienLenTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, play, pass, start, sendEmoji, kick, sendChat, setSettings } = useTienLenRoom(code, name, watch ? "watch" : "play");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  if (status === "error") {
    const full = error?.includes("đủ 4 người");
    return (
      <CenterMessage>
        <p className="text-lg text-rose-300">{error}</p>
        <div className="mt-4 flex gap-2">
          {full && (
            <Link
              href={`/tien-len/${code}?watch=1`}
              className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black"
            >
              Vào xem 👀
            </Link>
          )}
          <Link href="/tien-len" className="rounded-lg border border-emerald-200/25 px-4 py-2 font-semibold text-emerald-50">
            Về sảnh
          </Link>
        </div>
      </CenterMessage>
    );
  }
  if (!view) {
    return (
      <CenterMessage>
        <p className="animate-pulse text-emerald-100/80">Đang kết nối phòng {code}…</p>
      </CenterMessage>
    );
  }

  const act = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const res = await p;
    if (!res.ok && res.error) setToast(res.error);
    return res.ok;
  };

  return (
    <>
      <Table
        view={view}
        reconnecting={status === "reconnecting"}
        onPlay={(cards) => act(play(cards))}
        onPass={() => act(pass())}
        onStart={() => act(start())}
        onSettings={(s) => void act(setSettings(s))}
        onKick={(id) => act(kick(id))}
        toast={toast}
      />
      <ChatBox messages={view.chat} meId={view.meId} myName={name} onSend={(text) => act(sendChat(text))} onEmoji={(e) => void act(sendEmoji(e))} row />
    </>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">{children}</div>;
}

interface TableProps {
  view: RoomView;
  reconnecting: boolean;
  onPlay: (cards: Card[]) => Promise<boolean>;
  onPass: () => Promise<boolean>;
  onStart: () => Promise<boolean>;
  onSettings: (s: Partial<TienLenSettings>) => void;
  onKick: (playerId: string) => Promise<boolean>;
  toast: string | null;
}

function Table({ view, reconnecting, onPlay, onPass, onStart, onSettings, onKick, toast }: TableProps) {
  const { seats, game, meId } = view;
  const spectator = view.role === "spectator";
  const me = seats.find((s) => s?.id === meId) ?? null;
  // Spectators look at the table from seat 0's side.
  const myIndex = Math.max(0, seats.findIndex((s) => s?.id === meId));
  // Turn order goes counter-clockwise: next player sits on my right, then top, then left.
  const at = (offset: number) => seats[(myIndex + offset) % 4] ?? null;
  // Players who left since keep their name in the game history.
  const nameOf = (id: string) =>
    seats.find((s) => s?.id === id)?.name ??
    view.history.flatMap((g) => g.results).find((r) => r.id === id)?.name ??
    "?";

  const [selected, setSelected] = useState<Card[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [busy, setBusy] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showMoves, setShowMoves] = useState(false);

  const chopFx = useChopEffect(game?.status === "playing" ? game.lastPlay : null, nameOf);
  const burnFx = useBurnEffect(game?.burned, nameOf);
  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string | undefined): Reaction[] => (id ? live.filter((r) => r.playerId === id) : []);
  const spectatorReactions = live.filter((r) => !r.playerId);

  // Drop selections for cards that are no longer in hand.
  const handKey = view.hand.join(",");
  useEffect(() => {
    setSelected((sel) => sel.filter((c) => view.hand.includes(c)));
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedHand = useMemo(() => sortHand(view.hand, sortMode), [view.hand, sortMode]);
  // Drag cards to arrange them yourself; picking a sort mode goes back to automatic order.
  const handOrder = useHandOrder(sortedHand, !spectator && meId ? `tienlen:order:${view.code}:${meId}` : null);
  const hand = handOrder.ordered;
  const playing = game?.status === "playing";
  const myTurn = !spectator && playing && game.turn === meId;
  const lastCombo = game?.lastPlay?.combo ?? null;

  const selectedCombo = selected.length ? detectCombo(selected) : null;
  // 4+ đôi thông may chop at any moment, even out of turn or after passing.
  const anytimeChop =
    !spectator &&
    playing &&
    !!me?.inGame &&
    !!selectedCombo &&
    !!lastCombo &&
    game.lastPlay?.playerId !== meId &&
    selectedCombo.type === "pairSeq" &&
    selectedCombo.length >= 8 &&
    isChop(lastCombo, selectedCombo);
  const playError = !selected.length
    ? null
    : !selectedCombo
      ? "Bộ không hợp lệ"
      : game?.mustInclude != null && !selected.includes(game.mustInclude)
        ? `Phải đánh kèm ${cardLabel(game.mustInclude)}`
        : !canBeat(lastCombo, selectedCombo)
          ? "Không chặn được"
          : null;
  const canPlay = (myTurn || anytimeChop) && !!selectedCombo && !playError && !busy;
  const canPass = myTurn && !!lastCombo && !busy;

  const toggle = (c: Card) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const doPlay = async () => {
    setBusy(true);
    if (await onPlay(selected)) setSelected([]);
    setBusy(false);
  };
  const doPass = async () => {
    setBusy(true);
    await onPass();
    setSelected([]);
    setBusy(false);
  };

  const cycleSort = () => {
    if (handOrder.isCustom) handOrder.reset();
    else setSortMode((m) => (m === "rank" ? "suit" : "rank"));
  };
  const showHand = !spectator && playing && hand.length > 0;
  // Desktop shortcuts; same guards as the buttons (Enter is skipped on a focused card button, which is a click already).
  useHotkeys(
    {
      d: () => canPlay && void doPlay(),
      Enter: () => canPlay && void doPlay(),
      p: () => canPass && void doPass(),
      b: () => selected.length > 0 && setSelected([]),
      s: cycleSort,
      Escape: !showScores && !showMoves && selected.length > 0 ? () => setSelected([]) : undefined,
    },
    showHand,
  );

  const [copied, setCopied] = useState(false);
  const copyInvite = async () => {
    const inviteUrl = inviteLink(view.code);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        // Plain http://<ip> pages have no async clipboard API.
        const ta = document.createElement("textarea");
        ta.value = inviteUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("copy failed");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", inviteUrl);
    }
  };

  const isHost = !!me?.isHost;
  const kickable = (s: SeatView | null) => isHost && !!s && s.id !== meId && !s.connected && !s.kicked;
  const kick = async (s: SeatView) => {
    // The Kích button asks for a second tap itself (window.confirm is blocked in some in-app browsers).
    await onKick(s.id);
  };

  const seatProps = (s: SeatView | null) => ({
    seat: s,
    isTurn: !!s && playing && game?.turn === s.id,
    deadline: game?.turnDeadline ?? null,
    // Mid-game nobody is "Bét" yet; once the game ends, the last finisher is.
    rankLabel:
      s && game && game.finished.includes(s.id)
        ? rankTitle(game.finished.indexOf(s.id), game.status === "ended" ? game.finished.length : Infinity)
        : null,
    gameEnded: game?.status === "ended",
    burned: !!s && !!game?.burned?.includes(s.id),
    reactions: reactionsFor(s?.id),
    onKick: kickable(s) ? () => void kick(s!) : undefined,
  });

  const freeSeat = seats.some((s) => s === null);

  return (
    <div
      className="tl-root relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 short:py-1.5"
      style={
        {
          // Sized by the short side too, so a sideways phone keeps the whole table on screen.
          // Big screens get bigger cards instead of an empty felt.
          "--cw": "clamp(44px, min(9.5vw, 13dvh), 96px)",
          "--cw-sm": "clamp(30px, min(6vw, 9dvh), 64px)",
          "--cw-back": "clamp(14px, min(3.2vw, 5dvh), 32px)",
        } as React.CSSProperties
      }
    >
      <WinCelebration show={game?.status === "ended"} playing={game?.status === "playing"} won={!!meId && (game?.instantWin?.playerId ?? game?.finished[0]) === meId} title={game?.status === "ended" ? `🏆 ${nameOf(game.instantWin?.playerId ?? game.finished[0])} thắng` : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/tien-len" className={headerBtn}>
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
            {/* Hidden while the server doesn't send the game's moves (nothing to show). */}
            {(!game || game.moves) && (
              <button onClick={() => setShowMoves(true)} className={headerBtn} title="Lịch sử ván">
                📜 <HeaderLabel>Lịch sử ván</HeaderLabel>
              </button>
            )}
          </>
        }
        status={
          <>
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
        <div className="mb-3 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-emerald-100/80">
          <span>👀 Bạn đang xem với tư cách khán giả</span>
          {freeSeat && !playing && (
            <Link href={`/tien-len/${view.code}`} className="rounded-md bg-amber-400 px-3 py-1 font-semibold text-black">
              Vào chơi
            </Link>
          )}
        </div>
      )}

      {/* Felt table */}
      <Shake fx={chopFx} className="relative flex flex-1">
        <div className="relative grid flex-1 grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr] gap-2 rounded-[2rem] border-[6px] border-[#5b3a1e] bg-[radial-gradient(ellipse_at_center,#1f7a4d_0%,#145c39_55%,#0d3f27_100%)] p-3 shadow-[inset_0_0_60px_rgba(0,0,0,0.5),0_20px_40px_rgba(0,0,0,0.5)] sm:p-5 short:gap-1 short:rounded-3xl short:border-4 short:p-2">
          <ChopOverlay fx={chopFx} />
          <BurnOverlay names={burnFx} />
          <SpectatorReactions reactions={spectatorReactions} />
          <div className="col-span-3 flex justify-center">
            <Opponent {...seatProps(at(2))} />
          </div>
          <div className="flex items-center">
            <Opponent {...seatProps(at(3))} vertical />
          </div>

          {/* Center: last play / lobby */}
          <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 text-center sm:min-h-[180px] short:min-h-0 short:gap-1.5">
            {!game || game.status === "ended" ? (
              <WaitingPanel view={view} me={me} onStart={onStart} onSettings={onSettings} nameOf={nameOf} />
            ) : game.lastPlay ? (
              <>
                <div className="flex">
                  {game.lastPlay.combo.cards.map((c, i) => (
                    <PlayingCard key={c} card={c} size="sm" style={i ? { marginLeft: "calc(var(--cw-sm) * -0.35)" } : undefined} />
                  ))}
                </div>
                <p className="text-sm text-emerald-50/90">
                  <b>{nameOf(game.lastPlay.playerId)}</b> · {comboName(game.lastPlay.combo)}
                  {game.lastPlay.chop && (
                    <span className="ml-2 font-black text-rose-400">
                      CHẶT!{game.lastPlay.chopPoints ? ` +${game.lastPlay.chopPoints}đ` : ""}
                    </span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-emerald-50/80">
                {game.turn === meId ? "Bạn" : <b>{nameOf(game.turn ?? "")}</b>} mở vòng mới
                {game.mustInclude != null && ` (phải có ${cardLabel(game.mustInclude)})`}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Opponent {...seatProps(at(1))} vertical />
          </div>
        </div>
      </Shake>

      {/* My area (or seat 0 for spectators) */}
      <div className="relative mt-3 flex flex-col items-center gap-3 rounded-2xl short:mt-1.5 short:grid short:grid-cols-[auto_auto] short:justify-center short:gap-x-3 short:gap-y-0">
        <MyTurnRing active={myTurn} />
        <div className="flex flex-col items-center gap-3 short:flex-row short:flex-wrap short:justify-center short:gap-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-emerald-50">
            {spectator ? <Opponent {...seatProps(at(0))} /> : <SeatBadge {...seatProps(me)} />}
            {myTurn && (
              <>
                <MyTurnBadge />
                {(playError || selectedCombo) && (
                  <span className="font-semibold text-amber-300 short:max-w-[9rem] short:text-xs">
                    {playError ?? (selectedCombo ? comboName(selectedCombo) : "")}
                  </span>
                )}
              </>
            )}
            {!spectator && playing && me && !me.inGame && <span className="text-emerald-100/60">Bạn sẽ vào ván sau</span>}
          </div>

          {/* After a game the leftover hand stays on show, without the (then useless) play buttons. */}
          {!spectator && playing && hand.length > 0 && (
            <div className="flex items-center justify-center gap-2">
              <ActionButton onClick={doPass} disabled={!canPass} hotkey="P">
                Bỏ lượt
              </ActionButton>
              <ActionButton onClick={doPlay} disabled={!canPlay} primary big hotkey="D">
                {anytimeChop && !myTurn ? "CHẶT! 💥" : "ĐÁNH 🃏"}
              </ActionButton>
              <ActionButton onClick={() => setSelected([])} disabled={!selected.length} hotkey="B">
                Bỏ chọn
              </ActionButton>
            </div>
          )}
        </div>

        {!spectator && hand.length > 0 && (
          playing ? (
            <div className="flex w-full justify-center overflow-visible pt-5 short:order-last short:col-span-2 short:pt-5">
              <DraggableRow
                items={hand}
                onMove={handOrder.move}
                className="[--overlap:-0.42] sm:[--overlap:-0.3]"
                itemStyle={(i) => (i ? { marginLeft: "calc(var(--cw) * var(--overlap))" } : undefined)}
                renderItem={(c) => <PlayingCard card={c} selected={selected.includes(c)} onClick={() => toggle(c)} />}
              />
            </div>
          ) : (
            // After a game: the cards left over, small, so the result panel and "Ván mới" keep the room
            // (phones: kept left of the 😀 / 💬 buttons).
            <div className="flex flex-col items-center gap-1 max-sm:pr-[6.5rem] short:hidden">
              <span className="text-xs text-emerald-100/60">Bài còn lại ({hand.length} lá)</span>
              <div className="flex">
                {hand.map((c, i) => (
                  <PlayingCard key={c} card={c} size="sm" style={i ? { marginLeft: "calc(var(--cw-sm) * -0.4)" } : undefined} />
                ))}
              </div>
            </div>
          )
        )}

        {!spectator && playing && hand.length > 0 && (
          <div className="flex items-center justify-center gap-2">
            <ActionButton onClick={cycleSort} hotkey="S">
              Xếp: {handOrder.isCustom ? "tự do ✋" : sortMode === "rank" ? "số" : "chất"}
            </ActionButton>
            <span className="hidden text-[11px] text-emerald-100/50 lg:inline [@media(pointer:coarse)]:hidden">
              Phím tắt: D / Enter = đánh · P = bỏ lượt · B / Esc = bỏ chọn · S = xếp bài
            </span>
          </div>
        )}
      </div>

      {showMoves && <MoveHistory moves={game?.moves ?? []} nameOf={nameOf} meId={meId} onClose={() => setShowMoves(false)} />}
      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={scoreNote(view.settings ?? DEFAULT_TIENLEN_SETTINGS)} />}

      {toast && (
        // Top of the screen, like the other tables: at the bottom it covered the hand and the chat buttons.
        <div
          role="alert"
          className="fixed left-1/2 top-[calc(var(--games-bar-h,0px)+0.5rem)] z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-rose-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  big,
  hotkey,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  big?: boolean;
  hotkey?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-w-[72px] rounded-lg px-3 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[84px] sm:px-4",
        big && "min-w-[120px] rounded-xl px-5 py-2.5 text-base font-black tracking-wide sm:min-w-[180px] sm:px-8 sm:py-3 sm:text-xl short:min-w-[100px] short:px-4 short:py-2 short:text-base",
        primary
          ? "bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.35)] enabled:hover:bg-amber-300"
          : "border border-emerald-200/25 bg-black/25 text-emerald-50 enabled:hover:bg-white/10",
      )}
    >
      {children}
      {hotkey && (
        <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
    </button>
  );
}

interface SeatDisplayProps {
  seat: SeatView | null;
  isTurn: boolean;
  deadline: number | null;
  rankLabel: string | null;
  gameEnded: boolean;
  burned: boolean;
  reactions: Reaction[];
  onKick?: () => void;
}

function TurnRing({ deadline }: { deadline: number | null }) {
  const left = useCountdown(deadline);
  if (left == null) return null;
  const pct = Math.min(1, left / TURN_SECONDS);
  return (
    <span
      className="absolute -inset-1 rounded-full"
      style={{
        background: `conic-gradient(${left < 8 ? "#f43f5e" : "#fbbf24"} ${pct * 360}deg, transparent 0)`,
        mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
        WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
      }}
    />
  );
}

function Avatar({ seat, isTurn, deadline, reactions }: { seat: SeatView; isTurn: boolean; deadline: number | null; reactions: Reaction[] }) {
  return (
    <span className="relative inline-flex">
      {isTurn && <TurnRing deadline={deadline} />}
      <SeatBubble reactions={reactions} />
      <SeatAvatar
        name={seat.name}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full text-base sm:h-12 sm:w-12 short:h-8 short:w-8 short:text-sm",
          (!seat.connected || seat.kicked) && "grayscale opacity-50",
        )}
        fallbackClassName="bg-gradient-to-br from-amber-200 to-amber-500 font-bold text-black"
      />
    </span>
  );
}

function StatusTags({
  seat,
  rankLabel,
  gameEnded,
  burned,
  onKick,
}: {
  seat: SeatView;
  rankLabel: string | null;
  gameEnded: boolean;
  burned?: boolean;
  onKick?: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center justify-center gap-1 text-[11px]">
      {seat.isHost && <span title="Chủ phòng">👑</span>}
      {rankLabel && <span className="rounded bg-amber-400 px-1.5 font-bold text-black">{rankLabel}</span>}
      {burned && <span className="rounded bg-orange-600 px-1.5 font-bold text-white" title="Chết cháy: chưa đánh lá nào khi có người về Nhất — thua gấp đôi">🔥 Cháy</span>}
      {!gameEnded && seat.passed && (
        <span className="rounded bg-black/40 px-1.5 text-emerald-100/80" title={seat.autoPassed ? "Không có bài chặn được nên tự bỏ lượt" : undefined}>
          {seat.autoPassed ? "Tự bỏ (không chặn được)" : "Bỏ lượt"}
        </span>
      )}
      {seat.kicked ? (
        <span className="rounded bg-rose-900/60 px-1.5 text-rose-200">Đã bị kích</span>
      ) : (
        !seat.connected && <span className="rounded bg-rose-900/60 px-1.5 text-rose-200">Mất kết nối</span>
      )}
      {onKick && (
        <ConfirmButton onConfirm={onKick} confirmLabel="Chắc chắn?" title="Kích người mất kết nối" className="rounded bg-rose-600 px-1.5 font-semibold text-white hover:bg-rose-500 max-sm:min-h-8 max-sm:px-2.5">
          Kích
        </ConfirmButton>
      )}
      {seat.games > 0 && (
        <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "text-emerald-100/60")}>
          {signed(seat.points)}đ
        </span>
      )}
    </span>
  );
}

function Opponent({ seat, isTurn, deadline, rankLabel, gameEnded, burned, reactions, onKick, vertical }: SeatDisplayProps & { vertical?: boolean }) {
  if (!seat) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-emerald-100/20 text-xs text-emerald-100/40 short:h-10 short:w-10 short:text-[10px]">
        Trống
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2", vertical ? "flex-col short:flex-row" : "flex-row")}>
      <div className="flex flex-col items-center gap-1">
        <Avatar seat={seat} isTurn={isTurn} deadline={deadline} reactions={reactions} />
        <span className="max-w-[88px] truncate text-xs font-medium text-emerald-50 sm:text-sm short:text-xs">{seat.name}</span>
        <StatusTags seat={seat} rankLabel={rankLabel} gameEnded={gameEnded} burned={burned} onKick={onKick} />
      </div>
      {seat.inGame && seat.cardCount > 0 && !seat.kicked && (
        <div className="flex items-center gap-1">
          <div className="relative">
            <CardBack />
            <CardBack className="absolute left-1 top-1" />
          </div>
          <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-amber-200">{seat.cardCount}</span>
        </div>
      )}
    </div>
  );
}

function SeatBadge({ seat, isTurn, deadline, rankLabel, gameEnded, burned, reactions }: SeatDisplayProps) {
  if (!seat) return null;
  return (
    <span className="flex items-center gap-2">
      <Avatar seat={seat} isTurn={isTurn} deadline={deadline} reactions={reactions} />
      <span className="flex flex-col items-start">
        <span className="font-medium">
          {seat.name}
          <span className="short:hidden"> (bạn)</span>
        </span>
        <StatusTags seat={seat} rankLabel={rankLabel} gameEnded={gameEnded} burned={burned} />
      </span>
    </span>
  );
}

function WaitingPanel({
  view,
  me,
  onStart,
  onSettings,
  nameOf,
}: {
  view: RoomView;
  me: SeatView | null;
  onStart: () => Promise<boolean>;
  onSettings: (s: Partial<TienLenSettings>) => void;
  nameOf: (id: string) => string;
}) {
  const { game } = view;
  const count = view.seats.filter(Boolean).length;
  const ended = game?.status === "ended";
  const last = view.history[view.history.length - 1];
  const deltaOf = (id: string) => last?.results.find((r) => r.id === id)?.delta;
  // Enter starts / restarts, like the visible host button (hook skips Enter on a focused button, and while a dialog is open).
  useHotkeys({ Enter: () => void onStart() }, view.role === "player" && !!me?.isHost && count >= 2);

  return (
    // Portrait phones: the centre cell between the side seats is too narrow, so the panel floats over the whole felt.
    <div className="z-10 w-full max-w-xs rounded-2xl bg-black/35 p-4 backdrop-blur-sm max-sm:absolute max-sm:inset-x-3 max-sm:top-1/2 max-sm:w-auto max-sm:max-w-none max-sm:max-h-[calc(100%-1.5rem)] max-sm:-translate-y-1/2 max-sm:overflow-y-auto max-sm:bg-black/75 short:grid short:max-h-[50dvh] short:max-w-xl short:grid-cols-2 short:items-start short:gap-x-3 short:overflow-y-auto short:p-3">
      {/* Sideways phones: two columns (results | start + rules) so the start button stays in view. */}
      <div className="short:col-start-1 short:row-span-2 short:row-start-1">
      {ended && game ? (
        <>
          <h2 className="mb-2 text-lg font-bold text-amber-300">
            {game.instantWin
              ? `${nameOf(game.instantWin.playerId)} tới trắng — ${INSTANT_WIN_NAMES[game.instantWin.reason]}!`
              : "Kết quả ván"}
          </h2>
          <ol className="mb-3 space-y-1 text-left text-sm">
            {game.finished.map((id, i) => {
              const d = deltaOf(id);
              return (
                <li key={id} className="flex items-center justify-between gap-4 text-emerald-50">
                  <span>
                    <b className="mr-2 text-amber-300">{rankTitle(i, game.finished.length)}</b>
                    {nameOf(id)}
                    {id === view.meId && <span className="ml-1 text-emerald-100/60">(bạn)</span>}
                    {game.burned?.includes(id) && <span className="ml-1 rounded bg-orange-600 px-1 text-xs font-bold text-white">🔥 cháy ×2</span>}
                  </span>
                  {d !== undefined && <DeltaBadge delta={d} />}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-lg font-bold text-amber-300">Tiến Lên Miền Nam</h2>
          <p className="mb-3 text-sm text-emerald-50/80">{count}/4 người · gửi link mời để bạn bè vào phòng</p>
          {/* Portrait phones: this panel covers the side seats, so list who's in the room here. */}
          <ul className="mb-3 flex flex-wrap justify-center gap-1.5 sm:hidden">
            {view.seats.map((s) =>
              s ? (
                <li key={s.id} className={cn("rounded-full px-2.5 py-0.5 text-xs", s.id === view.meId ? "bg-amber-400/20 text-amber-100" : "bg-white/10 text-emerald-50")}>
                  {s.isHost && "👑 "}
                  {s.name}
                  {s.id === view.meId && " (bạn)"}
                  {!s.connected && " · mất kết nối"}
                </li>
              ) : null,
            )}
          </ul>
        </>
      )}
      </div>
      <SettingsPanel
        settings={view.settings ?? DEFAULT_TIENLEN_SETTINGS}
        editable={view.role === "player" && !!me?.isHost}
        players={count}
        onChange={onSettings}
      />
      <div className="short:col-start-2 short:row-start-1 short:mb-2">
      {view.role === "spectator" ? (
        <p className="text-sm text-emerald-100/70">{ended ? "Chờ ván mới…" : "Chờ chủ phòng bắt đầu…"}</p>
      ) : me?.isHost ? (
        <button
          onClick={onStart}
          disabled={count < 2}
          className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {count < 2 ? "Cần ít nhất 2 người" : ended ? "Ván mới" : "Bắt đầu"}
          {count >= 2 && (
            <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">Enter</kbd>
          )}
        </button>
      ) : (
        <p className="text-sm text-emerald-100/70">Chờ chủ phòng bắt đầu…</p>
      )}
      </div>
    </div>
  );
}

const signedPoints = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

function scoreNote(s: TienLenSettings) {
  const rows = [4, 3, 2].map((n) => `${n} người ${tienlenRankPoints(n, s).map(signedPoints).join("/")}`).join(" · ");
  return `Điểm mỗi ván: ${rows} · chết cháy thua gấp đôi · tới trắng +${s.first * 2} từ mỗi người · chặt heo đen +1, heo đỏ +2, mỗi lần chặt chồng gấp đôi (người bị chặt trả).`;
}

/** Host settings between games: auto-pass and Nhất / Nhì points (the rest is derived). */
function SettingsPanel({
  settings,
  editable,
  players,
  onChange,
}: {
  settings: TienLenSettings;
  editable: boolean;
  players: number;
  onChange: (s: Partial<TienLenSettings>) => void;
}) {
  const n = Math.min(Math.max(players, 2), 4);
  const preview = tienlenRankPoints(n, settings);
  const labels = ["Nhất", "Nhì", "Ba", "Bét"];
  return (
    <div className="mb-3 space-y-2 rounded-xl bg-black/25 p-2 text-left text-xs text-emerald-50 short:col-start-2 short:row-start-2 short:mb-0">
      <p className="font-semibold uppercase tracking-wide text-emerald-100/60">Luật bàn</p>
      <label className={cn("flex min-h-8 items-center justify-between gap-2 pointer-coarse:min-h-9", editable && "cursor-pointer")}>
        <span>Tự bỏ lượt khi không có bài chặn</span>
        <input
          type="checkbox"
          checked={settings.autoPass}
          disabled={!editable}
          onChange={(e) => onChange({ autoPass: e.target.checked })}
          className="h-4 w-4 shrink-0 accent-amber-400 pointer-coarse:h-5 pointer-coarse:w-5"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span>Điểm Nhất / Nhì</span>
        <span className="flex items-center gap-1">
          <select
            value={settings.first}
            disabled={!editable}
            onChange={(e) => {
              const first = Number(e.target.value);
              onChange({ first, second: Math.min(settings.second, first) });
            }}
            className="rounded bg-black/40 px-1 py-0.5 pointer-coarse:min-h-9 pointer-coarse:px-2"
            aria-label="Điểm Nhất"
          >
            {Array.from({ length: MAX_RANK_POINTS }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                +{v}
              </option>
            ))}
          </select>
          <span className="text-emerald-100/50">/</span>
          <select
            value={settings.second}
            disabled={!editable}
            onChange={(e) => onChange({ second: Number(e.target.value) })}
            className="rounded bg-black/40 px-1 py-0.5 pointer-coarse:min-h-9 pointer-coarse:px-2"
            aria-label="Điểm Nhì"
          >
            {Array.from({ length: settings.first + 1 }, (_, i) => i).map((v) => (
              <option key={v} value={v}>
                {v ? `+${v}` : "0"}
              </option>
            ))}
          </select>
        </span>
      </div>
      <p className="text-emerald-100/70">
        {n} người: {preview.map((p, i) => `${labels[n === 4 ? i : i === n - 1 ? 3 : i]} ${signedPoints(p)}`).join(" · ")} · tới trắng +{settings.first * 2}/người
      </p>
      {!editable && <p className="text-emerald-100/40">Chỉ chủ phòng đổi được luật.</p>}
    </div>
  );
}
