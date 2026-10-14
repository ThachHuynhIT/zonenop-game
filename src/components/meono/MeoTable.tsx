"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { ChatBox } from "@/components/games/ChatBox";
import { DraggableRow, useHandOrder } from "@/components/games/DraggableHand";
import { GameHeader, headerBtn } from "@/components/games/GameHeader";
import { useHotkeys } from "@/components/games/useHotkeys";
import { useGameRoom } from "@/components/games/gameClient";
import { MyTurnBadge, TurnRing, TurnTimerBorder } from "@/components/games/TurnIndicator";
import { SeatBubble, SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { DeltaBadge, ScoreboardModal, signed } from "@/components/tienlen/Scoreboard";
import {
  ACTION_TYPES,
  CARDS,
  CAT_TYPES,
  type CardType,
  type Expansion,
  type MCard,
  NAMEABLE_TYPES,
  NOW_TYPES,
  PACKS,
  PRESETS,
  PRESET_GROUPS,
  SELECTABLE_PACKS,
  TARGETED_TYPES,
  WILD_CAT,
  cardName,
} from "@/lib/meono/cards";
import {
  DEFAULT_MEO_SETTINGS,
  MEONO_WS_PATH,
  type MeoPlay,
  type MeoRoomView,
  type MeoSeatView,
  NOPE_SECONDS_OPTIONS,
  TURN_SECONDS_OPTIONS,
  insertRange,
} from "@/lib/meono/protocol";
import { SettingsTabs } from "@/components/games/SettingsTabs";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/tienlen/Sheet";
import { CardGuide } from "./CardGuide";
import { MeoCard, ROLES, roleOf } from "./MeoCard";
import { EventFeed, PlayHistory } from "./PlayHistory";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { WinCelebration } from "@/components/games/WinCelebration";

const SCORE_NOTE =
  "Điểm theo thứ hạng: người sống sót cuối cùng Nhất, ai bị loại trước xếp sau. Chủ bàn chọn điểm Nhất / Nhì, các hạng cuối trừ tương ứng, tổng mỗi ván luôn bằng 0.";

/** Shift server-clock deadlines onto the local clock. */
function localize(view: MeoRoomView): MeoRoomView {
  const g = view.current;
  if (!g) return view;
  const skew = Date.now() - view.serverTime;
  const shift = (t: number | null) => (t ? t + skew : t);
  return {
    ...view,
    current: {
      ...g,
      turnDeadline: shift(g.turnDeadline),
      pending: g.pending ? { ...g.pending, deadline: g.pending.deadline + skew } : null,
      choice: g.choice ? { ...g.choice, deadline: g.choice.deadline + skew } : null,
    },
  };
}

function useNow(active: boolean, every = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

/** What a selection of cards would do, mirroring the server's rules. */
function classify(types: CardType[]): { kind: string; target: boolean; named: "hand" | "discard" | null } | { error: string } | null {
  if (!types.length) return null;
  if (types.length === 1) {
    const t = types[0];
    if (ACTION_TYPES.includes(t)) return { kind: t, target: TARGETED_TYPES.includes(t), named: null };
    if (t === "nope") return { error: "“Không!” chỉ dùng để chặn người khác" };
    if (t === "exploding") return { error: "Mèo Nổ đang được Mèo Chạy Rông che chở — không đánh ra được" };
    if (t === "streaking") return { error: "Mèo Chạy Rông chỉ cần giữ trong tay" };
    if (t === "clairvoyance") return { error: "Thấu thị dùng khi người khác đang nhét Mèo Nổ" };
    if (t === "defuse") return { error: "Gỡ bom tự dùng khi rút phải Mèo Nổ" };
    return { error: "Lá mèo phải đánh theo đôi hoặc bộ ba" };
  }
  const isSet =
    types.every((t) => t === types[0]) ||
    (types.every((t) => t === WILD_CAT || CAT_TYPES.includes(t)) && new Set(types.filter((t) => t !== WILD_CAT)).size === 1);
  if ((types.length === 2 || types.length === 3) && isSet) {
    return types.length === 2 ? { kind: "pair", target: true, named: null } : { kind: "triple", target: true, named: "hand" };
  }
  if (types.length === 5 && new Set(types).size === 5) return { kind: "five", target: false, named: "discard" };
  return { error: "Bộ bài không hợp lệ" };
}

const COMPACT_KEY = "meono:compactHand";

/** Ids of identical cards grouped together, in hand order (annoyed copies form their own group). */
function groupIdentical(ids: number[], byId: Map<number, MCard>): number[][] {
  const groups = new Map<string, number[]>();
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    const key = `${c.type}${c.annoyed ? ":annoyed" : ""}`;
    const g = groups.get(key);
    if (g) g.push(id);
    else groups.set(key, [id]);
  }
  return [...groups.values()];
}

interface BoomFx {
  id: number;
  tone: string;
  text: string;
}

export default function MeoTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, call } = useGameRoom<MeoRoomView>(MEONO_WS_PATH, code, name, watch ? "watch" : "play", localize);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const act = useCallback(
    async (msg: Record<string, unknown> & { type: string }) => {
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
            <Link href={`/meo-no/${code}?watch=1`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black">
              Vào xem 👀
            </Link>
          )}
          <Link href="/meo-no" className="rounded-lg border border-white/25 px-4 py-2 font-semibold">
            Về sảnh
          </Link>
        </div>
      </div>
    );
  }
  if (!view) {
    return <p className="flex min-h-[70vh] animate-pulse items-center justify-center text-orange-100/80">Đang kết nối bàn {code}…</p>;
  }
  return (
    <>
      <Board view={view} reconnecting={status === "reconnecting"} act={act} toast={toast} />
      <ChatBox
        messages={view.chat}
        meId={view.meId}
        myName={name}
        onSend={(text) => act({ type: "chat", text })}
        onEmoji={(e) => void act({ type: "emoji", emoji: e })}
      />
    </>
  );
}

