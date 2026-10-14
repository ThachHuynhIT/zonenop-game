"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { useCallback, useEffect, useState } from "react";
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
import { GATE, HORSES, MAX_PLAYERS, STABLE, TURN_SECONDS_OPTIONS } from "@/lib/cangua/board";
import { CANGUA_WS_PATH, type CNGameView, type CNPlayerView, type CNRoomView, type CNSeatView } from "@/lib/cangua/protocol";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { CaNguaBoard, HORSE_COLORS, HorseChip, RollingDie } from "./Board";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { WinCelebration } from "@/components/games/WinCelebration";

type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

const SCORE_NOTE =
  "Điểm theo thứ hạng: ai đưa đủ 4 ngựa về chuồng trước xếp trên, những người còn lại xếp theo quãng đường các ngựa đã đi. Chủ bàn chọn điểm Nhất / Nhì, các hạng cuối trừ tương ứng, tổng mỗi ván luôn bằng 0.";

function localize(view: CNRoomView): CNRoomView {
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

const homeCount = (p: CNPlayerView) => p.horses.filter((x) => x > GATE).length;
const outCount = (p: CNPlayerView) => p.horses.filter((x) => x !== STABLE && x <= GATE).length;
const stableCount = (p: CNPlayerView) => p.horses.filter((x) => x === STABLE).length;

export default function CaNguaTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, call } = useGameRoom<CNRoomView>(CANGUA_WS_PATH, code, name, watch ? "watch" : "play", localize);
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
            <Link href={`/co-ca-ngua/${code}?watch=1`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black">
              Vào xem 👀
            </Link>
          )}
          <Link href="/co-ca-ngua" className="rounded-lg border border-white/25 px-4 py-2 font-semibold">
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

