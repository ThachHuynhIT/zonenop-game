"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Celebration } from "@/components/game-ui/Celebration";
import { Countdown } from "@/components/game-ui/Countdown";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
import { GamePanel } from "@/components/game-ui/GamePanel";
import { GameThemeScope } from "@/components/game-ui/theme";
import { gameToast } from "@/components/game-ui/toast";
import { ChatBox } from "@/components/games/ChatBox";
import { GameHeader, HeaderLabel, headerBtn } from "@/components/games/GameHeader";
import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import { RoomRoster } from "@/components/games/RoomRoster";
import { SettingsTabs } from "@/components/games/SettingsTabs";
import { MyTurnBadge, TurnRing } from "@/components/games/TurnIndicator";
import { useGameRoom } from "@/components/games/gameClient";
import { SeatBubble, SpectatorReactions, useLiveReactions } from "@/components/tienlen/Effects";
import { DeltaBadge, ScoreboardModal, signed } from "@/components/tienlen/Scoreboard";
import { MAX_WORDS, MIN_PLAYERS, TURN_SECONDS_OPTIONS, syllablesOf } from "@/lib/noichu/board";
import { NOICHU_WS_PATH, type NCGameView, type NCPlayerView, type NCRoomView, type NCSeatView } from "@/lib/noichu/protocol";
import type { Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import styles from "./NoiChuTable.module.scss";

type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

const SCORE_NOTE =
  "Điểm theo thứ hạng: người cuối cùng còn lại nhận điểm Nhất, người bị loại muộn nhất nhận điểm Nhì, những người bị loại sớm nhất bị trừ tương ứng. Hết số từ tối đa thì xếp theo số từ đã nối (bằng nhau thì chung hạng). Chủ bàn chọn điểm Nhất / Nhì.";

const SCOREBOARD_CLASS = "border-teal-200/15 bg-[#06242a] text-teal-50";

const END_REASON: Record<string, string> = {
  last: "Người cuối cùng còn lại thắng — những người khác đã hết giờ.",
  forfeit: "Những người còn lại thắng — có người đã rời ván.",
  limit: `Chuỗi đã đủ ${MAX_WORDS} từ — xếp hạng theo số từ đã nối.`,
};

/** Shift the server's deadline onto this device's clock. */
function localize(view: NCRoomView): NCRoomView {
  const g = view.current;
  if (!g?.deadline) return view;
  const skew = Date.now() - view.serverTime;
  return { ...view, current: { ...g, deadline: g.deadline + skew } };
}

export default function NoiChuTable({ code, name, watch }: { code: string; name: string; watch?: boolean }) {
  const { view, status, error, call } = useGameRoom<NCRoomView>(NOICHU_WS_PATH, code, name, watch ? "watch" : "play", localize);
  const act = useCallback<Act>(
    async (msg) => {
      const res = await call(msg);
      if (!res.ok) gameToast.error(res.error);
      return res.ok;
    },
    [call],
  );

  if (status === "error") {
    return (
      <div className={styles.error}>
        <p className={styles.errorText}>{error}</p>
        <div className={styles.errorActions}>
          {error?.includes("đủ") && (
            <GameButton variant="primary" nativeButton={false} render={<Link href={`/noi-chu/${code}?watch=1`} />}>
              Vào xem 👀
            </GameButton>
          )}
          <GameButton nativeButton={false} render={<Link href="/noi-chu" />}>
            Về sảnh
          </GameButton>
        </div>
      </div>
    );
  }
  if (!view) return <p className={cn(styles.connecting, "animate-pulse")}>Đang kết nối bàn {code}…</p>;
  return (
    <GameThemeScope game="noichu" className="contents">
      <Table view={view} reconnecting={status === "reconnecting"} act={act} />
      <ChatBox messages={view.chat} meId={view.meId} myName={name} onSend={(text) => act({ type: "chat", text })} onEmoji={(emoji) => void act({ type: "emoji", emoji })} row />
    </GameThemeScope>
  );
}

function Table({ view, reconnecting, act }: { view: NCRoomView; reconnecting: boolean; act: Act }) {
  const g = view.current;
  const playing = g?.status === "playing";
  const ended = g?.status === "ended";
  const me = view.seats.find((s) => s?.id === view.meId) ?? null;
  const mine = g?.players.find((p) => p.id === view.meId) ?? null;
  const myTurn = !!mine && playing && g?.turn === view.meId && !mine.out;
  const nameOf = (id: string) => view.seats.find((s) => s?.id === id)?.name ?? view.history.flatMap((h) => h.results).find((r) => r.id === id)?.name ?? "?";

  const [showScores, setShowScores] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const live = useLiveReactions(view.reactions);
  const reactionsFor = (id: string): Reaction[] => live.filter((r) => r.playerId === id);

  const copyInvite = async () => {
    const url = new URL(`/noi-chu/${view.code}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Chép link mời:", url);
    }
  };

  const turnMs = view.settings.turnSeconds * 1000;
  return (
    <div className={styles.table}>
      <Celebration show={!!ended} playing={!!playing} won={!!mine && ended && mine.rank === 0 && !!g?.winner} title={ended ? (g?.winner ? `🏆 ${nameOf(g.winner)} thắng` : "🤝 Hoà") : undefined} />
      <GameHeader
        primary={
          <>
            <Link href="/noi-chu" className={headerBtn}>
              ← Sảnh
            </Link>
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-teal-300">{view.code}</span>
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
              <span className="whitespace-nowrap" title={g.dictionary ? "Mỗi từ được kiểm tra với từ điển" : "Không kiểm tra từ điển: gõ từ nào cũng được"}>
                📚 {g.dictionary ? "Có từ điển" : "Tắt từ điển"}
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
        <div className={styles.layout}>
          <section className={styles.main}>
            <SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
            <ul className={styles.players} aria-label="Người chơi">
              {g.players.map((p) => {
                const seat = view.seats.find((s) => s?.id === p.id) ?? null;
                return (
                  <PlayerChip
                    key={p.id}
                    p={p}
                    g={g}
                    name={nameOf(p.id)}
                    seat={seat}
                    self={p.id === view.meId}
                    turnMs={turnMs}
                    reactions={reactionsFor(p.id)}
                    onKick={me?.isHost && seat && !seat.connected && !seat.kicked && !p.out && p.id !== view.meId ? () => void act({ type: "kick", playerId: p.id }) : undefined}
                  />
                );
              })}
            </ul>

            <GamePanel className={styles.stage}>
              <Stage g={g} myTurn={myTurn} mine={mine} meId={view.meId} nameOf={nameOf} act={act} />
            </GamePanel>

            {ended && (
              <div className="flex justify-center lg:hidden">
                <Waiting view={view} me={me} act={act} nameOf={nameOf} />
              </div>
            )}
          </section>

          <aside className={styles.side}>
            {ended && (
              <div className="hidden lg:block [&>div]:max-w-none">
                <Waiting view={view} me={me} act={act} nameOf={nameOf} />
              </div>
            )}
            <GamePanel title="Diễn biến" className="p-3 sm:p-3">
              <ul className={styles.log}>
                {g.log
                  .slice()
                  .reverse()
                  .map((e) => (
                    <li key={e.id} className={cn(styles.logItem, e.tone === "out" && styles.logOut, e.tone === "win" && styles.logWin, e.tone === "word" && styles.logWord)}>
                      {e.text}
                    </li>
                  ))}
              </ul>
            </GamePanel>
          </aside>
        </div>
      )}

      {showScores && <ScoreboardModal view={view} onClose={() => setShowScores(false)} note={SCORE_NOTE} className={SCOREBOARD_CLASS} />}
      <GameDialog
        open={showRules}
        onOpenChange={setShowRules}
        title="📖 Luật Nối Chữ"
        footer={
          <GameButton size="sm" onClick={() => setShowRules(false)}>
            Đóng
          </GameButton>
        }
      >
        <NoiChuRules />
      </GameDialog>
    </div>
  );
}

function PlayerChip({
  p,
  g,
  name,
  seat,
  self,
  turnMs,
  reactions,
  onKick,
}: {
  p: NCPlayerView;
  g: NCGameView;
  name: string;
  seat: NCSeatView | null;
  self: boolean;
  turnMs: number;
  reactions: Reaction[];
  onKick?: () => void;
}) {
  const isTurn = g.status === "playing" && g.turn === p.id;
  const winner = g.status === "ended" && g.winner === p.id;
  return (
    <li className={cn(styles.player, isTurn && styles.turn, p.out && styles.out, winner && styles.winner, seat && !seat.connected && !p.out && styles.offline)}>
      <span className="relative">
        <SeatBubble reactions={reactions} />
        <SeatAvatar name={name} out={p.out} className={styles.avatar} fallbackClassName={styles.avatarFallback} />
      </span>
      <span className={styles.who}>
        <span className={styles.name}>
          {seat?.isHost && <span title="Chủ bàn">👑 </span>}
          {name}
          {self && <span className="font-normal text-white/60"> (bạn)</span>}
          {winner && <span title="Thắng"> 🏆</span>}
        </span>
        <span className={styles.meta}>
          ✍️ {p.words} từ
          {p.out && <span className={styles.tag}>Bị loại</span>}
          {seat && !seat.connected && !seat.kicked && !p.out && <span className={styles.tag}>Mất kết nối</span>}
          {seat?.kicked && <span className={styles.tag}>Bị kích</span>}
          {seat && seat.games > 0 && <span className={cn("ml-1 font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")}>{signed(seat.points)}đ</span>}
        </span>
      </span>
      {isTurn && <Countdown deadline={g.deadline} total={turnMs} size={36} />}
      {onKick && (
        <GameButton size="sm" variant="danger" confirm="Chắc chắn?" onClick={onKick} className={styles.kick} title="Kích người mất kết nối">
          Kích
        </GameButton>
      )}
    </li>
  );
}

/** The word on the table, the chain so far and (on your turn) the box to type your word in. */
function Stage({ g, myTurn, mine, meId, nameOf, act }: { g: NCGameView; myTurn: boolean; mine: NCPlayerView | null; meId: string; nameOf: (id: string) => string; act: Act }) {
  const playing = g.status === "playing";
  const last = g.chain[g.chain.length - 1];
  const [first, second] = last ? syllablesOf(last.word) : ["", ""];
  const need = g.need ?? second;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chainRef = useRef<HTMLOListElement>(null);

  // A new turn for me: start the box with the syllable I have to continue, so only the second one is left to type.
  const turnKey = myTurn ? `${g.chainLength}:${g.turn}` : "";
  const [seenTurn, setSeenTurn] = useState("");
  if (turnKey !== seenTurn) {
    setSeenTurn(turnKey);
    setText(turnKey ? `${need} ` : "");
  }
  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn, turnKey]);
  useEffect(() => {
    chainRef.current?.scrollTo({ top: chainRef.current.scrollHeight });
  }, [g.chainLength]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTurn || busy || !text.trim()) return;
    setBusy(true);
    const ok = await act({ type: "word", text });
    setBusy(false);
    if (ok) setText("");
    else inputRef.current?.focus();
  };

  return (
    <>
      {last ? (
        <>
          <p className={styles.prompt}>{playing ? <>Nối tiếp bằng “<b>{need}</b>”</> : "Từ cuối cùng"}</p>
          <p className={styles.last}>
            {first} <span className={playing ? styles.need : undefined}>{second}</span>
          </p>
        </>
      ) : null}
      {g.chain.length > 1 && (
        <ol ref={chainRef} className={styles.chain} aria-label="Các từ đã nối">
          {g.chain.slice(0, -1).map((w, i) => (
            <li key={`${g.chainLength}-${i}`} className={cn(styles.chip, w.by === meId && styles.mine)} title={w.by ? nameOf(w.by) : "Từ mở đầu"}>
              {w.word}
            </li>
          ))}
        </ol>
      )}
      {playing && myTurn ? (
        <form onSubmit={submit} className={styles.form}>
          <TurnRing active className="rounded-full" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={styles.input}
            placeholder={`${need} …`}
            aria-label="Từ của bạn"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={40}
          />
          <GameButton type="submit" variant="primary" loading={busy} disabled={!text.trim()}>
            Gửi
          </GameButton>
        </form>
      ) : (
        <p className={styles.wait}>
          {!playing
            ? null
            : mine?.out
              ? "Bạn đã bị loại — xem tiếp các bạn nối chữ."
              : mine
                ? <>Lượt của <b>{nameOf(g.turn ?? "")}</b>…</>
                : <>Đang xem — lượt của <b>{nameOf(g.turn ?? "")}</b>.</>}
        </p>
      )}
      {myTurn && (
        <span className="flex items-center gap-2">
          <MyTurnBadge />
          <span className="text-xs text-white/50 [@media(pointer:coarse)]:hidden">
            <kbd className="rounded border border-white/20 px-1 font-mono">Enter</kbd> để gửi
          </span>
        </span>
      )}
    </>
  );
}

function Waiting({ view, me, act, nameOf }: { view: NCRoomView; me: NCSeatView | null; act: Act; nameOf: (id: string) => string }) {
  const g = view.current;
  const count = view.seats.filter(Boolean).length;
  const maxSeats = view.seats.length;
  const ended = g?.status === "ended";
  const last = view.history[view.history.length - 1];
  const isHost = !!me?.isHost && view.role === "player";
  const s = view.settings;
  return (
    <GamePanel className={styles.card}>
      {ended && g ? (
        <>
          <h2 className="mb-1 font-heading text-xl font-black text-teal-300">{g.winner ? `🏆 ${nameOf(g.winner)} thắng!` : "🤝 Hoà!"}</h2>
          {g.endReason && <p className={styles.hint}>{END_REASON[g.endReason]}</p>}
          <ol className={styles.ranking}>
            {g.finished.map((id) => {
              const p = g.players.find((x) => x.id === id);
              const d = last?.results.find((r) => r.id === id)?.delta;
              return (
                <li key={id} className={styles.rankRow}>
                  <span className="min-w-0">
                    {p?.rank != null && <span className={styles.rankNo}>#{p.rank + 1}</span>}
                    <b>{nameOf(id)}</b> {id === view.meId && <span className="text-white/60">(bạn)</span>}
                    <span className="block text-xs text-white/60">
                      ✍️ {p?.words ?? 0} từ{p?.out ? " · bị loại" : ""}
                    </span>
                  </span>
                  {d !== undefined && <DeltaBadge delta={d} />}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <>
          <h2 className="mb-1 font-heading text-xl font-black text-teal-300">🔤 Nối Chữ</h2>
          <p className="mb-2 text-sm text-teal-100/80">
            {count}/{maxSeats} người ({MIN_PLAYERS}–{maxSeats}) · gửi link mời để bạn bè vào bàn
          </p>
          <RoomRoster seats={view.seats} meId={view.meId} />
        </>
      )}
      <SettingsTabs
        className="mb-4"
        tabs={[
          {
            id: "rules",
            label: "🔤 Luật",
            content: (
              <label className={styles.field}>
                <span>
                  Kiểm tra từ điển <span className="text-white/50">(tắt thì từ nào cũng được, miễn đúng 2 tiếng và nối đúng)</span>
                </span>
                <input type="checkbox" checked={s.dictionary} disabled={!isHost} onChange={(e) => void act({ type: "settings", dictionary: e.target.checked })} className="h-4 w-4 accent-teal-400" />
              </label>
            ),
          },
          {
            id: "time",
            label: "⏱️ Lượt",
            content: (
              <label className={styles.field}>
                <span>Thời gian mỗi lượt</span>
                <select value={s.turnSeconds} disabled={!isHost} onChange={(e) => void act({ type: "settings", turnSeconds: Number(e.target.value) })} className={styles.select}>
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
      {!isHost && <p className={styles.hint}>Chỉ chủ bàn đổi được luật.</p>}
      {isHost ? (
        <GameButton variant="primary" size="lg" shine className="w-full" onClick={() => void act({ type: "start" })} disabled={count < MIN_PLAYERS}>
          {count < MIN_PLAYERS ? `Cần ít nhất ${MIN_PLAYERS} người` : ended ? "Ván mới" : `Bắt đầu (${count} người)`}
        </GameButton>
      ) : (
        <p className="text-sm text-teal-100/70">{view.role === "spectator" ? "Chờ ván mới…" : "Chờ chủ bàn bắt đầu…"}</p>
      )}
    </GamePanel>
  );
}

export function NoiChuRules() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>
        Chơi <b>2–8 người</b>. Máy chọn một từ ghép 2 tiếng để mở đầu, mọi người lần lượt nối tiếp.
      </li>
      <li>
        Đến lượt, gõ một <b>từ ghép đúng 2 tiếng</b> mà <b>tiếng đầu trùng tiếng cuối</b> của từ trước, kể cả dấu thanh (ví dụ <i>con mèo</i> → <i>mèo nổ</i>; <i>meo</i> không nối được <i>mèo</i>). Ô nhập đã điền sẵn tiếng cần nối, bạn chỉ cần gõ tiếng còn lại.
      </li>
      <li>
        Không được dùng lại từ đã có trong ván. Từ phải có trong từ điển (chủ bàn có thể tắt kiểm tra này). Từ sai chỉ báo lỗi, đồng hồ vẫn chạy nên bạn gõ lại được.
      </li>
      <li>
        <b>Hết giờ thì bị loại</b> (mất kết nối cũng không kịp trả lời). Người cuối cùng còn lại thắng. Chuỗi dài tới {MAX_WORDS} từ thì dừng, xếp hạng theo số từ đã nối.
      </li>
      <li>Điểm xếp hạng theo thứ tự bị loại: người thắng nhận điểm Nhất, người bị loại muộn nhất nhận điểm Nhì; chủ bàn chọn điểm Nhất / Nhì.</li>
      <li>Từ điển chưa đầy đủ, nếu từ đúng bị báo thiếu thì nhờ chủ bàn tắt kiểm tra từ điển cho ván sau.</li>
    </ul>
  );
}