function Board({
  view,
  reconnecting,
  act,
  toast,
}: {
  view: MeoRoomView;
  reconnecting: boolean;
  act: (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;
  toast: string | null;
}) {
  const g = view.current;
  const spectator = view.role === "spectator";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const playing = g?.status === "playing";
  const meAlive = !!me && playing && me.inGame && !me.out;
  const myTurn = meAlive && g?.turn === view.meId;
  const nameOf = (id: string) =>
    view.seats.find((s) => s?.id === id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";

  const [selected, setSelected] = useState<number[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [named, setNamed] = useState<CardType | "">("");
  const [focus, setFocus] = useState<CardType | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [busy, setBusy] = useState(false);

  const hand = view.hand;
  const handKey = hand.map((c) => c.id).join(",");
  useEffect(() => {
    setSelected((sel) => sel.filter((id) => hand.some((c) => c.id === id)));
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lời nguyền mông mèo: the hand arrives face down, in blind order — keep that order.
  const cursed = !!me?.cursed;
  const sortedHand = useMemo(
    () => (cursed ? hand : hand.slice().sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id)),
    [hand, cursed],
  );
  // Drag cards to arrange your hand (not while cursed: those ids are blind positions).
  const handOrder = useHandOrder(
    sortedHand.map((c) => c.id),
    !spectator && view.meId && !cursed ? `meono:order:${view.code}:${view.meId}` : null,
  );
  const handById = new Map(hand.map((c) => [c.id, c]));
  const orderedIds = cursed ? sortedHand.map((c) => c.id) : handOrder.ordered;
  const selectedTypes = selected.map((id) => hand.find((c) => c.id === id)?.type).filter((t): t is CardType => !!t);
  const plan = cursed
    ? selected.length
      ? ({ kind: "blind", target: false, named: null } as const)
      : null
    : classify(selectedTypes);
  const annoyedPick = selected.some((id) => hand.find((c) => c.id === id)?.annoyed);
  const planError = annoyedPick ? "Lá bị Nổi cáu — chưa dùng được" : plan && "error" in plan ? plan.error : null;
  const planOk = plan && !("error" in plan) && !annoyedPick ? plan : null;

  const g2 = g;
  const pending = g2?.pending ?? null;
  const choice = g2?.choice ?? null;
  const now = useNow(!!pending || !!choice || playing);

  const opponents = view.seats.filter((s): s is MeoSeatView => !!s && s.id !== view.meId);
  const canTarget = (s: MeoSeatView) =>
    planOk?.kind === "zombie" ? s.inGame && s.out && !s.kicked : s.inGame && !s.out;
  const needTarget = !!planOk?.target;
  const needName = planOk?.named ?? null;
  const actionLabel =
    planOk?.kind === "pair"
      ? "đánh đôi — rút trộm 1 lá"
      : planOk?.kind === "triple"
        ? "đánh bộ ba — gọi tên 1 lá"
        : planOk?.kind === "five"
          ? "đánh 5 lá khác nhau — nhặt 1 lá đã đánh"
          : planOk?.kind === "blind"
            ? "đánh lá úp (bị nguyền)"
            : planOk
              ? `đánh ${cardName(planOk.kind as CardType)}`
              : "";
  // “Now” cards (Sửa tương lai ngay) can be played on anyone's turn.
  const choiceFor = choice ? ("player" in choice ? choice.player : choice.from) : null;
  const myDeadline = !playing ? null : choice ? (choiceFor === view.meId ? choice.deadline : null) : myTurn && !pending ? (g?.turnDeadline ?? null) : null;
  const nowPlay = meAlive && !!planOk && NOW_TYPES.includes(planOk.kind as CardType);
  const canPlay =
    (myTurn || nowPlay) && !pending && !choice && !!planOk && (!needTarget || !!target) && (!needName || !!named) && !busy;
  const canDraw = myTurn && !pending && !choice && !busy;
  const myNope = hand.find((c) => c.type === "nope" && !c.annoyed);
  // No answering your own card: the play itself, or your own Không! on top of the chain.
  const lastPlay = g?.plays?.at(-1);
  const nopeOwner = pending
    ? pending.nopes > 0
      ? (pending.lastNoper ?? (lastPlay?.result === "pending" ? lastPlay.nopes.at(-1) : undefined) ?? null)
      : pending.by
    : null;
  const ownNope = !!pending && nopeOwner === view.meId;
  const canNope = !!pending && meAlive && !!myNope && !ownNope;
  // Answering a Favor / Dọn rác…: pick exactly one card.
  const singlePick = (choice?.kind === "favor" && choice.from === view.meId) || (choice?.kind === "offer" && choice.player === view.meId);

  // Phones fold the hand into a strip while there's nothing to do with it. It opens by itself when it's
  // needed (my turn, a card to hand over); the player can still open / fold it. A Không! to answer
  // doesn't unfold it: the strip carries its own KHÔNG! button.
  const needHand = myTurn || singlePick;
  const [handPref, setHandPref] = useState<boolean | null>(null);
  useEffect(() => setHandPref(null), [needHand]);
  const handOpen = handPref ?? (needHand || selected.length > 0);

  // Compact hand: identical cards stacked with a ×n badge (remembered per browser).
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COMPACT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleCompact = () =>
    setCompact((v) => {
      try {
        localStorage.setItem(COMPACT_KEY, v ? "0" : "1");
      } catch {
        // Storage blocked: the choice just won't be remembered.
      }
      return !v;
    });

  const toggle = (c: MCard) => {
    setFocus(c.type);
    if (singlePick) {
      setSelected([c.id]);
      return;
    }
    setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]));
  };
  /** A stack of identical cards: each click selects one more copy; once all are picked, the next click clears them. */
  const clickStack = (ids: number[]) => {
    const c = handById.get(ids[0]);
    if (!c) return;
    setFocus(c.type);
    if (singlePick) {
      setSelected((s) => (s.length === 1 && ids.includes(s[0]) ? [] : [ids[0]]));
      return;
    }
    setSelected((s) => {
      const next = ids.find((id) => !s.includes(id));
      return next === undefined ? s.filter((id) => !ids.includes(id)) : [...s, next];
    });
  };
  const unpickOne = (ids: number[]) =>
    setSelected((s) => {
      const last = [...s].reverse().find((id) => ids.includes(id));
      return last === undefined ? s : s.filter((id) => id !== last);
    });
  // Groups of identical cards in hand order (never for a cursed, face-down hand; annoyed cards stay apart).
  const groups = compact && !cursed ? groupIdentical(orderedIds, handById) : null;
  const moveGroup = (from: number, to: number) => {
    if (!groups || from === to) return;
    const next = groups.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    handOrder.setOrder(next.flat());
  };

  const run = async (msg: Record<string, unknown> & { type: string }) => {
    setBusy(true);
    const ok = await act(msg);
    setBusy(false);
    return ok;
  };
  const doPlay = async () => {
    if (await run({ type: "mplay", cards: selected, target: target ?? undefined, named: named || undefined })) {
      setSelected([]);
      setTarget(null);
      setNamed("");
    }
  };

  const clearSelection = () => (setSelected([]), setTarget(null), setNamed(""));
  // Desktop shortcuts; same guards as the dock buttons. Draw (R) is the visible green button, never bound to Space/Enter.
  const noDialog = !showGuide && !showScores && !showDiscard;
  useHotkeys(
    {
      d: () => canPlay && void doPlay(),
      r: () => canDraw && void run({ type: "draw" }),
      n: () => canNope && myNope && !busy && void run({ type: "nope", card: myNope.id }),
      b: () => selected.length > 0 && clearSelection(),
      Escape: noDialog && selected.length > 0 ? clearSelection : undefined,
    },
    meAlive,
  );

  // Explosion / defuse effects from the log.
  const [fx, setFx] = useState<BoomFx | null>(null);
  const lastLog = useRef<number | null>(null);
  const latestLogId = g?.log.at(-1)?.id ?? 0;
  useEffect(() => {
    const log = g?.log ?? [];
    const latest = log[log.length - 1];
    if (!latest) return;
    if (lastLog.current === null) {
      lastLog.current = latest.id;
      return;
    }
    const fresh = log.filter((e) => e.id > (lastLog.current ?? 0));
    lastLog.current = latest.id;
    const big = fresh.reverse().find((e) => e.tone === "boom" || e.tone === "defuse" || e.tone === "nope");
    if (big) setFx({ id: latest.id, tone: big.tone!, text: big.text });
  }, [latestLogId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Hide on its own timer so later state updates can't cancel it (that left the overlay stuck).
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), fx.tone === "boom" ? 2400 : 1500);
    return () => clearTimeout(t);
  }, [fx]);

  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string): Reaction[] => live.filter((r) => r.playerId === id);

  const kick = async (s: MeoSeatView) => {
    // The Kích button asks for a second tap itself (window.confirm is blocked in some in-app browsers).
    await act({ type: "kick", playerId: s.id });
  };

  const [copied, setCopied] = useState(false);
  const copyInvite = async () => {
    const url = new URL(`/meo-no/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };

  const secondsLeft = (deadline: number | null | undefined) => (deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null);
  const focusInfo = focus ? CARDS[focus] : null;

  return (
    // One screen tall: the hand + Đánh / Rút always stay in view; the table and the feed scroll inside the middle instead.
    <div className="relative mx-auto flex h-[calc(100dvh-var(--games-bar-h,0px))] w-full max-w-6xl flex-col lg:max-w-[112rem] gap-2 overflow-hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:gap-3 sm:px-4 sm:pt-3 short:gap-1.5 short:pt-1.5">
      {/* The table's own header lives in the games top bar. */}
      <WinCelebration show={g?.status === "ended"} playing={g?.status === "playing"} won={!!view.meId && g?.finished[0] === view.meId} title={g?.status === "ended" ? `🏆 ${nameOf(g.finished[0])} thắng` : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/meo-no" className={headerBtn} title="Về sảnh Mèo Nổ">
              ←<span className="max-[359px]:hidden"> Sảnh</span>
            </Link>
            <span className="rounded-md bg-black/30 px-1.5 font-mono text-sm font-bold tracking-[0.15em] text-amber-300" title="Mã bàn">
              {view.code}
            </span>
          </>
        }
        extra={
          <>
            <button onClick={copyInvite} className={headerBtn} title="Chép link mời">
              {copied ? "✓ Đã chép link" : "🔗 Chép link mời"}
            </button>
            <button onClick={() => setShowScores(true)} className={headerBtn} title="Bảng điểm">
              🏆 Bảng điểm
            </button>
            <button onClick={() => setShowGuide(true)} className={headerBtn} title="Hướng dẫn lá bài">
              📖 Lá bài
            </button>
            {(g?.expansions ?? view.expansions).length > 0 && (
              <span className="flex items-center gap-1.5 whitespace-nowrap px-1 text-orange-100/70" title="Gói mở rộng đang chơi">
                {(g?.expansions ?? view.expansions).map((e) => (
                  <span key={e} title={PACKS[e].name}>
                    {PACKS[e].emoji}
                    <span className="sm:max-xl:hidden"> {PACKS[e].name.replace("Gói ", "")}</span>
                  </span>
                ))}
              </span>
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
            {reconnecting && (
              <span className="animate-pulse truncate text-amber-300" title="Đang kết nối lại…">
                ⟳<span className="max-sm:hidden"> Đang kết nối lại…</span>
              </span>
            )}
          </>
        }
      />

      {spectator && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-orange-100/80">
          <span>👀 Bạn đang xem với tư cách khán giả</span>
          {view.seats.some((s) => s === null) && !playing && (
            <Link href={`/meo-no/${view.code}`} className="rounded-md bg-amber-400 px-3 py-1 font-semibold text-black">
              Vào chơi
            </Link>
          )}
        </div>
      )}

      {/* Middle: phones scroll table → feed here; wide / landscape screens get two columns that each scroll on their own. */}
      {/* Without the hand dock (waiting, game over, watching) nothing keeps the floating 😀 / 💬 buttons off the
          feed: phones get room to scroll its end clear of them, wider screens a right gutter. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden short:grid short:grid-cols-[minmax(0,1fr)_14rem] short:grid-rows-[minmax(0,1fr)] short:gap-2 short:overflow-hidden",
          (spectator || hand.length === 0) && "max-lg:pb-28 lg:pr-16 short:!pb-0 short:pr-14",
        )}
      >
        {/* Table */}
        <div className="relative flex min-h-[300px] shrink-0 flex-col rounded-[2rem] border-[6px] border-[#4a2412] bg-[radial-gradient(ellipse_at_center,#7c2d12_0%,#431407_60%,#26100a_100%)] p-3 shadow-[inset_0_0_60px_rgba(0,0,0,0.55)] sm:min-h-[340px] sm:p-4 lg:min-h-0 lg:overflow-y-auto short:min-h-0 short:overflow-y-auto short:rounded-3xl short:border-4 short:p-2">
          <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
          <BoomOverlay fx={fx} />

          {/* Opponents */}
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-3">
            {opponents.length === 0 && <p className="py-4 text-sm text-orange-100/50">Chưa có ai khác — gửi link mời nhé!</p>}
            {opponents.map((s) => (
              <Seat
                key={s.id}
                seat={s}
                isTurn={g?.turn === s.id}
                turnsLeft={g?.turn === s.id ? g.turnsLeft : 0}
                deadline={g?.turn === s.id ? g.turnDeadline : null}
                now={now}
                reactions={reactionsFor(s.id)}
                selectable={(needTarget || cursed) && myTurn && canTarget(s)}
                selected={target === s.id}
                onSelect={() => setTarget(s.id)}
                onKick={me?.isHost && !s.connected && !s.kicked ? () => void kick(s) : undefined}
                turnMs={(view.settings?.turnSeconds ?? 30) * 1000}
                claimedBy={(g?.claims ?? []).filter((c) => c.victim === s.id).map((c) => nameOf(c.by))}
              />
            ))}
          </div>

          {/* Center */}
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3 short:gap-1.5 short:py-1.5">
            {!g || g.status === "ended" ? (
              <Waiting view={view} me={me} act={act} nameOf={nameOf} />
            ) : (
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 short:gap-2 sm:gap-6 lg:mx-auto lg:max-w-5xl lg:gap-10 lg:px-4">
                {/* Left: draw pile + played cards */}
                <div className="flex flex-col items-center gap-2">
                <div className="flex items-end gap-2 sm:gap-5">
                  <button
                    onClick={() => void run({ type: "draw" })}
                    disabled={!canDraw}
                    className="group relative flex flex-col items-center gap-1 disabled:cursor-default"
                    aria-label="Rút bài"
                  >
                    <div className="relative">
                      <MeoCard type="exploding" faceDown size="md" className={cn("max-sm:w-14 short:w-14 lg:w-24 lg:[--emoji:2.4rem] lg:[--name:12px] 2xl:w-32 2xl:[--emoji:3.2rem] 2xl:[--name:14px]", canDraw && "ring-2 ring-amber-300 group-hover:-translate-y-1")} />
                      <span className="absolute -right-2 -top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs text-amber-200">{g.deckCount}</span>
                    </div>
                    <span className="text-xs text-orange-100/70 max-sm:text-[10px]">{canDraw ? "Bấm để rút" : "Chồng bài"}</span>
                  </button>
                  <button
                    onClick={() => setShowDiscard(true)}
                    disabled={!g.discard.length}
                    className="group flex flex-col items-center gap-1 disabled:cursor-default"
                    aria-label="Xem các lá đã đánh"
                  >
                    {g.discard.length ? (
                      <span className="relative">
                        {g.discard.length > 1 && (
                          <MeoCard type={g.discard[g.discard.length - 2]} size="md" tooltip={false} className="absolute left-1 top-1 -rotate-6 opacity-60 max-sm:w-14 short:w-14 lg:w-24 lg:[--emoji:2.4rem] lg:[--name:12px] 2xl:w-32 2xl:[--emoji:3.2rem] 2xl:[--name:14px]" />
                        )}
                        <MeoCard type={g.discard[g.discard.length - 1]} size="md" tooltip={false} className="relative group-hover:-translate-y-1 max-sm:w-14 short:w-14 lg:w-24 lg:[--emoji:2.4rem] lg:[--name:12px] 2xl:w-32 2xl:[--emoji:3.2rem] 2xl:[--name:14px]" />
                      </span>
                    ) : (
                      <div className="aspect-[5/7] w-[4.6rem] rounded-xl border-2 border-dashed border-white/15 max-sm:w-14 sm:w-20 short:w-14 lg:w-24 2xl:w-32" />
                    )}
                    <span className="text-center text-xs text-orange-100/70 max-sm:text-[10px] max-sm:leading-tight">
                      Đã đánh ({g.discard.length}){g.discard.length ? <span className="ml-1 text-amber-200 underline max-sm:block">👁️ xem</span> : null}
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="rounded-full bg-black/40 px-2 py-0.5">Chiều: {g.dir === 1 ? "↻ xuôi" : "↺ ngược"}</span>
                  {g.implodingAt !== null && (
                    <span className="rounded-full bg-violet-700/60 px-2 py-0.5 font-semibold">
                      🌀 Mèo Tự Huỷ ở lá thứ {g.implodingAt + 1} từ trên xuống
                    </span>
                  )}
                </div>
                </div>
                {/* Right: whose turn, and whatever needs answering (Không!, give a card, hide the kitten…) */}
                <div className="flex w-full min-w-0 flex-col items-center gap-3 short:gap-1.5">
                <p className="text-center text-sm lg:text-base 2xl:text-lg">
                  {myTurn ? (
                    <b className="text-amber-300">Lượt của bạn{g.turnsLeft > 1 ? ` (còn ${g.turnsLeft} lượt)` : ""} — đánh bài hoặc rút để kết thúc lượt</b>
                  ) : g.turn ? (
                    <>
                      Lượt của <b>{nameOf(g.turn)}</b>
                      {g.turnsLeft > 1 && ` (còn ${g.turnsLeft} lượt)`}
                    </>
                  ) : null}
                  {g.turnDeadline && !pending && !choice && !myTurn && <span className="ml-2 text-orange-100/60">⏱ {secondsLeft(g.turnDeadline)}s</span>}
                </p>

                {pending && (
                  <PendingBar
                    pending={pending}
                    nameOf={nameOf}
                    secondsLeft={secondsLeft(pending.deadline) ?? 0}
                    canNope={canNope}
                    ownNope={ownNope && meAlive && !!myNope}
                  />
                )}
                {choice && (
                  <div className="flex max-h-[45dvh] w-full justify-center overflow-y-auto overscroll-contain short:max-h-[70dvh]">
                    <ChoicePanel view={view} choice={choice} nameOf={nameOf} secondsLeft={secondsLeft(choice.deadline) ?? 0} run={run} selected={selected} />
                  </div>
                )}
                {g.shuffleLocked && <p className="rounded-full bg-lime-600/30 px-3 py-0.5 text-xs text-lime-100">🌽 Đang khoá Xáo bài</p>}
                {view.vision && <p className="rounded-xl bg-indigo-500/20 px-3 py-2 text-center text-sm text-indigo-100">{view.vision}</p>}
                {view.future && (
                  <div className="rounded-xl bg-black/40 p-2 text-center">
                    <p className="mb-1 text-xs text-fuchsia-200">
                      {view.sharedBy ? "🤝 Được chia sẻ tương lai — trái là lá trên cùng" : "🔮 Tương lai (chỉ bạn thấy) — trái là lá trên cùng"}
                    </p>
                    <div className="flex gap-2">
                      {view.future.map((t, i) => (
                        <MeoCard key={i} type={t} size="sm" />
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            )}
          </div>

          {/* Me — on big screens this lives in the action dock instead, to keep the table short */}
          {me && !spectator && (
            <div className={cn("flex flex-col items-center gap-2", hand.length > 0 && "lg:hidden")}>
              <div className="flex items-center gap-2 text-sm">
                <Seat
                  seat={me}
                  self
                  isTurn={g?.turn === me.id}
                  turnsLeft={g?.turn === me.id ? g.turnsLeft : 0}
                  deadline={g?.turn === me.id ? g.turnDeadline : null}
                  now={now}
                  reactions={reactionsFor(me.id)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Side: Diễn biến — plays (clickable cards) and every other event in one timeline. */}
        <aside className="flex h-72 min-h-0 shrink-0 flex-col rounded-2xl border border-white/10 bg-black/30 p-3 sm:h-96 lg:h-auto short:h-auto short:p-2">
          <h2 className="mb-2 flex shrink-0 items-center justify-between text-sm font-bold text-amber-200">
            📜 Diễn biến
            {!!g?.plays?.length && <span className="text-[11px] font-normal text-orange-100/50">🃏 {g.plays.length} lượt đánh</span>}
          </h2>
          <EventFeed log={g?.log ?? []} plays={g?.plays ?? []} nameOf={nameOf} meId={view.meId} className="flex-1" />
        </aside>
      </div>

      {/* Actions above the hand; the whole block stays on screen (the hand scrolls inside if it's huge). */}
      {!spectator && hand.length > 0 && (
        // Right padding keeps the floating 😀 / 💬 buttons (bottom-right) off the cards and buttons.
        <div className="flex shrink-0 flex-col items-center pr-12 sm:pr-16">
          <div
            className={cn(
              "relative flex w-full max-w-3xl flex-col items-center gap-1.5 rounded-2xl p-1.5 pt-2 short:gap-1 short:p-1 lg:max-w-none lg:px-3 lg:pt-3",
              myTurn && "bg-rose-500/[0.07]",
              !handOpen && "max-sm:pb-1 max-sm:pt-3.5 short:pb-1 short:pt-3.5",
            )}
          >
            <TurnTimerBorder deadline={myDeadline} totalMs={(view.settings?.turnSeconds ?? 30) * 1000} now={now} />
            {myTurn && (
              <>
                <TurnRing active className="inset-0" />
                <MyTurnBadge className="absolute -top-2.5 left-3 z-10">
                  {/* No countdown in here: it's a live region and would be re-announced every second. */}
                  Lượt của bạn{g && g.turnsLeft > 1 ? ` ×${g.turnsLeft}` : ""}
                </MyTurnBadge>
              </>
            )}
            {/* Phones: the collapsed hand — small cards peeking in one overlapping row; tap to open. */}
            <div className={cn("w-full min-w-0 items-center gap-2", handOpen ? "hidden" : "hidden max-sm:flex short:flex")}>
              <button
                type="button"
                onClick={() => setHandPref(true)}
                className="flex h-12 min-w-0 flex-1 items-start overflow-hidden pl-1 pt-1.5"
                aria-label={`Mở bài trên tay (${hand.length} lá)`}
              >
                {orderedIds.map((id, i) => {
                  const c = handById.get(id);
                  return c ? (
                    <MeoCard
                      key={id}
                      type={c.type}
                      size="sm"
                      tooltip={false}
                      className={cn("!w-11 [--emoji:1.1rem] [--name:7px]", i > 0 && "-ml-5", c.annoyed && "opacity-50 grayscale")}
                    />
                  ) : null;
                })}
              </button>
              <span className="shrink-0 font-mono text-xs text-orange-100/70">🂠 {hand.length}</span>
              {canNope && myNope && (
                <button
                  type="button"
                  onClick={() => void run({ type: "nope", card: myNope.id })}
                  className="min-h-9 shrink-0 animate-pulse rounded-lg bg-gradient-to-b from-red-500 to-red-800 px-3 text-sm font-black text-white shadow-[0_3px_0_#450a0a]"
                >
                  🚫 KHÔNG!
                </button>
              )}
              <button
                type="button"
                onClick={() => setHandPref(true)}
                className="min-h-9 shrink-0 rounded-lg border border-amber-300/50 bg-amber-400/15 px-3 text-sm font-semibold text-amber-100"
                aria-expanded={false}
              >
                ▲ Mở bài
              </button>
            </div>
            <div className={cn("contents", !handOpen && "max-sm:hidden short:hidden")}>
            {/* Target picker: right by the buttons, no need to scroll up to the seats. */}
            {(myTurn || nowPlay) && needTarget && (
              <div className="max-h-[24dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-rose-400/40 bg-rose-950/40 p-2">
                <p className="mb-1.5 text-center text-sm font-semibold text-rose-100">
                  🎯 {planOk?.kind === "zombie" ? "Chọn người đã bị loại để hồi sinh" : `Chọn người để ${actionLabel}`}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {opponents.filter(canTarget).length === 0 && <p className="text-sm text-rose-100/60">Không có ai phù hợp.</p>}
                  {opponents.filter(canTarget).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setTarget(s.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-sm transition-all",
                        target === s.id
                          ? "scale-105 border-rose-300 bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.5)]"
                          : "border-white/15 bg-black/40 hover:border-rose-300/60 hover:bg-rose-500/20",
                      )}
                    >
                      <SeatAvatar
                        name={s.name}
                        out={s.out}
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        fallbackClassName="bg-gradient-to-br from-orange-200 to-orange-500 font-bold text-black"
                      />
                      <span>
                        <b className="block leading-tight">{s.name}</b>
                        <span className="text-xs opacity-75">
                          {s.out ? "đã bị loại" : `🂠 ${s.cardCount} lá`}
                          {!s.connected && " · mất kết nối"}
                        </span>
                      </span>
                      {target === s.id && <span className="text-lg">🎯</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action dock */}
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/40 p-2 sm:p-2.5 short:p-1.5 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-x-3 lg:gap-y-1.5">
              {me && (
                <div className="relative hidden shrink-0 items-center gap-2 border-r border-white/10 pr-3 lg:col-start-1 lg:row-start-1 lg:flex lg:justify-self-start">
                  <span className="relative inline-flex">
                    <SeatBubble reactions={reactionsFor(me.id)} />
                    <SeatAvatar
                      name={me.name}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                      fallbackClassName="bg-gradient-to-br from-orange-200 to-orange-500 font-bold text-black"
                    />
                  </span>
                  <span className="text-sm leading-tight">
                    <b className="block max-w-[9rem] truncate">{me.name}</b>
                    <span className="text-[11px] text-orange-100/70">
                      🂠 {me.cardCount} lá{me.isHost ? " · 👑" : ""}
                      {me.cursed ? " · 🍑 bị nguyền" : ""}
                      {me.games > 0 ? ` · ${signed(me.points)}đ` : ""}
                    </span>
                  </span>
                </div>
              )}
              {(myTurn || nowPlay) && selected.length > 0 && (
                <p className={cn("mb-1.5 rounded-lg px-3 py-1 text-center text-sm lg:col-span-3 lg:row-start-2 lg:mb-0 lg:min-w-0", planError ? "bg-rose-900/50 text-rose-200" : "bg-white/5 text-orange-100")}>
                  {planError ?? (
                    <>
                      <b>{actionLabel}</b>
                      {needTarget &&
                        (target ? (
                          <>
                            {" "}
                            → 🎯 <b>{nameOf(target)}</b>
                          </>
                        ) : (
                          " — hãy chọn mục tiêu"
                        ))}
                    </>
                  )}
                </p>
              )}
              {(myTurn || nowPlay) && needName && (
                <div className="mb-1.5 flex justify-center lg:col-span-3 lg:row-start-3 lg:mb-0">
                  <select
                    value={named}
                    onChange={(e) => setNamed(e.target.value as CardType)}
                    className="rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-sm"
                    aria-label="Loại lá muốn lấy"
                  >
                    <option value="">{needName === "discard" ? "— chọn lá muốn nhặt —" : "— gọi tên lá muốn lấy —"}</option>
                    {(needName === "discard" ? [...new Set(g?.discard ?? [])] : NAMEABLE_TYPES).map((t) => (
                      <option key={t} value={t}>
                        {CARDS[t].emoji} {CARDS[t].name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap items-stretch justify-center gap-2 max-sm:gap-1.5 lg:col-start-2 lg:row-start-1 lg:flex-nowrap">
                {canNope && myNope && (
                  <DockBtn tone="nope" hotkey="N" onClick={() => void run({ type: "nope", card: myNope.id })}>
                    🚫 KHÔNG!
                  </DockBtn>
                )}
                <DockBtn tone="play" hotkey="D" onClick={doPlay} disabled={!canPlay}>
                  ▶ ĐÁNH{selected.length > 1 ? ` ${selected.length} LÁ` : ""}
                </DockBtn>
                <DockBtn tone="draw" hotkey="R" onClick={() => void run({ type: "draw" })} disabled={!canDraw}>
                  🂠 RÚT BÀI
                </DockBtn>
                <span className="contents lg:hidden">
                  <DockBtn tone="ghost" onClick={() => (setSelected([]), setTarget(null), setNamed(""))} disabled={!selected.length}>
                    ✕<span className="sr-only sm:not-sr-only"> Bỏ chọn</span>
                  </DockBtn>
                  {/* Sideways phones: the hint row is dropped to save height, its buttons move here. */}
                  {!cursed && (
                    <button
                      type="button"
                      onClick={toggleCompact}
                      aria-pressed={compact}
                      title="Gộp các lá giống nhau thành một chồng"
                      className={cn(
                        "hidden rounded-xl border px-2.5 text-sm short:inline-flex short:items-center",
                        compact ? "border-amber-300 bg-amber-400/20" : "border-white/20 bg-white/5",
                      )}
                    >
                      🗂️<span className="sr-only"> Gộp lá</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHandPref(false)}
                    aria-expanded
                    title="Thu gọn bài trên tay"
                    className="hidden rounded-xl border border-white/20 bg-white/5 px-2.5 text-sm font-semibold short:inline-flex short:items-center"
                  >
                    ▼<span className="sr-only"> Thu gọn</span>
                  </button>
                </span>
              </div>
              <div className="hidden items-center gap-2 lg:col-start-3 lg:row-start-1 lg:flex lg:justify-self-end">
                <DockBtn tone="ghost" hotkey="B" onClick={() => (setSelected([]), setTarget(null), setNamed(""))} disabled={!selected.length}>
                  ✕ Bỏ chọn
                </DockBtn>
              </div>
            </div>

            <div className="flex w-full max-w-2xl items-start justify-between gap-2 px-1 text-xs text-orange-100/60 sm:text-sm lg:max-w-none short:hidden">
              <p className={cn("min-w-0 flex-1 leading-snug", !focusInfo && "text-[11px] sm:text-xs")}>
                {focusInfo && focus ? (
                  <>
                    <b className={ROLES[roleOf(focus)].text}>
                      {focusInfo.emoji} {focusInfo.name}:
                    </b>{" "}
                    <span className="text-orange-50/85">{focusInfo.effect}</span>
                  </>
                ) : groups ? (
                  "Bấm chồng bài để chọn thêm 1 lá · − để bỏ bớt · kéo ngang để xếp lại"
                ) : (
                  "Bấm lá để chọn · kéo ngang để xếp lại"
                )}
                <span className="hidden lg:inline [@media(pointer:coarse)]:hidden"> Phím tắt: D = đánh · R = rút · N = Không! · B / Esc = bỏ chọn.</span>
              </p>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-[11px] sm:gap-2">
                {handOrder.isCustom && !cursed && (
                  <button onClick={handOrder.reset} className="underline hover:text-orange-50 max-sm:min-h-8">
                    ↺ Xếp tự động
                  </button>
                )}
                {!cursed && (
                  <button
                    onClick={toggleCompact}
                    aria-pressed={compact}
                    title="Gộp các lá giống nhau thành một chồng"
                    className={cn(
                      "rounded-full border px-2 py-0.5 max-sm:min-h-8",
                      compact ? "border-amber-300 bg-amber-400/20 text-amber-100" : "border-white/20 hover:bg-white/10",
                    )}
                  >
                    🗂️ Gộp lá{compact ? ": bật" : ""}
                  </button>
                )}
                {/* Phones: fold the hand down to a strip so the table gets the room. */}
                <button
                  type="button"
                  onClick={() => setHandPref(false)}
                  aria-expanded
                  className="hidden min-h-8 rounded-full border border-white/20 px-2 font-semibold hover:bg-white/10 max-sm:inline-flex max-sm:items-center short:inline-flex short:items-center"
                >
                  ▼ Thu gọn
                </button>
              </span>
            </div>

            <div className="max-h-[32dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain pb-1.5 sm:max-h-[36dvh] short:max-h-[7.5rem] lg:max-h-none lg:overflow-x-auto lg:overflow-y-hidden">
              {groups ? (
                // Stacks can be dragged to reorder too; the new order is saved for the cards inside them.
                <DraggableRow
                  items={groups.map((ids) => ids[0])}
                  onMove={moveGroup}
                  className="w-full flex-wrap justify-center gap-1.5 pt-4 short:pt-3 lg:mx-auto lg:w-max lg:flex-nowrap lg:px-3"
                  renderItem={(_, gi) => {
                    const ids = groups[gi];
                    const c = handById.get(ids[0])!;
                    const picked = ids.filter((id) => selected.includes(id)).length;
                    const behind = Math.min(ids.length - 1, 2);
                    return (
                      <span
                        className="relative block"
                        style={{ marginRight: behind * 5 }}
                        title={c.annoyed ? "Nổi cáu: lá này bị vô hiệu tới hết lượt tới của bạn" : undefined}
                      >
                        {Array.from({ length: behind }, (_, i) => behind - i).map((d) => (
                          <MeoCard
                            key={d}
                            type={c.type}
                            tooltip={false}
                            className={cn(
                              "max-sm:w-[min(4.1rem,calc((100vw_-_108px)/5))] max-sm:[--name:9px] max-sm:[--emoji:1.4rem] short:w-16 short:[--name:9.5px] short:[--emoji:1.6rem] lg:w-24 lg:[--name:12.5px] lg:[--emoji:2.4rem] 2xl:w-28 2xl:[--name:14px] 2xl:[--emoji:2.8rem]",
                              "pointer-events-none absolute left-0 top-0 brightness-75",
                              d === 1 ? "translate-x-[5px] rotate-[4deg]" : "translate-x-[10px] rotate-[8deg]",
                              c.annoyed && "opacity-50 grayscale",
                            )}
                          />
                        ))}
                        <MeoCard
                          type={c.type}
                          selected={picked > 0}
                          onClick={() => clickStack(ids)}
                          className={cn("max-sm:w-[min(4.1rem,calc((100vw_-_108px)/5))] max-sm:[--name:9px] max-sm:[--emoji:1.4rem] short:w-16 short:[--name:9.5px] short:[--emoji:1.6rem] lg:w-24 lg:[--name:12.5px] lg:[--emoji:2.4rem] 2xl:w-28 2xl:[--name:14px] 2xl:[--emoji:2.8rem]", c.annoyed && "opacity-50 grayscale")}
                        />
                        {ids.length > 1 && (
                          <span
                            className={cn(
                              "pointer-events-none absolute -right-2 -top-2 z-10 rounded-full px-1.5 text-xs font-black shadow ring-1",
                              picked ? "bg-amber-400 text-black ring-amber-200" : "bg-black/80 text-amber-200 ring-amber-300/60",
                            )}
                          >
                            {picked ? `${picked}/${ids.length}` : `×${ids.length}`}
                          </span>
                        )}
                        {picked > 0 && ids.length > 1 && !singlePick && (
                          <button
                            onClick={() => unpickOne(ids)}
                            className="absolute -bottom-1 -left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-xs font-black text-amber-200 ring-1 ring-amber-300/60 hover:bg-black"
                            aria-label={`Bỏ chọn 1 lá ${CARDS[c.type]?.name ?? ""}`}
                          >
                            −
                          </button>
                        )}
                        {c.annoyed && <span className="pointer-events-none absolute -left-1 -top-1 z-10 rounded-full bg-amber-500 px-1 text-xs">😾</span>}
                      </span>
                    );
                  }}
                />
              ) : (
                <DraggableRow
                  items={orderedIds}
                  onMove={handOrder.move}
                  disabled={cursed}
                  className="w-full flex-wrap justify-center gap-1.5 pt-4 short:pt-3 lg:mx-auto lg:w-max lg:flex-nowrap lg:px-3"
                  renderItem={(id) => {
                    const c = handById.get(id)!;
                    return (
                      <span className="relative block" title={c.annoyed ? "Nổi cáu: lá này bị vô hiệu tới hết lượt tới của bạn" : undefined}>
                        <MeoCard
                          type={c.type}
                          selected={selected.includes(c.id)}
                          onClick={() => toggle(c)}
                          // Five to a row on a phone (the right gutter is kept free for the 😀 / 💬 buttons), so a big hand stays on screen.
                          className={cn("max-sm:w-[min(4.1rem,calc((100vw_-_108px)/5))] max-sm:[--name:9px] max-sm:[--emoji:1.4rem] short:w-16 short:[--name:9.5px] short:[--emoji:1.6rem] lg:w-24 lg:[--name:12.5px] lg:[--emoji:2.4rem] 2xl:w-28 2xl:[--name:14px] 2xl:[--emoji:2.8rem]", c.annoyed && "opacity-50 grayscale")}
                        />
                        {c.annoyed && <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-xs">😾</span>}
                      </span>
                    );
                  }}
                />
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {showGuide && <CardGuide enabled={g?.expansions ?? view.expansions} onClose={() => setShowGuide(false)} />}
      {showDiscard && g && <DiscardViewer discard={g.discard} plays={g.plays ?? []} nameOf={nameOf} meId={view.meId} onClose={() => setShowDiscard(false)} />}
      {showScores && <ScoreboardModal view={view} note={SCORE_NOTE} onClose={() => setShowScores(false)} className="border-orange-200/15 bg-[#1c0f0a] text-orange-50" />}
      {toast && (
        <div role="alert" className="fixed left-1/2 top-[calc(var(--games-bar-h,0px)+0.5rem)] z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-rose-600 text-center px-4 py-2 text-sm font-medium text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function DockBtn({
  children,
  onClick,
  disabled,
  tone,
  hotkey,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hotkey?: string;
  tone: "play" | "draw" | "nope" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "whitespace-nowrap rounded-xl font-black tracking-wide transition-all enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 max-sm:tracking-normal",
        tone === "play" &&
          "min-w-[7.5rem] bg-gradient-to-b from-amber-300 to-orange-500 px-4 py-2.5 text-base max-sm:min-w-0 max-sm:flex-1 max-sm:px-2 max-sm:py-2 max-sm:text-sm sm:min-w-[9rem] sm:px-6 sm:py-3 sm:text-lg short:py-1.5 short:text-base text-black shadow-[0_4px_0_#9a3412,0_0_24px_rgba(251,191,36,0.35)] enabled:hover:brightness-110",
        tone === "draw" &&
          "min-w-[7rem] bg-gradient-to-b from-emerald-400 to-emerald-700 px-4 py-2.5 text-base max-sm:min-w-0 max-sm:flex-1 max-sm:px-2 max-sm:py-2 max-sm:text-sm sm:min-w-[8rem] sm:px-5 sm:py-3 sm:text-lg short:py-1.5 short:text-base text-white shadow-[0_4px_0_#064e3b] enabled:hover:brightness-110",
        tone === "nope" &&
          "min-w-[7.5rem] animate-pulse bg-gradient-to-b from-red-500 to-red-800 px-4 py-2.5 text-lg max-sm:min-w-0 max-sm:flex-1 max-sm:basis-full max-sm:px-2 max-sm:py-2 max-sm:text-sm sm:min-w-[9rem] sm:px-6 sm:py-3 sm:text-xl short:py-1.5 short:text-base text-white shadow-[0_4px_0_#450a0a,0_0_28px_rgba(239,68,68,0.6)]",
        tone === "ghost" && "border border-white/20 bg-white/5 px-3 py-2 text-sm sm:px-4 short:py-1 font-semibold enabled:hover:bg-white/10",
      )}
    >
      {children}
      {hotkey && (
        <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
    </button>
  );
}

/** Every card played so far (newest first) with what it does. */
function DiscardViewer({
  discard,
  plays,
  nameOf,
  meId,
  onClose,
}: {
  discard: CardType[];
  plays: MeoPlay[];
  nameOf: (id: string) => string;
  meId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"pile" | "plays">("pile");
  const [focus, setFocus] = useState<CardType | null>(discard[discard.length - 1] ?? null);
  const newestFirst = discard.slice().reverse();
  const counts = discard.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {});
  const info = focus ? CARDS[focus] : null;
  return (
    <Sheet
      title={`🗂️ Các lá đã đánh (${discard.length})`}
      label="Các lá đã đánh"
      onClose={onClose}
      className="max-w-3xl border-orange-200/15 bg-[#1c0f0a] text-orange-50"
      bodyClassName="flex flex-col overflow-hidden"
    >
        {info && focus && (
          <div className="flex shrink-0 items-start gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
            <MeoCard type={focus} size="md" tooltip={false} className="max-sm:w-14 max-sm:[--emoji:1.4rem] max-sm:[--name:9px]" />
            <div className="min-w-0 text-sm">
              <p className="text-base font-bold text-amber-200">
                {info.emoji} {info.name} <span className="text-xs font-normal text-orange-100/60">· đã đánh {counts[focus] ?? 0} lá</span>
              </p>
              <p className="mt-1 text-orange-100/70">
                <b>Khi nào:</b> {info.how}
              </p>
              <p className="mt-1">{info.effect}</p>
            </div>
          </div>
        )}
        <div className="flex shrink-0 gap-1 border-b border-white/10 px-4 pt-2 text-xs font-semibold">
          {(
            [
              ["pile", `🗂️ Chồng bài (${discard.length})`],
              ["plays", `🃏 Ai đánh gì (${plays.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("min-h-9 rounded-t-md px-3 py-1.5", tab === id ? "bg-amber-400 text-black" : "text-orange-100/70 hover:bg-white/10")}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "pile" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <p className="mb-2 text-xs text-orange-100/60">Mới nhất ở đầu — bấm vào lá để xem chức năng.</p>
            <div className="flex flex-wrap gap-2 pt-3">
              {newestFirst.map((t, i) => (
                <MeoCard key={i} type={t} size="sm" tooltip={false} selected={focus === t} onClick={() => setFocus(t)} />
              ))}
            </div>
          </div>
        ) : (
          <PlayHistory plays={plays} nameOf={nameOf} meId={meId} className="min-h-0 flex-1 overflow-hidden p-4" />
        )}
    </Sheet>
  );
}

