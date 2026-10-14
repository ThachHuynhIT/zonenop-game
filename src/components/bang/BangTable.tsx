"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import { SettingsTabs } from "@/components/games/SettingsTabs";
import { useGameRoom } from "@/components/games/gameClient";
import { useHotkeys } from "@/components/games/useHotkeys";
import { WinCelebration } from "@/components/games/WinCelebration";
import { SeatBubble, SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { DeltaBadge, ScoreboardModal, signed } from "@/components/tienlen/Scoreboard";
import {
  CARD_TYPES,
  CHARACTERS,
  type CardKey,
  type CharKey,
  EVENTS,
  EXPANSIONS,
  GEAR,
  type GearKey,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PACKS,
  RESPOND_SECONDS_OPTIONS,
  ROLE_INFO,
  TURN_SECONDS_OPTIONS,
  cardDef,
  typeOf,
} from "@/lib/bang/cards";
import { BANG_WS_PATH, type BangGameView, type BangPlayerView, type BangRoomView, type DrawMode, type PickSpec, type PromptView } from "@/lib/bang/protocol";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { BangGuide, CardBack, CardFace, CharAvatar, CharCard, EventArt, EventBanner, GearChip, Hearts, PlayChip, RoleBadge, Sheet } from "./Pieces";

type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

/** Small key hint on a button; hidden on small and touch screens. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{children}</kbd>
  );
}

/** True while a dialog (card info, scoreboard, guide…) is open — those own Esc. */
const dialogOpen = () => typeof document !== "undefined" && !!document.querySelector("[role='dialog']");

const selectCls = "min-h-8 rounded-md bg-black/40 px-1.5 py-1 text-white disabled:opacity-70";

const SCORE_NOTE = "Xếp hạng: phe thắng đứng trên (ai sống lâu hơn xếp cao hơn), rồi tới phe thua theo thứ tự chết. Nhất / Nhì do chủ bàn chọn, hai hạng cuối bị trừ tương ứng, tổng mỗi ván bằng 0.";

/**
 * Shift server-clock deadlines onto the local clock.
 *
 * The clock offset is kept steady between messages: re-measuring it on every state update
 * (it includes that message's network latency) made each localized deadline wobble by a few
 * ms, which changed `promptKey` in Board and reset the selection (e.g. the Trượt! you had just
 * picked) whenever anyone did anything — chat, an emoji, another player's move.
 */
function makeLocalize() {
  let skew: number | null = null;
  return (view: BangRoomView): BangRoomView => {
    const measured = Date.now() - view.serverTime;
    if (skew === null || Math.abs(measured - skew) > 1500) skew = measured;
    return localizeWith(view, skew);
  };
}

function localizeWith(view: BangRoomView, skew: number): BangRoomView {
  const g = view.current;
  if (!g) return view;
  return {
    ...view,
    current: {
      ...g,
      deadline: g.deadline ? g.deadline + skew : null,
      prompt: g.prompt ? { ...g.prompt, deadline: g.prompt.deadline + skew } : null,
    },
  };
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

export default function BangTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const [localize] = useState(makeLocalize);
  const { view, status, error, call } = useGameRoom<BangRoomView>(BANG_WS_PATH, code, name, watch ? "watch" : "play", localize);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
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
            <Link href={`/bang/${code}?watch=1`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black">
              Vào xem 👀
            </Link>
          )}
          <Link href="/bang" className="rounded-lg border border-white/25 px-4 py-2 font-semibold">
            Về sảnh
          </Link>
        </div>
      </div>
    );
  }
  if (!view) return <p className="flex min-h-[70vh] animate-pulse items-center justify-center text-amber-100/80">Đang kết nối bàn {code}…</p>;
  return (
    <>
      <Table view={view} reconnecting={status === "reconnecting"} act={act} />
      <ChatBox messages={view.chat} meId={view.meId} myName={name} onSend={(text) => act({ type: "chat", text })} onEmoji={(emoji) => void act({ type: "emoji", emoji })} row />
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-rose-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">{toast}</div>
      )}
    </>
  );
}