function Table({ view, reconnecting, act, toast }: { view: CNRoomView; reconnecting: boolean; act: Act; toast: string | null }) {
  const g = view.current;
  const playing = g?.status === "playing";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const mine = g?.players.find((p) => p.id === view.meId) ?? null;
  const myTurn = !!mine && playing && g?.turn === view.meId;
  const now = useNow(!!playing);
  const nameOf = (id: string) => view.seats.find((s) => s?.id === id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";

  const [showScores, setShowScores] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
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
    const url = new URL(`/co-ca-ngua/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };

  const kick = async (s: CNSeatView) => {
    // The Kích button asks for a second tap itself (window.confirm is blocked in some in-app browsers).
    await act({ type: "kick", playerId: s.id });
  };

  const canMove = myTurn && g?.phase === "move";

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-3 px-2 pb-24 pt-2 sm:px-4 sm:pt-3 lg:pb-3 short:gap-2 short:pb-2 short:pt-1.5">
      <WinCelebration show={g?.status === "ended"} playing={!!playing} won={!!view.meId && g?.finished[0] === view.meId} title={g?.status === "ended" ? `🏆 ${nameOf(g.finished[0])} thắng` : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/co-ca-ngua" className={headerBtn}>
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
          <SpectatorReactions reactions={live} />
          <Waiting view={view} me={me} act={act} nameOf={nameOf} />
        </div>
      ) : (
        <div className="grid flex-1 content-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] short:grid-cols-[auto_minmax(0,1fr)] short:gap-2">
          <div className="relative flex min-w-0 justify-center">
            <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
            {/* Square board: as wide as the column, never taller than the screen. */}
            <div className="w-full max-w-[calc(100dvh-5.5rem)] short:w-[calc(100dvh-3.4rem)] short:max-w-none">
              <CaNguaBoard
                players={g.players}
                last={g.last}
                turn={g.turn}
                legal={canMove ? g.legal : []}
                die={g.die}
                ladder={view.settings.ladder}
                meId={view.meId}
                onPick={canMove && !busy ? (h) => void run({ type: "move", horse: h }) : undefined}
              />
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-3 short:max-h-[calc(100dvh-3.4rem)] short:gap-2 short:overflow-y-auto short:pt-3">
            <TurnPanel g={g} view={view} myTurn={myTurn} busy={busy} run={run} nameOf={nameOf} now={now} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {g.players.map((p) => {
                const seat = view.seats.find((s) => s?.id === p.id) ?? null;
                return (
                  <PlayerRow
                    key={p.id}
                    p={p}
                    name={nameOf(p.id)}
                    seat={seat}
                    self={p.id === view.meId}
                    isTurn={g.turn === p.id}
                    rank={g.finished.indexOf(p.id)}
                    reactions={reactionsFor(p.id)}
                    onKick={me?.isHost && seat && !seat.connected && !seat.kicked ? () => void kick(seat) : undefined}
                  />
                );
              })}
            </div>
            <div className="rounded-2xl bg-black/35 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-100/60">Diễn biến</p>
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs short:max-h-32">
                {g.log
                  .slice()
                  .reverse()
                  .map((e) => (
                    <li
                      key={e.id}
                      className={cn(
                        "rounded px-2 py-1",
                        e.tone === "kick" ? "bg-rose-500/20 text-rose-100" : e.tone === "home" ? "bg-amber-500/20 text-amber-100" : e.tone === "move" ? "bg-emerald-500/10 text-white/85" : "text-white/70",
                      )}
                    >
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

      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={SCORE_NOTE} />}
      {showRules && (
        <Modal onClose={() => setShowRules(false)}>
          <h2 className="mb-3 text-lg font-bold text-amber-300">📖 Luật Cờ Cá Ngựa</h2>
          <CaNguaRules settings={view.settings} />
        </Modal>
      )}
    </div>
  );
}

function TurnPanel({
  g,
  view,
  myTurn,
  busy,
  run,
  nameOf,
  now,
}: {
  g: CNGameView;
  view: CNRoomView;
  myTurn: boolean;
  busy: boolean;
  run: Act;
  nameOf: (id: string) => string;
  now: number;
}) {
  const turnP = g.players.find((p) => p.id === g.turn);
  const roller = g.roll ? g.players.find((p) => p.id === g.roll!.player) : null;
  const rollColor = roller ? HORSE_COLORS[roller.color].fill : undefined;
  // Roll (or let the timer roll) — same guard as the roll button below.
  const canRoll = myTurn && g.phase === "roll" && !busy;
  // Move: number keys pick among the glowing horses (badge order = g.legal order); a single option also takes Space / Enter.
  const canMove = myTurn && g.phase === "move" && !busy;
  const doRoll = canRoll ? () => void run({ type: "roll" }) : undefined;
  const moveKey = (i: number) => (canMove && g.legal[i] !== undefined ? () => void run({ type: "move", horse: g.legal[i] }) : undefined);
  const onlyMove = canMove && g.legal.length === 1 ? moveKey(0) : undefined;
  useHotkeys({ " ": doRoll ?? onlyMove, Enter: doRoll ?? onlyMove, r: doRoll, "1": moveKey(0), "2": moveKey(1), "3": moveKey(2), "4": moveKey(3) });

  return (
    <div className={cn("relative rounded-2xl border border-amber-200/15 bg-black/40 p-3 pt-4", myTurn && "bg-rose-500/10")}>
      <TurnTimerBorder deadline={g.deadline} totalMs={view.settings.turnSeconds * 1000} now={now} />
      <TurnRing active={myTurn} className="inset-0" />
      <div className="flex items-center gap-3">
        <RollingDie value={g.roll?.value ?? null} seq={g.roll?.seq ?? 0} color={rollColor} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex flex-wrap items-center gap-1.5">
            {myTurn ? (
              <MyTurnBadge />
            ) : (
              <>
                {turnP && <HorseChip color={turnP.color} className="w-5 text-[10px]" />}
                <span>
                  Lượt của <b>{nameOf(g.turn ?? "")}</b>
                </span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-white/65">
            {g.roll ? (
              <>
                {g.roll.player === view.meId ? "Bạn" : nameOf(g.roll.player)} gieo được <b className="text-amber-200">{g.roll.value}</b>
              </>
            ) : (
              "Chưa ai gieo"
            )}
            {g.sixes > 0 && g.phase === "roll" && g.turn === g.roll?.player && <span className="ml-1 text-amber-300">· được gieo tiếp!</span>}
          </p>
        </div>
      </div>
      {myTurn && g.phase === "roll" && (
        <button
          onClick={() => void run({ type: "roll" })}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 text-base font-black text-black shadow-[0_4px_0_#92400e] transition active:translate-y-0.5 active:shadow-[0_2px_0_#92400e] disabled:opacity-50"
        >
          🎲 {g.sixes > 0 ? "Gieo tiếp (được 6!)" : "Gieo xúc xắc"}
          <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">Space</kbd>
        </button>
      )}
      {myTurn && g.phase === "move" && (
        <p className="mt-3 rounded-lg bg-amber-400/15 px-3 py-2 text-center text-sm text-amber-100 ring-1 ring-amber-300/40">
          Bấm vào ngựa đang sáng để đi <b>{g.die}</b> {g.legal.length === 1 ? "— chỉ có 1 nước" : `— ${g.legal.length} con đi được`}
          <span className="hidden lg:inline [@media(pointer:coarse)]:hidden"> (phím {g.legal.length === 1 ? "1 hoặc Space" : `1–${g.legal.length}`})</span>
        </p>
      )}
      <p className="mt-2 hidden text-[11px] text-white/45 lg:block [@media(pointer:coarse)]:hidden">
        Phím tắt: Space / R = gieo xúc xắc · 1–4 = chọn ngựa đang sáng (theo số trên ngựa) · Esc = đóng hộp thoại.
      </p>
      {!myTurn && g.phase === "move" && turnP && <p className="mt-2 text-xs text-white/55">Đang chọn ngựa để đi {g.die} bước…</p>}
    </div>
  );
}

function PlayerRow({
  p,
  name,
  seat,
  self,
  isTurn,
  rank,
  reactions,
  onKick,
}: {
  p: CNPlayerView;
  name: string;
  seat: CNSeatView | null;
  self: boolean;
  isTurn: boolean;
  rank: number;
  reactions: Reaction[];
  onKick?: () => void;
}) {
  const col = HORSE_COLORS[p.color];
  return (
    <div
      className={cn("relative flex items-center gap-2 rounded-xl p-2", isTurn ? "bg-white/10 ring-2" : "bg-black/35", self && "max-lg:order-first", p.forfeited && "opacity-50")}
      style={isTurn ? ({ "--tw-ring-color": col.fill } as React.CSSProperties) : undefined}
    >
      <span className="relative">
        <SeatBubble reactions={reactions} />
        <HorseChip color={p.color} className="w-9 text-lg" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-sm font-semibold">
          {seat?.isHost && <span title="Chủ bàn">👑</span>}
          <SeatAvatar name={name} className="grid size-5 shrink-0 place-items-center rounded-full text-[11px]" fallbackClassName="bg-white/15 font-bold" />
          <span className="truncate">{name}</span>
          {self && <span className="text-xs font-normal text-white/60">(bạn)</span>}
          {rank >= 0 && <span className="ml-1 rounded bg-amber-400 px-1 text-[10px] font-black text-black">#{rank + 1} về đích</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-white/65">
          <span className={col.text}>{col.name}</span>
          <span title="Ngựa đã lên chuồng">🏠 {homeCount(p)}/{HORSES}</span>
          <span title="Ngựa đang trên đường">🐎 {outCount(p)}</span>
          <span title="Ngựa trong chuồng">⛺ {stableCount(p)}</span>
          {seat && !seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Mất kết nối</span>}
          {seat?.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Bị kích</span>}
          {seat && seat.games > 0 && <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")}>{signed(seat.points)}đ</span>}
        </span>
      </span>
      {onKick && (
        <ConfirmButton onConfirm={onKick} confirmLabel="Chắc chắn?" title="Kích người mất kết nối" className="rounded bg-rose-600 px-1.5 text-[11px] font-semibold text-white max-sm:min-h-8 max-sm:px-2.5">
          Kích
        </ConfirmButton>
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center justify-between gap-3", !disabled && "cursor-pointer")}>
      <span>
        {label}
        {hint && <span className="block text-[10px] text-white/45">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 accent-amber-400" />
    </label>
  );
}

function Waiting({ view, me, act, nameOf }: { view: CNRoomView; me: CNSeatView | null; act: Act; nameOf: (id: string) => string }) {
  const g = view.current;
  const count = view.seats.filter(Boolean).length;
  const ended = g?.status === "ended";
  const last = view.history[view.history.length - 1];
  const isHost = !!me?.isHost && view.role === "player";
  const s = view.settings;
  const set = (patch: Record<string, unknown>) => void act({ type: "settings", ...patch });
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
                  <span className="flex min-w-0 items-center gap-1.5">
                    <b className="text-amber-300">#{i + 1}</b>
                    {p && <HorseChip color={p.color} className="w-5 text-[10px]" />}
                    <span className="truncate">
                      {nameOf(id)}
                      {id === view.meId && " (bạn)"}
                    </span>
                    {p && <span className="text-xs text-white/55">🏠 {homeCount(p)}/{HORSES}</span>}
                    {p?.forfeited && <span className="text-xs text-rose-300">rời ván</span>}
                  </span>
                  {d !== undefined && <DeltaBadge delta={d} />}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-xl font-black text-amber-300">🐴 Cờ Cá Ngựa</h2>
          <p className="mb-4 text-sm text-amber-100/80">
            {count}/{MAX_PLAYERS} người · gửi link mời để bạn bè vào bàn
          </p>
        </>
      )}
      <SettingsTabs
        className="mb-4"
        tabs={[
          {
            id: "rules",
            label: "🐴 Luật",
            content: (
              <div className="space-y-2.5">
                <Toggle label="Xuất quân bằng 1 hoặc 6" hint="Tắt: chỉ gieo 6 mới ra quân" checked={s.exitOn1} disabled={!isHost} onChange={(v) => set({ exitOn1: v })} />
                <Toggle label="Không được nhảy qua đầu ngựa" hint="Có ngựa chắn đường thì không đi qua được" checked={s.noJump} disabled={!isHost} onChange={(v) => set({ noJump: v })} />
                <Toggle label="Lên chuồng theo số" hint="Vào bậc 1 đúng số, bậc n lên n+1 phải gieo n+1" checked={s.ladder} disabled={!isHost} onChange={(v) => set({ ladder: v })} />
                <Toggle label="Ba lần 6 liên tiếp mất lượt" checked={s.threeSixes} disabled={!isHost} onChange={(v) => set({ threeSixes: v })} />
                <Toggle label="Xếp hạng hết" hint="Tắt: có người về đích là kết thúc" checked={s.rankAll} disabled={!isHost} onChange={(v) => set({ rankAll: v })} />
              </div>
            ),
          },
          {
            id: "time",
            label: "⏱️ Lượt",
            content: (
              <label className="flex items-center justify-between gap-2">
                <span>Thời gian mỗi lượt</span>
                <select value={s.turnSeconds} disabled={!isHost} onChange={(e) => set({ turnSeconds: Number(e.target.value) })} className="rounded bg-black/40 px-1 py-0.5">
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
            content: <RankPointsPicker first={s.first} second={s.second} players={count} editable={isHost} onChange={(v) => set(v)} />,
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
          {count < 2 ? "Cần ít nhất 2 người" : ended ? "Ván mới" : "Bắt đầu"}
        </button>
      ) : (
        <p className="text-sm text-amber-100/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
      )}
    </div>
  );
}

export function CaNguaRules({ settings }: { settings?: CNRoomView["settings"] }) {
  const on = (v: boolean | undefined, yes: string, no: string) => (settings ? (v ? yes : no) : `${yes} (tuỳ chọn)`);
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>2–4 người, mỗi người 4 ngựa một màu (Đỏ, Xanh dương, Vàng, Xanh lá) nằm trong chuồng ở góc bàn. Đường đua chung có 56 ô, đi theo chiều kim đồng hồ.</li>
      <li>Mỗi lượt gieo 1 xúc xắc. Gieo được <b>6</b> {settings?.exitOn1 ? <>hoặc <b>1</b> </> : ""}thì được đưa 1 ngựa ra ô xuất phát (★) — {on(settings?.exitOn1, "xuất quân bằng 1 hoặc 6", "chỉ 6 mới ra quân")}.</li>
      <li>
        Gieo 6 được gieo thêm lượt nữa. {on(settings?.threeSixes, "Ba lần 6 liên tiếp thì mất lượt", "Gieo 6 bao nhiêu lần cũng được gieo tiếp")}.
      </li>
      <li>Chọn 1 ngựa đi đúng số nút. {on(settings?.noJump, "Không được nhảy qua đầu ngựa khác (bất kỳ màu nào) đang chắn đường", "Được đi qua đầu ngựa khác")}.</li>
      <li>
        Dừng đúng ô có ngựa đối thủ thì <b>đá</b> ngựa đó về chuồng 💥. Không được dừng lên ngựa của mình.
      </li>
      <li>
        Đi hết 1 vòng tới ô trước cột chuồng (chấm màu) thì lên chuồng 6 bậc.{" "}
        {on(
          settings?.ladder,
          "Lên chuồng theo số: vào bậc 1 phải gieo đúng số; từ bậc n lên bậc n+1 phải gieo đúng n+1",
          "Đi vào cột chuồng đúng số nút như bình thường (không quá bậc 6)",
        )}
        .
      </li>
      <li>Không có nước đi thì tự mất lượt. Hết giờ thì máy tự gieo và đi giúp (ưu tiên đá ngựa, rồi lên chuồng, rồi ngựa đi xa nhất).</li>
      <li>
        Ai đưa đủ 4 ngựa lên 4 bậc trên cùng của chuồng (bậc 3–6) trước thắng. {on(settings?.rankAll, "Chơi tiếp đến khi xếp hạng hết mọi người", "Ván kết thúc ngay khi có người về đích; những người còn lại xếp theo quãng đường đã đi")}.
      </li>
    </ul>
  );
}

/**
 * Dialog: a bottom sheet on phones (tap the backdrop or the full-width "Đóng" bar to close),
 * centred from `sm` up. The ✕ stays put while the content scrolls; Esc closes too.
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
        className="relative flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#24160c] text-left text-amber-50 shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-lg leading-none text-white shadow hover:bg-white/20" aria-label="Đóng">
          ✕
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [&>h2:first-child]:pr-10">{children}</div>
        <button onClick={onClose} className="shrink-0 border-t border-white/10 bg-black/20 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold text-amber-100 sm:hidden">
          Đóng
        </button>
      </div>
    </div>
  );
}