function Seat({
  seat,
  self,
  isTurn,
  turnsLeft,
  deadline,
  now,
  reactions,
  selectable,
  selected,
  onSelect,
  onKick,
  turnMs = 30_000,
  claimedBy = [],
}: {
  seat: MeoSeatView;
  self?: boolean;
  isTurn: boolean;
  turnsLeft: number;
  deadline: number | null;
  now: number;
  reactions: Reaction[];
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onKick?: () => void;
  turnMs?: number;
  claimedBy?: string[];
}) {
  const left = deadline ? Math.min(1, Math.max(0, (deadline - now) / turnMs)) : 0;
  const Tag = selectable ? "button" : "div";
  return (
    <Tag
      onClick={selectable ? onSelect : undefined}
      className={cn(
        "relative flex min-w-[4rem] flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-all sm:min-w-[5.5rem] sm:px-2 short:gap-0.5 short:py-1",
        selectable && !selected && "cursor-pointer outline-dashed outline-2 outline-offset-2 outline-amber-300/70 hover:bg-amber-400/15 motion-safe:animate-pulse",
        selected && "scale-105 bg-rose-500/25 outline outline-2 outline-offset-2 outline-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.45)]",
      )}
    >
      {selected && (
        <span className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-rose-500 px-2 text-xs font-bold text-white shadow">
          🎯 Mục tiêu
        </span>
      )}
      <span className="relative inline-flex">
        {isTurn && (
          <span
            className="absolute -inset-1 rounded-full"
            style={{
              background: `conic-gradient(${left < 0.27 ? "#f43f5e" : "#fbbf24"} ${left * 360}deg, transparent 0)`,
              mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
            }}
          />
        )}
        <SeatBubble reactions={reactions} />
        <SeatAvatar
          name={seat.name}
          out={seat.out}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-base sm:h-11 sm:w-11 sm:text-lg 2xl:h-14 2xl:w-14 2xl:text-xl short:h-8 short:w-8 short:text-sm",
            (!seat.connected || seat.kicked) && "opacity-50 grayscale",
          )}
          fallbackClassName={cn("bg-gradient-to-br from-orange-200 to-orange-500 font-bold text-black", seat.out && "from-zinc-500 to-zinc-700")}
        />
      </span>
      <span className={cn("truncate text-xs font-semibold 2xl:text-sm", self ? "max-w-[8rem]" : "max-w-[4rem] sm:max-w-[6rem] 2xl:max-w-[8rem]")}>
        {seat.name}
        {self && " (bạn)"}
      </span>
      <span className="flex flex-wrap items-center justify-center gap-1 text-[11px]">
        {seat.isHost && <span title="Chủ bàn">👑</span>}
        {seat.inGame && !seat.out && <span className="rounded bg-black/40 px-1.5 font-mono">🂠 {seat.cardCount}</span>}
        {isTurn && turnsLeft > 1 && <span className="rounded bg-red-600/60 px-1.5">×{turnsLeft}</span>}
        {seat.out && <span className="rounded bg-zinc-700 px-1.5">Đã nổ</span>}
        {!seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1.5 text-rose-200">Mất kết nối</span>}
        {seat.kicked && <span className="rounded bg-rose-900/60 px-1.5 text-rose-200">Bị kích</span>}
        {seat.cursed && (
          <span className="rounded bg-rose-500/40 px-1.5" title="Lời nguyền mông mèo: đang chơi bài úp">
            🍑 Bị nguyền
          </span>
        )}
        {claimedBy.map((n) => (
          <span key={n} className="rounded bg-teal-600/50 px-1.5" title={`Lá tiếp theo người này rút sẽ về tay ${n}`}>
            🫳 {n}
          </span>
        ))}
        {seat.games > 0 && <span className={cn("font-mono max-sm:hidden", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")}>{signed(seat.points)}đ</span>}
      </span>
      {!!seat.marked?.length && (
        <span className="flex gap-0.5" title="Lá bị Đánh dấu — ai cũng thấy">
          {seat.marked.map((t, i) => (
            <MeoCard key={i} type={t} size="sm" className="!w-7" tooltip={false} />
          ))}
        </span>
      )}
      {onKick && (
        <ConfirmButton
          as="span"
          onConfirm={onKick}
          confirmLabel="Chắc chắn?"
          title="Kích người mất kết nối"
          className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-rose-500 max-sm:px-3 max-sm:py-1.5"
        >
          Kích
        </ConfirmButton>
      )}
    </Tag>
  );
}

const PENDING_LABEL: Record<string, string> = { pair: "đôi mèo", triple: "bộ ba mèo", five: "5 lá khác nhau" };

function PendingBar({
  pending,
  nameOf,
  secondsLeft,
  canNope,
  ownNope,
}: {
  pending: NonNullable<NonNullable<MeoRoomView["current"]>["pending"]>;
  nameOf: (id: string) => string;
  secondsLeft: number;
  canNope: boolean;
  /** Holding a Không! but the card on top of the chain is your own. */
  ownNope?: boolean;
}) {
  const label = PENDING_LABEL[pending.kind] ?? cardName(pending.kind as CardType);
  const blocked = pending.nopes % 2 === 1;
  return (
    <div className="w-full max-w-md rounded-xl border border-red-400/40 bg-black/50 p-3 text-center">
      <p className="text-sm">
        <b>{nameOf(pending.by)}</b> đánh <b className="text-amber-200">{label}</b>
        {pending.target && (
          <>
            {" "}
            → <b>{nameOf(pending.target)}</b>
          </>
        )}
        {pending.named && <> (đòi {cardName(pending.named)})</>}
      </p>
      <p className={cn("mt-1 text-sm font-bold", blocked ? "text-red-300" : "text-emerald-300")}>
        {pending.nopes === 0 ? "Chưa ai chặn" : blocked ? `Đang bị chặn (×${pending.nopes})` : `Đã được gỡ chặn (×${pending.nopes})`}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          key={pending.deadline}
          className="h-full bg-red-500"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: Math.max(secondsLeft, 0.1), ease: "linear" }}
        />
      </div>
      <p className="mt-1 text-xs text-orange-100/60">Còn {secondsLeft}s để đánh “Không!”</p>
      {/* The button itself is in the action dock by the hand (one place, always in reach). */}
      {canNope && <p className="mt-1 text-xs font-semibold text-red-200">Bấm 🚫 KHÔNG! ngay trên bài của bạn để chặn</p>}
      {!canNope && ownNope && <p className="mt-1 text-xs text-orange-100/50">Lá trên cùng là của bạn — không tự chặn được.</p>}
    </div>
  );
}