function Table({ view, reconnecting, act }: { view: BangRoomView; reconnecting: boolean; act: Act }) {
  const g = view.current;
  const [showScores, setShowScores] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const nameOf = useCallback(
    (id: string) => view.seats.find((s) => s?.id === id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?",
    [view.seats, view.history],
  );
  const copyInvite = async () => {
    const url = new URL(`/bang/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };
  const packs = view.settings.packs;
  // Seats show their own emoji on the board; spectators' (and everyone's before / between games) float in the corner.
  const live = useLiveReactions(view.reactions);
  const cornerReactions = g?.status === "playing" ? live.filter((r) => !r.playerId) : live;
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-2 px-2 pb-20 pt-2 sm:gap-3 sm:px-4 sm:pt-3 lg:pb-6 2xl:max-w-7xl">
      <WinCelebration show={g?.status === "ended"} playing={!!g && g.status !== "ended"} won={!!view.meId && !!g?.winners.includes(view.meId)} title={g?.status === "ended" && g.winners.length ? `🏆 ${g.winners.map(nameOf).join(", ")} thắng` : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/bang" className={headerBtn}>
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
            <button onClick={() => setShowGuide(true)} className={headerBtn} title="Hướng dẫn">
              📖 <HeaderLabel>Hướng dẫn</HeaderLabel>
            </button>
          </>
        }
        status={
          <>
            {/* Packs are listed in the guide; phones keep the bar to the essentials. */}
            <span className="flex items-center gap-1 max-md:hidden">
              {packs.map((p) => (
                <span key={p} title={PACKS[p].name}>
                  {PACKS[p].emoji}
                </span>
              ))}
            </span>
            {view.spectators.length > 0 && (
              <span className="whitespace-nowrap" title={view.spectators.join(", ")}>
                👀 {view.spectators.length}
              </span>
            )}
            {reconnecting && <span className="animate-pulse whitespace-nowrap text-amber-300">Đang kết nối lại…</span>}
          </>
        }
      />

      <SpectatorReactions reactions={cornerReactions} />
      {!g || g.status === "ended" ? (
        <div className="flex flex-1 items-start justify-center pt-2 sm:items-center">
          <Waiting view={view} act={act} nameOf={nameOf} />
        </div>
      ) : g.status === "picking" ? (
        <div className="flex flex-1 items-start justify-center pt-2 sm:items-center">
          <PickPhase view={view} g={g} act={act} nameOf={nameOf} />
        </div>
      ) : (
        <Board view={view} g={g} act={act} nameOf={nameOf} onGuide={() => setShowGuide(true)} />
      )}

      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={SCORE_NOTE} />}
      {showGuide && <BangGuide packs={packs} onClose={() => setShowGuide(false)} />}
    </div>
  );
}

// ─── Before / after a game ─────────────────────────────────────────

function Waiting({ view, act, nameOf }: { view: BangRoomView; act: Act; nameOf: (id: string) => string }) {
  const g = view.current;
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const count = view.seats.filter(Boolean).length;
  const isHost = !!me?.isHost && view.role === "player";
  const s = view.settings;
  const last = view.history[view.history.length - 1];
  const togglePack = (p: (typeof EXPANSIONS)[number]) => void act({ type: "settings", packs: s.packs.includes(p) ? s.packs.filter((x) => x !== p) : [...s.packs, p] });
  const ended = g?.status === "ended";
  return (
    // After a game, wide screens put the result beside the setup so "Ván mới" stays on screen.
    <div className={cn("w-full max-w-xl space-y-4", ended && "lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-4 lg:space-y-0")}>
      {ended && (
        <div className="rounded-3xl border border-amber-300/30 bg-black/45 p-4 backdrop-blur">
          <h2 className="mb-2 text-xl font-black text-amber-300">🏆 {g.winners.length ? g.winners.map(nameOf).join(", ") + " thắng!" : "Không ai thắng"}</h2>
          <ul className="space-y-1.5 text-sm">
            {g.finished.map((id) => {
              const p = g.players.find((x) => x.id === id);
              const d = last?.results.find((r) => r.id === id)?.delta;
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <span className="w-5">{g.winners.includes(id) ? "🏆" : p?.dead ? "☠️" : ""}</span>
                  <b>{nameOf(id)}</b>
                  {id === view.meId && <span className="text-white/60">(bạn)</span>}
                  {p && <RoleBadge role={p.role} small />}
                  {p?.char && <span className="text-white/60">{CHARACTERS[p.char].emoji} {CHARACTERS[p.char].name}</span>}
                  <span className="ml-auto">{d !== undefined && <DeltaBadge delta={d} />}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="rounded-3xl border border-amber-200/15 bg-black/45 p-4 backdrop-blur sm:p-5">
        <h2 className="mb-1 text-xl font-black text-amber-300">🤠 Đấu Súng</h2>
        <p className="mb-2 text-sm text-amber-100/80">
          {count}/{MAX_PLAYERS} người · cần ít nhất {MIN_PLAYERS} · gửi link mời để bạn bè vào bàn
        </p>
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
        </ul>
        <SettingsTabs
          className="mb-3"
          tabs={[
            {
              id: "packs",
              label: `🧩 Mở rộng (${s.packs.length})`,
              content: (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {EXPANSIONS.map((p) => (
                    <label
                      key={p}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-2 text-sm",
                        s.packs.includes(p) ? "border-amber-300/50 bg-amber-400/10" : "border-white/10",
                        isHost && "cursor-pointer hover:bg-white/5",
                      )}
                    >
                      <input type="checkbox" checked={s.packs.includes(p)} disabled={!isHost} onChange={() => togglePack(p)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400" />
                      <span className="min-w-0">
                        <b>
                          {PACKS[p].emoji} {PACKS[p].name}
                        </b>
                        <span className="block text-xs text-white/60">{PACKS[p].blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ),
            },
            {
              id: "time",
              label: "⏱️ Thời gian",
              content: (
                <div className="space-y-2 text-sm">
                  <label className="flex items-center justify-between gap-2">
                    <span>Thời gian mỗi lượt</span>
                    <select value={s.turnSeconds} disabled={!isHost} onChange={(e) => void act({ type: "settings", turnSeconds: Number(e.target.value) })} className={selectCls}>
                      {TURN_SECONDS_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v} giây
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span>
                      Thời gian trả lời <span className="text-white/50">(né đạn, cứu…)</span>
                    </span>
                    <select value={s.respondSeconds} disabled={!isHost} onChange={(e) => void act({ type: "settings", respondSeconds: Number(e.target.value) })} className={selectCls}>
                      {RESPOND_SECONDS_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v} giây
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
                <div className="space-y-2 text-sm">
                  <RankPointsPicker first={s.first} second={s.second} players={count} editable={isHost} onChange={(v) => void act({ type: "settings", ...v })} />
                  <p className="text-xs text-white/50">{SCORE_NOTE}</p>
                </div>
              ),
            },
          ]}
        />
        {!isHost && <p className="-mt-1 mb-3 text-xs text-white/40">Chỉ chủ bàn đổi được luật.</p>}
        {isHost ? (
          <button
            onClick={() => void act({ type: "start" })}
            disabled={count < MIN_PLAYERS}
            className="w-full rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-black hover:bg-amber-300 disabled:opacity-40"
          >
            {count < MIN_PLAYERS ? `Cần ít nhất ${MIN_PLAYERS} người` : g?.status === "ended" ? "Ván mới" : "Bắt đầu"}
          </button>
        ) : (
          <p className="text-sm text-amber-100/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
        )}
      </div>
    </div>
  );
}

function PickPhase({ view, g, act, nameOf }: { view: BangRoomView; g: BangGameView; act: Act; nameOf: (id: string) => string }) {
  const me = g.players.find((p) => p.id === view.meId);
  const now = useNow(true);
  const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - now) / 1000)) : null;
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 rounded-3xl border border-amber-200/15 bg-black/45 p-4 backdrop-blur">
      <h2 className="text-lg font-black text-amber-300">Chọn nhân vật {left !== null && <span className="font-mono text-sm text-amber-100/70">⏱ {left}s</span>}</h2>
      {me && (
        <p className="text-sm">
          Vai trò của bạn: <RoleBadge role={me.role} /> <span className="text-white/60">— {me.role ? ROLE_INFO[me.role].goal : ""}</span>
        </p>
      )}
      {g.picking.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {g.picking.map((c) => (
            <CharCard key={c} char={c} onClick={() => void act({ type: "pick", char: c })} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-amber-100/70">{view.role === "spectator" ? "Mọi người đang chọn nhân vật…" : "Đã chọn — chờ những người khác…"}</p>
      )}
      <p className="text-xs text-white/60">
        Đã chọn: {g.picked.map(nameOf).join(", ") || "—"} ({g.picked.length}/{g.players.length})
      </p>
    </div>
  );
}

// ─── The game ──────────────────────────────────────────────────────

type Reach = "range" | "dist1" | "dist2" | "any" | "anyone" | "dead" | "neighbor";

interface Needs {
  target?: Reach;
  target2?: "fan" | "range";
  /** Choose one of the target's cards: hand + in play, or only in play. */
  pick?: "any" | "play";
  /** Extra cards from your hand (Dodge City cost, Nhắm Kỹ / Bắn Tỉa, power costs). */
  cards?: { n: number | "any"; label: string; optional?: boolean; test?: (id: number) => boolean };
  modes?: { id: string; label: string }[];
  note?: string;
}

type Mode = { kind: "play"; card: number } | { kind: "use"; card: number } | { kind: "ability"; name: string } | { kind: "buy"; slot: number } | { kind: "end" } | null;

const ABILITY_LABEL: Record<string, string> = {
  sid: "💊 Bỏ 2 lá hồi 1 máu",
  chuck: "🎰 Mất 1 máu rút 2 lá",
  doc: "🩺 Bỏ 2 lá bắn 1 phát",
  jose: "🧰 Bỏ lá xanh dương rút 2",
  flint: "🔄 Đổi bài",
  leevan: "🔁 Lặp lại lá vừa đánh",
  jacky: "💸 2 vàng: thêm 1 BANG!",
  mexicali: "🌶️ 2 đạn: thêm 1 BANG!",
  josh: "🛒 2 vàng: lấy trang bị",
  raddie: "🐍 1 vàng: rút 1 lá",
  goldpan: "🍳 1 vàng: rút 1 lá",
  blackflower: "🥀 Lá ♣ làm BANG!",
  derspot: "🔔 BANG! như Súng Máy",
  bass: "🔨 Bỏ 1 lá nạp 2 đạn",
  frankie: "🧲 Lấy 1 viên đạn",
  redringo: "🔴 Chuyển đạn",
  dorothy: "😤 Cơn Giận Đô-rô-ti",
  ladyrose: "🌹 Đổi chỗ",
  ranch: "🐄 Đổi bài (Nông Trại)",
};

const isBangType = (id: number) => !!typeOf(id).isBang;

function playNeeds(key: CardKey, g: BangGameView): Needs {
  const t = CARD_TYPES[key];
  if ((t.color === "blue" || t.color === "green") && !t.placeOn) return { note: t.color === "green" ? "Đặt trước mặt — từ lượt sau mới dùng được." : "Đặt trước mặt bạn." };
  if (t.placeOn === "other") return { target: "any", note: `Đặt ${t.name} trước mặt người khác.` };
  if (t.placeOn === "dead") return { target: "dead" };
  const extraBang: Needs["cards"] = {
    n: 1,
    optional: true,
    label: g.event === "sniper" ? "Kèm Nhắm Kỹ / lá BANG! thứ hai (tuỳ chọn)" : "Kèm Nhắm Kỹ (tuỳ chọn)",
    test: (id) => cardDef(id).key === "aim" || (g.event === "sniper" && isBangType(id)),
  };
  const cost: Needs["cards"] = { n: 1, label: "Chọn thêm 1 lá để bỏ kèm" };
  switch (key) {
    case "bang":
    case "flintlock":
      return { target: "range", cards: extraBang, ...(g.event === "ricochet" ? { note: "Đạn Nảy: có thể chạm vào 1 lá trước mặt người đó để bắn lá ấy." } : {}) };
    case "punch":
      return { target: "dist1" };
    case "fanning":
      return { target: "range", target2: "fan", cards: extraBang, note: "Có thể chọn thêm người thứ hai ở khoảng cách 1 từ người đầu." };
    case "quickshot":
      return { target: "range", target2: "range", cards: extraBang };
    case "springfield":
      return { target: "any", cards: cost };
    case "tomahawk":
      return { target: "dist2" };
    case "panic":
      return { target: "dist1", pick: "any" };
    case "ragtime":
      return { target: "any", pick: "any", cards: cost };
    case "catbalou":
      return { target: "any", pick: "any" };
    case "lockpick":
    case "duel":
      return { target: "any" };
    case "squaw":
      return { target: "any", pick: "play", modes: [{ id: "discard", label: "Bỏ lá đó" }, { id: "take", label: "Tốn 2 đạn: lấy về tay" }] };
    case "tequila":
      return { target: "anyone", cards: cost, note: "Chọn người hồi máu (có thể là bạn)." };
    case "whisky":
    case "brawl":
      return { cards: cost };
    default:
      return {};
  }
}

function inPlayNeeds(key: CardKey): Needs {
  switch (key) {
    case "cancan":
    case "conestoga":
      return { target: "any", pick: "any" };
    case "derringer":
    case "knife":
      return { target: "dist1" };
    case "pepperbox":
      return { target: "range" };
    case "buffalo":
      return { target: "any" };
    default:
      return {};
  }
}

function abilityNeeds(name: string): Needs {
  switch (name) {
    case "sid":
      return { cards: { n: 2, label: "Chọn 2 lá để bỏ" } };
    case "doc":
      return { cards: { n: 2, label: "Chọn 2 lá để bỏ" }, target: "range" };
    case "jose":
      return { cards: { n: 1, label: "Chọn 1 lá xanh dương", test: (id) => typeOf(id).color === "blue" } };
    case "flint":
      return { cards: { n: 1, label: "Chọn 1 lá để đưa" }, target: "any" };
    case "leevan":
    case "derspot":
      return { cards: { n: 1, label: "Chọn 1 lá BANG!", test: (id) => (name === "derspot" ? cardDef(id).key === "bang" : isBangType(id)) } };
    case "blackflower":
      return { cards: { n: 1, label: "Chọn 1 lá ♣", test: (id) => cardDef(id).suit === "C" }, target: "range" };
    case "bass":
      return { cards: { n: 1, label: "Chọn 1 lá để bỏ" } };
    case "dorothy":
      return { target: "any" };
    case "ladyrose":
      return { target: "neighbor" };
    case "ranch":
      return { cards: { n: "any", label: "Chọn các lá muốn đổi" } };
    case "frankie":
      return { note: "Chạm vào 1 lá có đạn (hoặc thẻ nhân vật có đạn) của bất kỳ ai." };
    case "redringo":
      return { note: "Chạm vào 1 lá trước mặt bạn để chuyển 1 viên đạn sang." };
    default:
      return {};
  }
}

function buyNeeds(key: GearKey): Needs {
  if (key === "bottle")
    return { modes: [{ id: "beer", label: "🍺 Như Bia" }, { id: "panic", label: "😱 Như Hoảng Loạn" }, { id: "bang", label: "💥 Như BANG!" }] };
  if (key === "pardner")
    return { modes: [{ id: "store", label: "🏪 Như Tạp Hoá" }, { id: "duel", label: "🤺 Như Đấu Tay Đôi" }, { id: "cat", label: "💃 Như Quậy Phá" }] };
  if (key === "wanted") return { target: "any" };
  return {};
}

/** Needs that depend on the chosen mode (Chai Rượu / Bạn Đồng Hành). */
function withMode(n: Needs, mode: string | null): Needs {
  if (!n.modes || !mode) return n;
  if (mode === "panic") return { ...n, target: "dist1", pick: "any" };
  if (mode === "bang") return { ...n, target: "range" };
  if (mode === "duel") return { ...n, target: "any" };
  if (mode === "cat") return { ...n, target: "any", pick: "any" };
  return n;
}

function handLimitOf(g: BangGameView, me: BangPlayerView): number {
  let limit = me.dead ? me.max : me.life;
  const ab = [me.char, ...me.borrowed];
  if (ab.includes("sean")) limit = Math.max(limit, 10);
  if (me.gear.some((x) => x.key === "ace")) limit += 2;
  return limit;
}

function Board({ view, g, act, nameOf, onGuide }: { view: BangRoomView; g: BangGameView; act: Act; nameOf: (id: string) => string; onGuide: () => void }) {
  const me = g.players.find((p) => p.id === view.meId) ?? null;
  const now = useNow(true);
  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string): Reaction[] => live.filter((r) => r.playerId === id);
  const [mode, setMode] = useState<Mode>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [target2, setTarget2] = useState<string | null>(null);
  const [pick, setPick] = useState<PickSpec | null>(null);
  const [asBang, setAsBang] = useState(false);
  const [opt, setOpt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ kind: "card"; id: number } | { kind: "char"; key: CharKey } | { kind: "event" } | null>(null);
  const [showLog, setShowLog] = useState(false);

  const prompt = g.prompt;
  const myPrompt = !!me && prompt?.to === me.id;
  const offline = (id: string) => {
    const seat = view.seats.find((s) => s?.id === id);
    return !!seat && !seat.connected && !seat.kicked;
  };
  const iAmHost = view.role === "player" && !!view.seats.find((s) => s?.id === view.meId)?.isHost;
  const myTurn = !!me && g.turn === me.id && g.step === "play" && !prompt;
  const reset = useCallback(() => {
    setMode(null);
    setSel([]);
    setTarget(null);
    setTarget2(null);
    setPick(null);
    setAsBang(false);
    setOpt(null);
  }, []);
  const promptKey = prompt ? `${prompt.kind}:${prompt.to}:${prompt.deadline}` : "";
  useEffect(reset, [g.turn, promptKey, reset]);

  // Drop selections for cards that left the hand.
  const handKey = me?.hand?.join(",") ?? "";
  useEffect(() => {
    if (!me?.hand) return;
    setSel((s) => s.filter((c) => me.hand!.includes(c)));
    if (mode?.kind === "play" && !me.hand.includes(mode.card)) reset();
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (msg: Record<string, unknown> & { type: string }) => {
    setBusy(true);
    const ok = await act(msg);
    setBusy(false);
    if (ok) reset();
    return ok;
  };

  const needs: Needs = useMemo(() => {
    if (!mode || !me) return {};
    if (mode.kind === "play") {
      const key = asBang ? "bang" : cardDef(mode.card).key;
      return playNeeds(key, g);
    }
    if (mode.kind === "use") return inPlayNeeds(cardDef(mode.card).key);
    if (mode.kind === "ability") return abilityNeeds(mode.name);
    if (mode.kind === "buy") return withMode(buyNeeds(g.shop[mode.slot]), opt);
    return {};
  }, [mode, me, asBang, g, opt]);

  const others = useMemo(() => {
    if (!me) return g.players;
    const i = g.players.findIndex((p) => p.id === me.id);
    return [...g.players.slice(i + 1), ...g.players.slice(0, i)];
  }, [g.players, me]);

  const inReach = (p: BangPlayerView, reach: Reach | undefined): boolean => {
    if (!reach || !me) return false;
    if (reach === "dead") return p.dead && !p.ghost;
    if (reach === "anyone") return !p.dead;
    if (p.id === me.id || (p.dead && !p.ghost)) return false;
    if (reach === "neighbor") {
      const ring = g.players.filter((x) => !x.dead || x.ghost);
      const i = ring.findIndex((x) => x.id === me.id);
      const n = ring.length;
      return ring[(i + 1) % n]?.id === p.id || ring[(i - 1 + n) % n]?.id === p.id;
    }
    if (reach === "any") return true;
    const d = p.dist ?? 99;
    if (reach === "range") return d <= g.range;
    if (reach === "dist1") return d <= 1;
    return d <= 2;
  };

  // Draw-phase choices use the same target / pick state.
  const drawPrompt = myPrompt && prompt?.kind === "draw" ? prompt : null;

  const tapPlayer = (p: BangPlayerView) => {
    if (drawPrompt) {
      setTarget((t) => (t === p.id ? null : p.id));
      return;
    }
    if (needs.target2 && target && target !== p.id) {
      setTarget2((t) => (t === p.id ? null : p.id));
      return;
    }
    if (needs.target) {
      setTarget((t) => (t === p.id ? null : p.id));
      setPick(null);
    }
  };

  const tapChip = (owner: BangPlayerView, card: number) => {
    if (mode?.kind === "ability" && mode.name === "frankie") {
      // -1 = the cubes on their character card.
      void run({ type: "ability", name: "frankie", target: owner.id, ...(card >= 0 ? { card } : {}) });
      return;
    }
    if (card < 0) return;
    if (mode?.kind === "ability" && mode.name === "redringo" && owner.id === me?.id) {
      void run({ type: "ability", name: "redringo", card });
      return;
    }
    if (drawPrompt && opt === "pat" && owner.id !== me?.id) {
      void run({ type: "draw", mode: "pat", target: owner.id, card });
      return;
    }
    if (myPrompt && prompt?.kind === "pick" && prompt.from === owner.id) {
      void run({ type: "respond", card });
      return;
    }
    if (needs.pick && target === owner.id) {
      setPick({ zone: "play", card });
      return;
    }
    if (mode?.kind === "play" && g.event === "ricochet" && ["bang", "flintlock"].includes(asBang ? "bang" : cardDef(mode.card).key) && inReach(owner, "range")) {
      setTarget(owner.id);
      setPick({ zone: "play", card });
      return;
    }
    if (owner.id === me?.id && myTurn && !mode) {
      const t = typeOf(card);
      const c = me.play.find((x) => x.id === card);
      if ((t.color === "green" && !c?.fresh && !t.isMissed) || (t.load && ["bandolier", "belltower", "bigfifty"].includes(t.key))) {
        setMode({ kind: "use", card });
        return;
      }
    }
    setInfo({ kind: "card", id: card });
  };

  const tapHand = (card: number) => {
    if (!me) return;
    // Answering / discarding / costs: multi-select.
    const multi =
      (myPrompt && (prompt?.kind === "react" || prompt?.kind === "discard" || prompt?.kind === "save")) || mode?.kind === "end" || (mode && needs.cards && !(mode.kind === "play" && mode.card === card));
    if (multi) {
      setSel((s) => (s.includes(card) ? s.filter((x) => x !== card) : [...s, card]));
      return;
    }
    if (myTurn) {
      if (mode?.kind === "play" && mode.card === card) reset();
      else {
        reset();
        setMode({ kind: "play", card });
      }
      return;
    }
    setInfo({ kind: "card", id: card });
  };

  // What's still missing before the main button works.
  const missing = (() => {
    if (!mode) return null;
    if (needs.modes && !opt) return "Chọn cách dùng";
    if (needs.target && !target) return needs.target === "dead" ? "Chọn 1 người đã chết" : "Chọn người (chạm vào ô người chơi)";
    if (needs.target2 === "range" && !target2) return "Chọn người thứ hai";
    if (needs.pick && !pick) return "Chọn lá: ngẫu nhiên trên tay, hoặc chạm 1 lá trước mặt họ";
    if (needs.cards && !needs.cards.optional) {
      const n = needs.cards.n;
      if (n === "any" ? !sel.length : sel.length !== n) return needs.cards.label;
    }
    return null;
  })();

  const confirm = () => {
    if (!mode || !me) return;
    const base = { ...(target ? { target } : {}), ...(target2 ? { target2 } : {}), ...(pick ? { pick } : {}) };
    if (mode.kind === "play") void run({ type: "play", card: mode.card, ...base, ...(sel.length ? { extra: sel } : {}), ...(asBang ? { as: "bang" } : {}), ...(opt ? { mode: opt } : {}) });
    else if (mode.kind === "use") void run({ type: "use", card: mode.card, ...base });
    else if (mode.kind === "ability") void run({ type: "ability", name: mode.name, ...base, ...(sel.length ? { cards: sel, card: sel[0] } : {}) });
    else if (mode.kind === "buy") void run({ type: "buy", slot: mode.slot, ...base, ...(opt ? { mode: opt } : {}) });
    else if (mode.kind === "end") void run({ type: "end", discard: sel });
  };

  const limit = me ? handLimitOf(g, me) : 0;
  const over = me?.hand ? Math.max(0, me.hand.length - limit) : 0;
  const goldrush = view.settings.packs.includes("goldrush");
  const secondsLeft = (d: number | null | undefined) => (d ? Math.max(0, Math.ceil((d - now) / 1000)) : null);

  const mainCard = mode?.kind === "play" || mode?.kind === "use" ? mode.card : null;
  const canAsBang =
    mode?.kind === "play" &&
    !!me &&
    cardDef(mode.card).key !== "bang" &&
    ((me.char === "calamity" || me.borrowed.includes("calamity")) && typeOf(mode.card).isMissed
      ? true
      : me.play.some((c) => cardDef(c.id).key === "lemat") || g.event === "showdown");

  const turnName = g.turn ? nameOf(g.turn) : "";
  const handCards = me?.hand ?? [];
  const myTurnNow = !!me && g.turn === me.id;

  /** Could this card be played on your turn right now (a rough client-side check — the server has the last word)? */
  const playable = (card: number): boolean => {
    if (!me) return false;
    const t = typeOf(card);
    const ab = [me.char, ...me.borrowed];
    const canBang = g.bangsLeft > 0 && g.event !== "sermon";
    const someone = (reach: Reach) => g.players.some((p) => inReach(p, reach));
    const lemat = g.event !== "lasso" && me.play.some((c) => cardDef(c.id).key === "lemat");
    // Lá nào cũng dùng được như BANG! (Súng Hai Cỡ / Quyết Đấu), Trượt! như BANG! (Cô Tai Ương).
    const asBang = t.key !== "bang" && (lemat || g.event === "showdown" || (ab.includes("calamity") && !!t.isMissed));
    if (asBang && canBang && someone("range")) return true;
    if (t.color !== "brown") {
      if (g.event === "judge") return false;
      if (t.placeOn) return someone(t.placeOn === "dead" ? "dead" : "any");
      return true;
    }
    if (t.isMissed || t.key === "escape" || t.key === "saved") return false; // answers only, out of your turn
    if (t.key === "aim") return false; // goes along with a BANG!
    if (t.isBang && !canBang) return false;
    if (t.cost && handCards.length < 2) return false;
    if (t.key === "beer") return me.life < me.max && g.event !== "reverend" && g.players.filter((p) => !p.dead).length > 2;
    if (t.key === "lastcall" || t.key === "whisky") return me.life < me.max;
    const n = playNeeds(t.key, g);
    return !n.target || someone(n.target);
  };

  /** Can this hand card do anything right now? The rest are greyed out (still tappable to read). */
  const usable = (card: number): boolean => {
    if (!me || (me.dead && !me.ghost)) return false;
    const t = typeOf(card);
    const ab = [me.char, ...me.borrowed];
    if (myPrompt && prompt) {
      switch (prompt.kind) {
        case "react":
          if (prompt.answer === "evade") return t.key === "escape" || (ab.includes("mick") && !!t.isMissed && t.color === "brown");
          if (prompt.answer === "bang") return !!t.isBang || g.event === "showdown" || (ab.includes("calamity") && !!t.isMissed);
          if (ab.includes("bigspencer")) return false;
          return (!!t.isMissed && t.color === "brown") || ab.includes("elena") || (!!t.isBang && (ab.includes("calamity") || g.event === "showdown"));
        case "discard":
          return true;
        case "save":
          return t.key === "saved";
        default:
          return false;
      }
    }
    if (mode) {
      if (mode.kind === "end" || (mode.kind === "play" && mode.card === card)) return true;
      if (needs.cards) {
        // An optional extra (Nhắm Kỹ) doesn't grey out the rest of the hand.
        if (mode.kind === "play" && needs.cards.optional) return true;
        return !needs.cards.test || needs.cards.test(card);
      }
    }
    return myTurn && playable(card);
  };

  return (
    <div className="grid flex-1 content-start gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_21rem] short:grid-cols-1">
      {/* Sideways phones: the table on the left, you / actions / hand on the right. */}
      <div className="flex min-w-0 flex-col gap-2 sm:gap-3 short:grid short:grid-cols-2 short:items-start">
        <div className="contents short:flex short:min-w-0 short:flex-col short:gap-2">
        {g.event && <EventBanner event={g.event} left={g.eventsLeft} onClick={() => setInfo({ kind: "event" })} />}

        {/* Other players, clockwise from you */}
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-4 short:grid-cols-2 short:gap-1.5">
          {others
            .filter((p) => p.id !== me?.id)
            .map((p) => (
              <PlayerTile
                key={p.id}
                p={p}
                name={nameOf(p.id)}
                seat={view.seats.find((s) => s?.id === p.id) ?? null}
                isTurn={g.turn === p.id}
                waiting={prompt?.to === p.id}
                selectable={!!(needs.target && inReach(p, needs.target)) || !!(needs.target2 && target && p.id !== target && p.id !== me?.id && !p.dead) || !!drawPrompt}
                selected={target === p.id ? 1 : target2 === p.id ? 2 : 0}
                pickable={(needs.pick && target === p.id) || (myPrompt && prompt?.kind === "pick" && prompt.from === p.id) || (drawPrompt && opt === "pat") || (mode?.kind === "ability" && mode.name === "frankie")}
                reactions={reactionsFor(p.id)}
                onTap={() => tapPlayer(p)}
                onChip={(c) => tapChip(p, c)}
                onChar={() => p.char && setInfo({ kind: "char", key: p.char })}
                onKick={iAmHost && offline(p.id) ? () => void act({ type: "kick", playerId: p.id }) : undefined}
                pickedCard={pick?.zone === "play" && target === p.id ? pick.card : null}
              />
            ))}
        </ul>

        {/* Table centre: deck, discard, shop, what's happening */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-900/40 bg-[radial-gradient(ellipse_at_center,#5b3415_0%,#2e1a0b_75%)] p-2 sm:p-3">
          <CardBack count={g.deckCount} />
          {g.discardTop !== null ? <CardFace id={g.discardTop} size="sm" onClick={() => setInfo({ kind: "card", id: g.discardTop! })} /> : <div className="aspect-[5/7] w-12 rounded-lg border-2 border-dashed border-white/15" />}
          <div className="min-w-0 flex-1 text-sm">
            <p>
              {g.turn === me?.id ? <b className="text-amber-300">Lượt của bạn</b> : <>Lượt của <b>{turnName}</b></>}
              {g.step === "play" && !prompt && secondsLeft(g.deadline) !== null && <span className={cn("ml-2 font-mono", (secondsLeft(g.deadline) ?? 99) <= 10 && "text-rose-400")}>⏱ {secondsLeft(g.deadline)}s</span>}
            </p>
            {prompt && !myPrompt && (
              <p className="text-amber-100/80">
                Chờ <b>{nameOf(prompt.to)}</b>: {promptText(prompt, nameOf)} <span className="font-mono">⏱ {secondsLeft(prompt.deadline)}s</span>
                {g.queued > 0 && <span className="text-white/50"> (+{g.queued})</span>}
              </p>
            )}
            <button onClick={() => setShowLog((v) => !v)} className="-my-1 block max-w-full truncate py-1 text-left text-xs text-white/60 underline-offset-2 hover:underline" aria-expanded={showLog}>
              📜 {g.log[g.log.length - 1]?.text ?? "Chưa có gì"}
            </button>
          </div>
          {goldrush && g.shop.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
              <span className="text-xs text-yellow-200/80">🏪 Cửa hàng ({g.shopDeck}):</span>
              {g.shop.map((k, i) => (
                <GearChip
                  key={`${k}-${i}`}
                  gear={k}
                  price={GEAR[k].cost - (me && (me.char === "luzena" || me.borrowed.includes("luzena")) ? 1 : 0)}
                  disabled={!myTurn || (me?.gold ?? 0) < GEAR[k].cost - 1}
                  onClick={myTurn ? () => (reset(), setMode({ kind: "buy", slot: i })) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {showLog && <LogList g={g} className="max-h-48 lg:hidden" />}
        </div>

        <div className="contents short:flex short:min-w-0 short:flex-col short:gap-2">

        {/* You */}
        {me && (
          <div className={cn("relative rounded-2xl border p-2 sm:p-3", myTurnNow ? "border-rose-300/50 bg-amber-400/10" : "border-white/10 bg-black/30")}>
            {myTurnNow && <TurnGlow />}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="relative">
                <SeatBubble reactions={reactionsFor(me.id)} />
                <button onClick={() => me.char && setInfo({ kind: "char", key: me.char })} className="flex items-center gap-1 font-bold">
                  {me.char ? <CharAvatar char={me.char} className="w-7" emojiClass="text-2xl" /> : <span className="text-2xl">❔</span>}
                  {me.char ? CHARACTERS[me.char].name : "?"}
                </button>
              </span>
              {myTurnNow && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-[0_0_10px_rgba(251,113,133,0.6)]" role="status">
                  🔔 Lượt của bạn
                </span>
              )}
              <RoleBadge role={me.role} small />
              <Hearts life={me.life} max={me.max} dead={me.dead && !me.ghost} />
              {me.ghost && <span className="rounded bg-indigo-500/40 px-1 text-xs">👻 hồn ma</span>}
              {goldrush && <span className="text-xs text-yellow-200">🪙 {me.gold}</span>}
              {me.cubes > 0 && <span className="text-xs text-amber-200" title="Đạn trên thẻ nhân vật">🔸 {me.cubes}</span>}
              <span className="ml-auto text-xs text-white/60">
                Tầm {g.range} · BANG! còn {g.bangsLeft >= 99 ? "∞" : g.bangsLeft} · giữ tối đa {limit}
              </span>
            </div>
            {/* Your character's power, always on show under its name. */}
            {me.char && <p className="mt-1 text-xs leading-snug text-amber-50/85 sm:text-[13px]">{CHARACTERS[me.char].text}</p>}
            {me.borrowed.map((b) => (
              <p key={b} className="mt-0.5 text-xs leading-snug text-white/65">
                <b className="text-amber-200/90">+ {CHARACTERS[b].name}:</b> {CHARACTERS[b].text}
              </p>
            ))}
            {(me.play.length > 0 || me.gear.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {me.play.map((c) => (
                  <PlayChip key={c.id} id={c.id} cubes={c.cubes} fresh={c.fresh} active={mainCard === c.id} onClick={() => tapChip(me, c.id)} />
                ))}
                {me.gear.map((x, i) => (
                  <GearChip key={i} gear={x.key} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* What you can do now */}
        {me && (
          <ActionPanel
            g={g}
            me={me}
            prompt={myPrompt ? prompt : null}
            myTurn={myTurn}
            mode={mode}
            needs={needs}
            missing={missing}
            sel={sel}
            target={target}
            target2={target2}
            pick={pick}
            opt={opt}
            asBang={asBang}
            canAsBang={canAsBang}
            busy={busy}
            over={over}
            limit={limit}
            goldrush={goldrush}
            abilities={view.abilities ?? []}
            nameOf={nameOf}
            secondsLeft={secondsLeft}
            setMode={(m) => {
              reset();
              setMode(m);
            }}
            setOpt={setOpt}
            setPick={setPick}
            setAsBang={setAsBang}
            setSel={setSel}
            run={run}
            confirm={confirm}
            reset={reset}
            onGuide={onGuide}
          />
        )}

        {/* Your hand */}
        {handCards.length > 0 && (
          <div className={cn("relative flex flex-wrap justify-center gap-1.5 rounded-2xl pt-2", myTurnNow && "p-2 pt-3")} data-testid="hand">
            {myTurnNow && <TurnGlow />}
            {handCards.map((c) => (
              <CardFace key={c} id={c} onClick={() => tapHand(c)} selected={sel.includes(c) || mainCard === c} dim={!usable(c)} />
            ))}
          </div>
        )}
        {view.role === "spectator" && <p className="text-center text-sm text-white/60">👀 Bạn đang xem</p>}
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col gap-2 lg:flex short:hidden">
        <LogList g={g} className="max-h-[calc(100dvh-8rem)] flex-1" />
      </aside>

      {info && (
        <Sheet onClose={() => setInfo(null)}>
          {info.kind === "card" && (
            <div className="flex gap-3">
              <CardFace id={info.id} size="lg" />
              <div className="text-sm">
                <b className="text-lg text-amber-200">{typeOf(info.id).name}</b>
                {typeOf(info.id).range ? <p className="text-white/60">Súng tầm {typeOf(info.id).range}</p> : null}
                <p className="mt-1">{typeOf(info.id).text}</p>
                <p className="mt-1 text-xs text-white/50">{PACKS[typeOf(info.id).pack].name}</p>
              </div>
            </div>
          )}
          {info.kind === "char" && <CharCard char={info.key} />}
          {info.kind === "event" && g.event && (
            <div className="text-sm">
              <EventArt event={g.event} className="float-right ml-3 aspect-square w-24 rounded-lg" />
              <b className="text-lg text-amber-200">
                {EVENTS[g.event].emoji} {EVENTS[g.event].name}
              </b>
              <p className="mt-1">{EVENTS[g.event].text}</p>
              <p className="mt-2 text-xs text-white/50">Còn {g.eventsLeft} lá sự kiện. Lá mới lật ra đầu mỗi lượt của Cảnh sát trưởng.</p>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

/** Softly pulsing rose ring around your own area while it is your turn (static under reduced motion). */
function TurnGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[0_0_18px_rgba(251,113,133,0.45)] ring-2 ring-rose-400 motion-safe:animate-pulse"
    />
  );
}

function promptText(p: PromptView, nameOf: (id: string) => string): string {
  switch (p.kind) {
    case "react":
      return p.answer === "evade"
        ? `có thể né ${p.cause}`
        : `${p.cause}${p.from ? ` từ ${nameOf(p.from)}` : ""} — cần ${p.need} lá ${p.answer === "bang" ? "BANG!" : "Trượt!"}`;
    case "save":
      return `có thể Cứu Nguy cho ${nameOf(p.target)}`;
    case "store":
      return "chọn 1 lá ở Tạp Hoá";
    case "pick":
      return `chọn lá của ${nameOf(p.from)} để bỏ`;
    case "keep":
      return p.cause === "kit" ? "soi bài" : p.cause === "poker" ? "chọn 2 lá từ ván Xì Phé" : "chọn lá giữ lại";
    case "discard":
      return p.cause === "poker" ? "úp 1 lá cho ván Xì Phé" : `bỏ ${p.count} lá hoặc mất ${p.orLose} máu`;
    case "copy":
      return "chọn nhân vật để bắt chước";
    case "draw":
      return "chọn cách rút bài";
  }
}

function LogList({ g, className }: { g: BangGameView; className?: string }) {
  return (
    <div className={cn("flex min-h-0 flex-col rounded-2xl bg-black/35 p-2", className)}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-100/60">Diễn biến</p>
      <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto text-xs">
        {g.log
          .slice()
          .reverse()
          .map((e) => (
            <li
              key={e.id}
              className={cn(
                "rounded px-1.5 py-0.5",
                e.tone === "bang" && "bg-rose-600/20 text-rose-100",
                e.tone === "heal" && "bg-emerald-600/20 text-emerald-100",
                e.tone === "death" && "bg-zinc-700/60 font-semibold",
                e.tone === "event" && "bg-amber-500/20 text-amber-100",
                e.tone === "gold" && "bg-yellow-500/15 text-yellow-100",
                (!e.tone || e.tone === "info") && "text-white/75",
              )}
            >
              {e.text}
            </li>
          ))}
      </ul>
    </div>
  );
}

function PlayerTile({
  p,
  name,
  seat,
  isTurn,
  waiting,
  selectable,
  selected,
  pickable,
  reactions,
  onTap,
  onChip,
  onChar,
  onKick,
  pickedCard,
}: {
  p: BangPlayerView;
  name: string;
  seat: { connected: boolean; isHost: boolean; kicked: boolean; points: number; games: number } | null;
  isTurn: boolean;
  waiting: boolean;
  selectable: boolean;
  selected: 0 | 1 | 2;
  pickable?: boolean;
  reactions: Reaction[];
  onTap: () => void;
  onChip: (card: number) => void;
  onChar: () => void;
  /** Host only, and only for an offline player: kick them (two taps to confirm). */
  onKick?: () => void;
  pickedCard: number | null;
}) {
  const gone = p.dead && !p.ghost;
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const id = window.setTimeout(() => setSure(false), 3500);
    return () => window.clearTimeout(id);
  }, [sure]);
  return (
    <li
      className={cn(
        "relative rounded-xl border p-1.5 text-xs transition-colors sm:p-2",
        isTurn ? "border-amber-300/70 bg-amber-400/15" : "border-white/10 bg-black/35",
        waiting && "ring-2 ring-sky-400/70",
        selectable && "cursor-pointer border-rose-300/70 hover:bg-rose-500/15",
        selected && "bg-rose-500/30 ring-2 ring-rose-400",
        gone && "opacity-55",
      )}
      onClick={selectable ? onTap : undefined}
    >
      <SeatBubble reactions={reactions} />
      {selected ? <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">🎯{selected === 2 ? "2" : ""}</span> : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChar();
          }}
          className="-m-1 p-1 text-xl leading-none"
          aria-label="Xem nhân vật"
        >
          {gone ? "☠️" : p.char ? <CharAvatar char={p.char} className="w-6" /> : "❔"}
        </button>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13px] leading-tight">
            {seat?.isHost && "👑"}
            {name}
          </b>
          <span className="block truncate text-[10px] text-white/60">{p.char ? CHARACTERS[p.char].name : "đang chọn…"}</span>
        </span>
        {p.dist !== null && <span className="shrink-0 rounded bg-black/40 px-1 font-mono text-[10px]" title="Khoảng cách từ bạn">📏{p.dist}</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Hearts life={p.life} max={p.max} dead={gone} />
        <span className="rounded bg-black/40 px-1 font-mono">🂠 {p.handCount}</span>
        {p.role && <RoleBadge role={p.role} small />}
        {p.ghost && <span className="rounded bg-indigo-500/40 px-1">👻</span>}
        {p.gold > 0 && <span className="text-yellow-200">🪙{p.gold}</span>}
        {p.cubes > 0 && (
          <button type="button" onClick={(e) => (e.stopPropagation(), onChip(-1))} className="text-amber-200" title="Đạn trên thẻ nhân vật">
            🔸{p.cubes}
          </button>
        )}
        {seat && !seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">mất kết nối</span>}
        {onKick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (sure) {
                setSure(false);
                onKick();
              } else setSure(true);
            }}
            className={cn("rounded px-1 font-semibold", sure ? "bg-rose-600 text-white" : "bg-white/10 text-rose-200 hover:bg-white/20")}
          >
            {sure ? "Chắc chắn?" : "Kích"}
          </button>
        )}
        {seat && seat.games > 0 && <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "text-white/50")}>{signed(seat.points)}đ</span>}
      </div>
      {(p.play.length > 0 || p.gear.length > 0) && (
        <div className={cn("mt-1 flex flex-wrap gap-0.5 rounded", pickable && p.play.length > 0 && "ring-1 ring-amber-300/70")} onClick={(e) => e.stopPropagation()}>
          {p.play.map((c) => (
            <PlayChip key={c.id} id={c.id} cubes={c.cubes} fresh={c.fresh} active={pickedCard === c.id} onClick={() => onChip(c.id)} compact />
          ))}
          {p.gear.map((x, i) => (
            <GearChip key={i} gear={x.key} compact />
          ))}
        </div>
      )}
      {p.hand && p.hand.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5" onClick={(e) => e.stopPropagation()}>
          {p.hand.map((c) => (
            <CardFace key={c} id={c} size="xs" />
          ))}
        </div>
      )}
    </li>
  );
}

// ─── The action panel ──────────────────────────────────────────────

interface PanelProps {
  g: BangGameView;
  me: BangPlayerView;
  prompt: PromptView | null;
  myTurn: boolean;
  mode: Mode;
  needs: Needs;
  missing: string | null;
  sel: number[];
  target: string | null;
  target2: string | null;
  pick: PickSpec | null;
  opt: string | null;
  asBang: boolean;
  canAsBang: boolean;
  busy: boolean;
  over: number;
  limit: number;
  goldrush: boolean;
  abilities: string[];
  nameOf: (id: string) => string;
  secondsLeft: (d: number | null | undefined) => number | null;
  setMode: (m: Mode) => void;
  setOpt: (o: string | null) => void;
  setPick: (p: PickSpec | null) => void;
  setAsBang: (v: boolean) => void;
  setSel: (s: number[]) => void;
  run: (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;
  confirm: () => void;
  reset: () => void;
  onGuide: () => void;
}

const btn = "rounded-lg px-3 py-2 text-sm font-bold transition-colors disabled:opacity-40";
const primary = cn(btn, "bg-amber-400 text-black hover:bg-amber-300");
const ghost = cn(btn, "border border-white/20 bg-white/5 hover:bg-white/10");
const danger = cn(btn, "bg-rose-600 text-white hover:bg-rose-500");

/** "Phím tắt" hint per prompt kind (only shows keys that exist for it). */
const PROMPT_HINT: Record<PromptView["kind"], string | null> = {
  react: "Enter = đỡ / né · P = bỏ qua (khi hỏi né)",
  save: "Enter = cứu · P = bỏ qua",
  keep: "Enter = giữ",
  discard: "Enter = bỏ / úp lá đã chọn",
  draw: "D hoặc Enter = rút bình thường",
  store: null,
  pick: null,
  copy: null,
};

function ActionPanel(props: PanelProps) {
  const { me, prompt, myTurn, mode, busy, over, goldrush, abilities, setMode, run } = props;
  // Desktop shortcut: E = the visible "Kết thúc lượt" button (same guards: my turn, no prompt, no form open, not busy).
  const endTurn = () => {
    if (over > 0 || goldrush) setMode({ kind: "end" });
    else void run({ type: "end", discard: [] });
  };
  useHotkeys({ e: !prompt && myTurn && !mode && !busy ? endTurn : undefined });
  const hint = prompt
    ? PROMPT_HINT[prompt.kind]
    : mode
      ? "Enter = xác nhận · Esc = huỷ"
      : myTurn
        ? "E = kết thúc lượt"
        : null;
  const shell = (children: React.ReactNode, tone = "border-white/10 bg-black/40") => (
    <div className={cn("sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 space-y-2 rounded-2xl border p-2 pr-14 backdrop-blur sm:p-3 sm:pr-14 lg:static lg:pr-3 short:static", tone)}>
      {children}
      {hint && <p className="hidden text-[11px] text-white/45 lg:block [@media(pointer:coarse)]:hidden">Phím tắt: {hint}.</p>}
    </div>
  );

  if (prompt) return shell(<PromptPanel {...props} prompt={prompt} />, "border-sky-400/50 bg-sky-950/80");

  if (!myTurn) {
    if (me.char === "sid" || me.borrowed.includes("sid")) {
      return shell(
        mode?.kind === "ability" ? (
          <ModeForm {...props} />
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/60">Chưa tới lượt bạn.</span>
            {abilities.includes("sid") && me.life < me.max && (
              <button className={ghost} onClick={() => setMode({ kind: "ability", name: "sid" })}>
                {ABILITY_LABEL.sid}
              </button>
            )}
          </div>
        ),
      );
    }
    return null;
  }

  if (mode) return shell(<ModeForm {...props} />, "border-amber-300/50 bg-[#2a1a0c]/90");

  return shell(
    <>
      <p className="text-xs text-amber-100/80 sm:text-sm">Chạm lá trên tay để đánh, hoặc lá xanh lá / lá có đạn trước mặt để dùng.</p>
      <div className="flex flex-wrap gap-2">
        {abilities
          .filter((a) => a !== "sid" || me.life < me.max)
          .map((a) => (
            <button key={a} className={ghost} onClick={() => setMode({ kind: "ability", name: a })}>
              {ABILITY_LABEL[a] ?? a}
            </button>
          ))}
        <button
          className={cn(primary, "ml-auto")}
          disabled={busy}
          onClick={endTurn}
        >
          Kết thúc lượt ⏭
          <Kbd>E</Kbd>
        </button>
      </div>
    </>,
  );
}

function ModeForm({ g, mode, needs, missing, sel, target, target2, pick, opt, asBang, canAsBang, busy, over, limit, goldrush, nameOf, setOpt, setPick, setAsBang, confirm, reset }: PanelProps) {
  const ready = !!mode && (mode.kind === "end" ? sel.length >= over : !missing);
  // Enter = the primary confirm button (same guard: not busy, ready); Esc = the ✕ (leaves it to an open dialog).
  useHotkeys({
    Enter: mode && !busy && ready ? confirm : undefined,
    Escape: mode ? () => !dialogOpen() && reset() : undefined,
  });
  if (!mode) return null;
  let title = "";
  let text = "";
  if (mode.kind === "play" || mode.kind === "use") {
    const t = typeOf(mode.card);
    title = `${mode.kind === "use" ? "Dùng" : "Đánh"} ${t.emoji} ${t.name}`;
    text = asBang ? "Dùng như 1 lá BANG!." : t.text;
  } else if (mode.kind === "ability") {
    title = ABILITY_LABEL[mode.name] ?? mode.name;
    text = mode.name in CHARACTERS ? CHARACTERS[mode.name as CharKey].text : mode.name === "goldpan" ? GEAR.goldpan.text : g.event ? EVENTS[g.event].text : "";
  } else if (mode.kind === "buy") {
    const k = g.shop[mode.slot];
    title = `Mua ${GEAR[k].emoji} ${GEAR[k].name}`;
    text = GEAR[k].text;
  } else {
    title = "Kết thúc lượt";
    text = over > 0 ? `Bạn giữ tối đa ${limit} lá: chọn ít nhất ${over} lá để bỏ.` : goldrush ? "Có thể bỏ thêm lá để lấy vàng (mỗi lá 1 vàng), hoặc qua lượt luôn." : "";
  }
  const targetPlayer = target ? g.players.find((p) => p.id === target) : null;
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <b className="text-amber-200">{title}</b>
          {text && <p className="text-amber-50/80">{text}</p>}
          {needs.note && <p className="text-xs text-white/60">{needs.note}</p>}
        </div>
        <button className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" onClick={reset} aria-label="Huỷ">
          ✕
        </button>
      </div>
      {canAsBang && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={asBang} onChange={(e) => setAsBang(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          Dùng như BANG!
        </label>
      )}
      {needs.modes && (
        <div className="flex flex-wrap gap-2">
          {needs.modes.map((m) => (
            <button key={m.id} className={cn(btn, opt === m.id ? "bg-amber-400 text-black" : "border border-white/20 bg-white/5")} onClick={() => setOpt(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      )}
      {(target || target2) && (
        <p className="text-sm">
          🎯 {target && nameOf(target)}
          {target2 && <> + {nameOf(target2)}</>}
          {pick && <span className="text-white/70"> · {pick.zone === "hand" ? "1 lá ngẫu nhiên trên tay" : typeOf(pick.card).name}</span>}
        </p>
      )}
      {needs.pick && targetPlayer && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {needs.pick === "any" && (
            <button className={cn(btn, pick?.zone === "hand" ? "bg-amber-400 text-black" : "border border-white/20 bg-white/5")} disabled={!targetPlayer.handCount} onClick={() => setPick({ zone: "hand" })}>
              🂠 Ngẫu nhiên trên tay ({targetPlayer.handCount})
            </button>
          )}
          {targetPlayer.play.map((c) => (
            <PlayChip key={c.id} id={c.id} cubes={c.cubes} active={pick?.zone === "play" && pick.card === c.id} onClick={() => setPick({ zone: "play", card: c.id })} />
          ))}
        </div>
      )}
      {needs.cards && (
        <p className="text-xs text-amber-100/80">
          {needs.cards.label}
          {sel.length > 0 && ` — đã chọn ${sel.length}`}
        </p>
      )}
      {mode.kind === "end" && <p className="text-xs text-amber-100/80">Chạm lá trên tay để chọn — đã chọn {sel.length}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={busy || !ready} onClick={confirm}>
          {mode.kind === "end" ? `Bỏ ${sel.length} lá & qua lượt` : mode.kind === "buy" ? "Mua" : "Xác nhận"}
          <Kbd>Enter</Kbd>
        </button>
        {missing && mode.kind !== "end" && <span className="text-xs text-white/60">{missing}</span>}
      </div>
    </>
  );
}

function PromptPanel({ g, me, prompt, sel, target, opt, busy, nameOf, secondsLeft, setOpt, setSel, run }: PanelProps & { prompt: PromptView }) {
  const left = secondsLeft(prompt.deadline);
  // Desktop shortcuts mirror the visible buttons and their disabled conditions. Taking damage / losing life
  // ("Chịu", "Mất máu") and picking a single card from a list have no key on purpose.
  const respondCards = () => void run({ type: "respond", cards: sel });
  let promptKeys: Record<string, (() => void) | undefined> = {};
  if (!busy) {
    if (prompt.kind === "react") promptKeys = { Enter: sel.length ? respondCards : undefined, p: prompt.answer === "evade" ? () => void run({ type: "respond", take: true }) : undefined };
    else if (prompt.kind === "save") promptKeys = { Enter: () => void run({ type: "respond" }), p: () => void run({ type: "respond", take: true }) };
    else if (prompt.kind === "keep") promptKeys = { Enter: sel.length === prompt.keep ? respondCards : undefined };
    else if (prompt.kind === "discard")
      promptKeys = { Enter: prompt.cause === "poker" ? (sel.length === 1 ? () => void run({ type: "respond", card: sel[0] }) : undefined) : sel.length === prompt.count ? respondCards : undefined };
  }
  useHotkeys(promptKeys);
  const header = (text: React.ReactNode) => (
    <p className="text-sm">
      {text} <span className={cn("font-mono", (left ?? 99) <= 5 && "text-rose-400")}>⏱ {left}s</span>
    </p>
  );
  switch (prompt.kind) {
    case "react": {
      const readyGreen = me.play.filter((c) => !c.fresh && typeOf(c.id).color === "green" && typeOf(c.id).isMissed);
      const word = prompt.answer === "bang" ? "BANG!" : "Trượt!";
      return (
        <>
          {header(
            prompt.answer === "evade" ? (
              <>
                <b className="text-sky-200">{prompt.from ? nameOf(prompt.from) : "?"}</b> đánh <b>{prompt.cause}</b> vào bạn — dùng Chuồn để né?
              </>
            ) : (
              <>
                <b className="text-rose-300">
                  {prompt.cause}
                  {prompt.from ? ` từ ${nameOf(prompt.from)}` : ""}
                </b>
                : đánh {prompt.need} lá {word} (chọn trên tay) hoặc mất {prompt.dmg} máu.
              </>
            ),
          )}
          {readyGreen.length > 0 && prompt.answer === "missed" && (
            <div className="flex flex-wrap gap-1">
              {readyGreen.map((c) => (
                <PlayChip key={c.id} id={c.id} active={sel.includes(c.id)} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={busy || !sel.length} onClick={() => void run({ type: "respond", cards: sel })}>
              {prompt.answer === "evade" ? "🏃 Né" : `Đỡ (${sel.length}/${prompt.need})`}
              <Kbd>Enter</Kbd>
            </button>
            <button className={prompt.answer === "evade" ? ghost : danger} disabled={busy} onClick={() => void run({ type: "respond", take: true })}>
              {prompt.answer === "evade" ? "Bỏ qua" : `Chịu ${prompt.dmg} máu`}
              {prompt.answer === "evade" && <Kbd>P</Kbd>}
            </button>
          </div>
        </>
      );
    }
    case "save":
      return (
        <>
          {header(
            <>
              <b>{nameOf(prompt.target)}</b> sắp mất {prompt.amount} máu — dùng <b>Cứu Nguy</b>?
            </>,
          )}
          <div className="flex gap-2">
            <button className={primary} disabled={busy} onClick={() => void run({ type: "respond" })}>
              😇 Cứu
              <Kbd>Enter</Kbd>
            </button>
            <button className={ghost} disabled={busy} onClick={() => void run({ type: "respond", take: true })}>
              Bỏ qua
              <Kbd>P</Kbd>
            </button>
          </div>
        </>
      );
    case "store":
      return (
        <>
          {header(<>Tạp Hoá: chọn 1 lá</>)}
          <div className="flex flex-wrap gap-1.5">
            {prompt.cards.map((c) => (
              <CardFace key={c} id={c} onClick={() => void run({ type: "respond", card: c })} />
            ))}
          </div>
        </>
      );
    case "pick": {
      const from = g.players.find((p) => p.id === prompt.from);
      return (
        <>
          {header(
            <>
              {prompt.cause}: chọn 1 lá của <b>{nameOf(prompt.from)}</b> để họ bỏ
            </>,
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {!!from?.handCount && (
              <button className={ghost} disabled={busy} onClick={() => void run({ type: "respond" })}>
                🂠 Ngẫu nhiên trên tay ({from.handCount})
              </button>
            )}
            {from?.play.map((c) => (
              <PlayChip key={c.id} id={c.id} cubes={c.cubes} onClick={() => void run({ type: "respond", card: c.id })} />
            ))}
          </div>
        </>
      );
    }
    case "keep": {
      const cards = prompt.cards ?? [];
      return (
        <>
          {header(
            <>
              {prompt.cause === "kit" ? "Soi bài" : prompt.cause === "poker" ? "Xì Phé" : "Rút 2 bỏ 1"}: chọn {prompt.keep} lá để giữ
            </>,
          )}
          <div className="flex flex-wrap gap-1.5">
            {cards.map((c) => (
              <CardFace key={c} id={c} selected={sel.includes(c)} onClick={() => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c].slice(-prompt.keep))} />
            ))}
          </div>
          <button className={primary} disabled={busy || sel.length !== prompt.keep} onClick={() => void run({ type: "respond", cards: sel })}>
            Giữ {sel.length}/{prompt.keep}
            <Kbd>Enter</Kbd>
          </button>
        </>
      );
    }
    case "discard":
      return prompt.cause === "poker" ? (
        <>
          {header(<>Xì Phé: úp 1 lá trên tay (không có lá A thì người đánh lấy tối đa 2 lá)</>)}
          <button className={primary} disabled={busy || sel.length !== 1} onClick={() => void run({ type: "respond", card: sel[0] })}>
            Úp lá đã chọn
            <Kbd>Enter</Kbd>
          </button>
        </>
      ) : (
        <>
          {header(
            <>
              Nữ Cướp: bỏ {prompt.count} lá trên tay, hoặc mất {prompt.orLose} máu
            </>,
          )}
          <div className="flex gap-2">
            <button className={primary} disabled={busy || sel.length !== prompt.count} onClick={() => void run({ type: "respond", cards: sel })}>
              Bỏ {sel.length}/{prompt.count} lá
              <Kbd>Enter</Kbd>
            </button>
            <button className={danger} disabled={busy} onClick={() => void run({ type: "respond", take: true })}>
              Mất {prompt.orLose} máu
            </button>
          </div>
        </>
      );
    case "copy":
      return (
        <>
          {header(<>Vê Bắt Chước: chọn sức mạnh cho lượt này</>)}
          <div className="grid gap-2 sm:grid-cols-2">
            {prompt.options.map((c) => (
              <CharCard key={c} char={c} onClick={() => void run({ type: "respond", choice: c })} />
            ))}
          </div>
        </>
      );
    case "draw":
      return <DrawPanel g={g} me={me} prompt={prompt} target={target} opt={opt} setOpt={setOpt} busy={busy} run={run} header={header} nameOf={nameOf} />;
  }
}

const DRAW_LABEL: Record<DrawMode, string> = {
  normal: "Rút bình thường",
  jesse: "🧤 Lá đầu từ tay 1 người",
  pedro: "🗑️ Lá đầu từ đống bỏ",
  pat: "🦝 Lấy 1 lá trước mặt ai đó",
  evelyn: "🔥 Bỏ bớt lá để bắn",
  liquor: "🥃 Không rút, hồi 1 máu",
  peyote: "🍄 Đoán màu",
};

function DrawPanel({
  g,
  me,
  prompt,
  target,
  opt,
  setOpt,
  busy,
  run,
  header,
  nameOf,
}: {
  g: BangGameView;
  me: BangPlayerView;
  prompt: Extract<PromptView, { kind: "draw" }>;
  target: string | null;
  opt: string | null;
  setOpt: (o: string | null) => void;
  busy: boolean;
  run: (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;
  header: (t: React.ReactNode) => React.ReactNode;
  nameOf: (id: string) => string;
}) {
  const [swap, setSwap] = useState(false);
  const [blood, setBlood] = useState<string>("");
  const [evelyn, setEvelyn] = useState<string[]>([]);
  const extra = { ...(swap ? { swap: true } : {}), ...(blood ? { blood } : {}) };
  const living = g.players.filter((p) => p.id !== me.id && !p.dead);
  // D = the "Rút bình thường" button (Enter too while no special draw is being set up).
  const drawNormal = !busy && prompt.options.includes("normal") ? () => void run({ type: "draw", mode: "normal", ...extra }) : undefined;
  useHotkeys({ d: drawNormal, Enter: opt ? undefined : drawNormal });
  return (
    <>
      {header(<>Giai đoạn rút bài</>)}
      {prompt.swap && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          🪪 Đổi sang nhân vật thứ hai (máu về 2)
        </label>
      )}
      {prompt.blood && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          🩸 Truyền 1 máu cho
          <select value={blood} onChange={(e) => setBlood(e.target.value)} className="rounded bg-black/40 px-1 py-0.5">
            <option value="">— không —</option>
            {living.map((p) => (
              <option key={p.id} value={p.id}>
                {nameOf(p.id)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {prompt.options.map((m) => (
          <button key={m} className={cn(btn, opt === m ? "bg-amber-400 text-black" : m === "normal" ? "bg-amber-400/90 text-black" : "border border-white/20 bg-white/5")} disabled={busy} onClick={() => (m === "normal" || m === "pedro" || m === "liquor" ? void run({ type: "draw", mode: m, ...extra }) : setOpt(m))}>
            {DRAW_LABEL[m]}
            {m === "normal" && <Kbd>D</Kbd>}
          </button>
        ))}
      </div>
      {opt === "jesse" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Chạm vào người để rút từ tay họ:</span>
          <button className={primary} disabled={busy || !target} onClick={() => void run({ type: "draw", mode: "jesse", target, ...extra })}>
            Rút từ {target ? nameOf(target) : "…"}
          </button>
        </div>
      )}
      {opt === "pat" && <p className="text-sm">Chạm vào 1 lá trước mặt người khác để lấy.</p>}
      {opt === "evelyn" && (
        <div className="space-y-1 text-sm">
          <p>Chọn 1–2 người trong tầm (mỗi người bớt 1 lá rút):</p>
          <div className="flex flex-wrap gap-1.5">
            {living
              .filter((p) => (p.dist ?? 99) <= g.range)
              .map((p) => (
                <button key={p.id} className={cn(btn, evelyn.includes(p.id) ? "bg-rose-500 text-white" : "border border-white/20 bg-white/5")} onClick={() => setEvelyn((e) => (e.includes(p.id) ? e.filter((x) => x !== p.id) : [...e, p.id].slice(-2)))}>
                  🎯 {nameOf(p.id)}
                </button>
              ))}
          </div>
          <button className={primary} disabled={busy || !evelyn.length} onClick={() => void run({ type: "draw", mode: "evelyn", targets: evelyn, ...extra })}>
            Bắn {evelyn.length} người
          </button>
        </div>
      )}
      {opt === "peyote" && (
        <div className="flex gap-2">
          <button className={cn(btn, "bg-rose-600 text-white")} disabled={busy} onClick={() => void run({ type: "draw", mode: "peyote", color: "red", ...extra })}>
            🔴 Đỏ
          </button>
          <button className={cn(btn, "bg-zinc-800 text-white")} disabled={busy} onClick={() => void run({ type: "draw", mode: "peyote", color: "black", ...extra })}>
            ⚫ Đen
          </button>
        </div>
      )}
    </>
  );
}