function ChoicePanel({
  view,
  choice,
  nameOf,
  secondsLeft,
  run,
  selected,
}: {
  view: MeoRoomView;
  choice: NonNullable<NonNullable<MeoRoomView["current"]>["choice"]>;
  nameOf: (id: string) => string;
  secondsLeft: number;
  run: (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;
  selected: number[];
}) {
  const deckCount = view.current?.deckCount ?? 0;
  // Not in the top / bottom 10% of the deck (anywhere if the deck is tiny).
  const [minPos, maxPos] = insertRange(deckCount);
  const [pos, setPos] = useState(minPos);
  const safePos = Math.min(maxPos, Math.max(minPos, pos));
  const [order, setOrder] = useState<MCard[]>(view.alter ?? []);
  useEffect(() => setOrder(view.alter ?? []), [view.alter?.map((c) => c.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = choice.kind === "favor" ? choice.from === view.meId : choice.player === view.meId;
  const timer = <span className="text-orange-100/60"> · {secondsLeft}s</span>;

  if (!mine) {
    const who = choice.kind === "favor" ? choice.from : choice.player;
    const what =
      choice.kind === "favor"
        ? `đang chọn 1 lá để đưa cho ${nameOf(choice.to)}`
        : choice.kind === "dig"
          ? "đang đào bài ⛏️"
        : choice.kind === "offer"
          ? choice.mode === "potluck"
            ? "đang chọn 1 lá góp lên đầu chồng bài"
            : choice.mode === "feed"
              ? "đang chọn 1 lá cho xác sống ăn"
              : "đang chọn 1 lá bỏ vào chồng bài"
          : choice.kind === "bury"
            ? "đang chôn lá trên cùng vào chồng bài"
        : choice.kind === "alter"
          ? "đang sắp xếp lại tương lai"
          : choice.kind === "implode"
            ? "đang đặt Mèo Tự Huỷ (ngửa) vào chồng bài"
            : "đang bí mật nhét Mèo Nổ vào chồng bài";
    const seer = choice.kind === "defuse" ? view.hand.find((c) => c.type === "clairvoyance") : undefined;
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="rounded-xl bg-black/40 px-3 py-2 text-sm">
          <b>{nameOf(who)}</b> {what}…{timer}
        </p>
        {seer && (
          <button onClick={() => void run({ type: "see", card: seer.id })} className="min-h-9 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400">
            👁️ Dùng Thấu thị — xem họ nhét ở đâu
          </button>
        )}
      </div>
    );
  }

  if (choice.kind === "favor") {
    return (
      <div className="rounded-xl border border-amber-300/40 bg-black/50 p-3 text-center text-sm">
        <p>
          🙏 <b>{nameOf(choice.to)}</b> xin bạn 1 lá — chọn 1 lá trên tay rồi bấm Đưa{timer}
        </p>
        <button
          disabled={selected.length !== 1}
          onClick={() => void run({ type: "give", card: selected[0] })}
          className="mt-2 min-h-9 rounded-lg bg-amber-400 px-4 py-1.5 font-semibold text-black disabled:opacity-40"
        >
          Đưa lá đã chọn
        </button>
      </div>
    );
  }

  if (choice.kind === "offer") {
    return (
      <div className="rounded-xl border border-amber-300/40 bg-black/50 p-3 text-center text-sm">
        <p>
          {choice.mode === "potluck"
            ? "🍲 Góp nồi — chọn 1 lá đặt lên đầu chồng bài"
            : choice.mode === "feed"
              ? "🍖 Nuôi xác sống — chọn 1 lá bỏ vào chồng bài đã đánh"
              : "🗑️ Dọn rác — chọn 1 lá bỏ vào chồng bài (sẽ được xáo)"}
          {timer}
        </p>
        <button
          disabled={selected.length !== 1}
          onClick={() => void run({ type: "give", card: selected[0] })}
          className="mt-2 min-h-9 rounded-lg bg-amber-400 px-4 py-1.5 font-semibold text-black disabled:opacity-40"
        >
          {choice.mode === "potluck" ? "Góp lá đã chọn" : "Bỏ lá đã chọn"}
        </button>
      </div>
    );
  }

  if (choice.kind === "dig") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-500/40 bg-black/50 p-3 text-center text-sm">
        <p>⛏️ Lá trên cùng là (chỉ bạn thấy):{timer}</p>
        {view.dig && <MeoCard type={view.dig} size="md" />}
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => void run({ type: "dig", keep: true })} className="min-h-9 rounded-md bg-amber-400 px-3 py-1 font-semibold text-black">
            Giữ lá này
          </button>
          <button onClick={() => void run({ type: "dig", keep: false })} className="min-h-9 rounded-md border border-white/20 px-3 py-1 hover:bg-white/10">
            Bỏ qua, lấy lá bên dưới
          </button>
        </div>
      </div>
    );
  }

  if (choice.kind === "bury") {
    const buryPos = Math.min(deckCount, Math.max(0, pos));
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-300/40 bg-black/50 p-3 text-center text-sm">
        <p>
          ⚰️ Chôn lá trên cùng (không ai biết là lá gì) vào đâu?{timer}
        </p>
        <input type="range" min={0} max={deckCount} value={buryPos} onChange={(e) => setPos(Number(e.target.value))} className="mt-2 w-full accent-amber-400" aria-label="Vị trí chôn" />
        <p className="text-amber-200">
          {buryPos === 0 ? "Trên cùng" : buryPos === deckCount ? "Dưới cùng" : `Lá thứ ${buryPos + 1}`} <span className="text-xs text-orange-100/50">/ {deckCount + 1} lá</span>
        </p>
        <button onClick={() => void run({ type: "insert", position: buryPos })} className="mt-2 min-h-9 rounded-md bg-amber-400 px-3 py-1 font-semibold text-black">
          Chôn ở đây
        </button>
      </div>
    );
  }

  if (choice.kind === "alter") {
    const move = (i: number, d: number) =>
      setOrder((o) => {
        const a = o.slice();
        const j = i + d;
        if (j < 0 || j >= a.length) return a;
        [a[i], a[j]] = [a[j], a[i]];
        return a;
      });
    return (
      <div className="rounded-xl border border-purple-300/40 bg-black/50 p-3 text-center text-sm">
        <p className="mb-2">
          🪄 Sắp xếp lại tương lai (trái = lá trên cùng){"share" in choice && choice.share ? " — người kế tiếp sẽ được xem" : ""}
          {timer}
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {order.map((c, i) => (
            <div key={c.id} className="flex flex-col items-center gap-1">
              <MeoCard type={c.type} size="sm" />
              <div className="flex gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="min-h-9 min-w-9 rounded bg-white/10 px-1.5 disabled:opacity-30">
                  ◀
                </button>
                <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="min-h-9 min-w-9 rounded bg-white/10 px-1.5 disabled:opacity-30">
                  ▶
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => void run({ type: "alter", order: order.map((c) => c.id) })} className="mt-2 min-h-9 rounded-lg bg-amber-400 px-4 py-1.5 font-semibold text-black">
          Xong
        </button>
      </div>
    );
  }

  // Hide a kitten: defuse (secret) or imploding (face up).
  const label = (i: number) => (i === 0 ? "Trên cùng" : i === deckCount ? "Dưới cùng" : `Lá thứ ${i + 1}`);
  const limited = minPos > 0;
  return (
    <div className="w-full max-w-md rounded-xl border border-emerald-300/40 bg-black/50 p-3 text-center text-sm">
      <p>
        {choice.kind === "implode" ? "🌀 Đặt Mèo Tự Huỷ (ngửa, ai cũng thấy) vào đâu?" : "🧯 Gỡ bom thành công! Bí mật nhét Mèo Nổ vào đâu?"}
        {timer}
      </p>
      <input
        type="range"
        min={minPos}
        max={maxPos}
        value={safePos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="mt-2 w-full accent-amber-400"
        aria-label="Vị trí"
      />
      <p className="text-amber-200">
        {label(safePos)} <span className="text-xs text-orange-100/50">/ {deckCount} lá</span>
      </p>
      {limited && (
        <p className="text-xs text-orange-100/60">
          Không được nhét vào 10% trên cùng / dưới cùng — chọn từ lá thứ {minPos + 1} đến lá thứ {maxPos + 1}.
        </p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button onClick={() => void run({ type: "insert", position: minPos })} className="min-h-9 rounded-md border border-white/20 px-2 py-1 hover:bg-white/10">
          {limited ? "Cao nhất" : "Trên cùng"}
        </button>
        <button
          onClick={() => void run({ type: "insert", position: minPos + Math.floor(Math.random() * (maxPos - minPos + 1)) })}
          className="min-h-9 rounded-md border border-white/20 px-2 py-1 hover:bg-white/10"
        >
          Ngẫu nhiên
        </button>
        <button onClick={() => void run({ type: "insert", position: maxPos })} className="min-h-9 rounded-md border border-white/20 px-2 py-1 hover:bg-white/10">
          {limited ? "Thấp nhất" : "Dưới cùng"}
        </button>
        <button onClick={() => void run({ type: "insert", position: safePos })} className="min-h-9 rounded-md bg-amber-400 px-3 py-1 font-semibold text-black">
          Nhét vào {label(safePos).toLowerCase()}
        </button>
      </div>
    </div>
  );
}

function Waiting({
  view,
  me,
  act,
  nameOf,
}: {
  view: MeoRoomView;
  me: MeoSeatView | null;
  act: (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;
  nameOf: (id: string) => string;
}) {
  const g = view.current;
  const count = view.seats.filter(Boolean).length;
  const ended = g?.status === "ended";
  const last = view.history[view.history.length - 1];
  const isHost = !!me?.isHost && view.role === "player";
  const settings = view.settings ?? DEFAULT_MEO_SETTINGS;
  const preset = settings.preset ?? "classic";
  const currentPreset = PRESETS.find((p) => p.id === preset);
  const [group, setGroup] = useState<string>(currentPreset?.group ?? "custom");
  const minP = view.minPlayers ?? 2;
  const toggle = (e: Expansion) =>
    void act({ type: "settings", expansions: view.expansions.includes(e) ? view.expansions.filter((x) => x !== e) : [...view.expansions, e] });

  return (
    <div className="w-full max-w-md rounded-2xl bg-black/45 p-4 backdrop-blur-sm">
      {ended && g ? (
        <>
          <h2 className="mb-2 text-lg font-bold text-amber-300">🏁 {nameOf(g.finished[0])} sống sót cuối cùng!</h2>
          <ol className="mb-3 space-y-1 text-sm">
            {g.finished.map((id, i) => (
              <li key={id} className="flex items-center justify-between">
                <span>
                  <b className="mr-2 text-amber-300">#{i + 1}</b>
                  {i === 0 ? "😼 " : "💥 "}
                  {nameOf(id)}
                  {id === view.meId && " (bạn)"}
                </span>
                {last?.results.find((r) => r.id === id) && <DeltaBadge delta={last.results.find((r) => r.id === id)!.delta} />}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-lg font-bold text-amber-300">😼 Mèo Nổ</h2>
          <p className="mb-3 text-sm text-orange-100/80">
            {count}/{view.maxPlayers} người · gửi link mời để bạn bè vào bàn
          </p>
        </>
      )}

      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-400/10 px-2 py-1.5 text-xs">
        <span>
          Chế độ: <b className="text-amber-200">{currentPreset ? `${currentPreset.emoji} ${currentPreset.name}` : "🧩 Tuỳ chỉnh"}</b>
        </span>
        <span className="text-orange-100/60">
          {minP}–{view.maxPlayers} người · ⏱ {settings.turnSeconds}s
        </span>
      </div>
      <SettingsTabs
        className="mb-3"
        tabs={[
          {
            id: "mode",
            label: "🎮 Chế độ",
            content: (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[...PRESET_GROUPS, { id: "custom", name: "Tuỳ chỉnh" }].map((grp) => (
                    <button
                      key={grp.id}
                      onClick={() => setGroup(grp.id)}
                      className={cn(
                        "min-h-9 flex-1 rounded-full px-2 py-1 text-[11px] font-semibold leading-tight",
                        group === grp.id ? "bg-orange-200 text-black" : "bg-black/30 text-orange-100/70 hover:bg-black/50",
                      )}
                    >
                      {grp.name}
                    </button>
                  ))}
                </div>
                {group !== "custom" ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRESETS.filter((p) => p.group === group).map((p) => {
                      const on = preset === p.id;
                      const fits = count >= p.minPlayers && count <= p.maxPlayers;
                      return (
                        <button
                          key={p.id}
                          disabled={!isHost}
                          onClick={() => void act({ type: "settings", preset: p.id })}
                          title={p.packs.length ? p.packs.map((x) => PACKS[x].name).join(" + ") : "Bộ cơ bản, không gói mở rộng"}
                          className={cn(
                            "flex flex-col items-start rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                            on ? "bg-amber-400 text-black" : "bg-white/5 text-orange-50",
                            isHost && !on && "hover:bg-white/10",
                            !fits && !on && "opacity-50",
                          )}
                        >
                          <span className="font-semibold">
                            {p.emoji} {p.name}
                          </span>
                          <span className={cn("text-[10px]", on ? "text-black/70" : "text-orange-100/60")}>
                            {p.packs.length ? p.packs.map((x) => PACKS[x].emoji).join(" ") : "Cơ bản"} · {p.minPlayers}–{p.maxPlayers} người
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {preset !== "custom" && (
                      <button
                        disabled={!isHost}
                        onClick={() => void act({ type: "settings", preset: "custom" })}
                        className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                      >
                        🧩 Dùng chế độ tuỳ chỉnh
                      </button>
                    )}
                    {SELECTABLE_PACKS.map((e) => {
                      const on = preset === "custom" && view.expansions.includes(e);
                      return (
                        <label
                          key={e}
                          title={PACKS[e].blurb}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                            on ? "bg-amber-400/15 ring-1 ring-amber-300/50" : "bg-white/5",
                            isHost && preset === "custom" ? "cursor-pointer" : "cursor-default opacity-60",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!isHost || preset !== "custom"}
                            onChange={() => toggle(e)}
                            className="accent-amber-400"
                          />
                          <b>
                            {PACKS[e].emoji} {PACKS[e].name}
                          </b>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "time",
            label: "⏱️ Thời gian",
            content: (
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2">
                  <span>Thời gian mỗi lượt</span>
                  <select
                    value={settings.turnSeconds}
                    disabled={!isHost}
                    onChange={(e) => void act({ type: "settings", turnSeconds: Number(e.target.value) })}
                    className="min-h-9 rounded bg-black/40 px-2 py-1"
                  >
                    {TURN_SECONDS_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v} giây
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Thời gian bấm “Không!”</span>
                  <select
                    value={settings.nopeSeconds}
                    disabled={!isHost}
                    onChange={(e) => void act({ type: "settings", nopeSeconds: Number(e.target.value) })}
                    className="min-h-9 rounded bg-black/40 px-2 py-1"
                  >
                    {NOPE_SECONDS_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {String(v).replace(".", ",")} giây
                      </option>
                    ))}
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
                first={settings.first}
                second={settings.second}
                players={count}
                editable={isHost}
                onChange={(v) => void act({ type: "settings", ...v })}
              />
            ),
          },
        ]}
      />
      {(count < minP || count > view.maxPlayers) && (
        <p className="mb-2 rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-100">
          Chế độ này dành cho {minP}–{view.maxPlayers} người (đang có {count}).
        </p>
      )}
      {!isHost && <p className="mb-2 text-xs text-orange-100/50">Chỉ chủ bàn đổi được cài đặt.</p>}

      {isHost ? (
        <button
          onClick={() => void act({ type: "start" })}
          disabled={count < minP || count > view.maxPlayers}
          // Sideways phones scroll this long panel inside the short table: the button stays pinned at the bottom.
          className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-700 disabled:text-black/70 short:sticky short:bottom-0 short:z-10 short:shadow-[0_-6px_14px_rgba(0,0,0,0.55)]"
        >
          {count < minP ? `Cần ít nhất ${minP} người` : count > view.maxPlayers ? `Tối đa ${view.maxPlayers} người` : ended ? "Ván mới" : "Bắt đầu"}
        </button>
      ) : (
        <p className="text-sm text-orange-100/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
      )}
    </div>
  );
}

function BoomOverlay({ fx }: { fx: BoomFx | null }) {
  return (
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.id}
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {fx.tone === "boom" && (
            <motion.div
              className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle,rgba(251,146,60,0.8)_0%,rgba(220,38,38,0.4)_40%,transparent_75%)]"
              animate={{ opacity: [0, 1, 0.3, 0.8, 0] }}
              transition={{ duration: 1.8 }}
            />
          )}
          <motion.div
            className={cn(
              "relative text-center font-black drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)]",
              fx.tone === "boom" ? "text-6xl text-orange-300 sm:text-8xl" : fx.tone === "defuse" ? "text-5xl text-emerald-300" : "text-5xl text-red-400",
            )}
            initial={{ scale: 3, opacity: 0, rotate: -10 }}
            animate={{ scale: [3, 0.9, 1.1, 1], opacity: 1, rotate: [-10, 5, -2, 0] }}
            transition={{ duration: 0.5 }}
          >
            {fx.tone === "boom" ? "💥 BÙM!" : fx.tone === "defuse" ? "🧯 PHÙ!" : "🚫 KHÔNG!"}
          </motion.div>
          <motion.p className="relative mt-2 max-w-sm rounded-full bg-black/60 px-3 py-1 text-center text-sm text-white" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
            {fx.text}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
