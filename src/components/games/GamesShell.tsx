"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAX_NAME_LENGTH } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { AllRoomsPanel } from "./AllRoomsPanel";
import { FullscreenButton, GAME_HEADER_SLOT_ID } from "./GameHeader";
import { Toaster } from "sonner";
import { gameFont } from "./gameFont";
import { getSavedProfile, saveName, saveProfile, usePlayerName, usePlayerProfile, type PlayerProfile } from "./gameClient";
import { PlayerAvatar, ProfilePicker } from "./PlayerAvatar";
import { ONLINE_GAMES, gameOfPath, gamesPageKind } from "./gamesRegistry";

interface GamesShellContext {
  /** Opens the "đổi tên" dialog of the games top bar. */
  openRename: () => void;
}

const ShellContext = createContext<GamesShellContext>({ openRename: () => {} });

export const useGamesShell = () => useContext(ShellContext);

/**
 * Layout of every games route (/games, each lobby, each table): games top bar,
 * the player-name gate, the all-rooms panel on hub/lobby pages and a slim footer.
 * Replaces the portfolio's Navigation/Footer, which hide themselves on these routes.
 */
export function GamesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const kind = gamesPageKind(pathname);
  const game = gameOfPath(pathname);
  const name = usePlayerName();
  const [renaming, setRenaming] = useState(false);
  const table = kind === "table";

  let body: React.ReactNode;
  if (name === null) {
    // Not read yet (SSR / first paint): keep hub & lobby markup for SSR, tables wait for the name.
    body = table ? null : <div className="invisible">{children}</div>;
  } else if (!name) {
    body = <NameGate />;
  } else if (table) {
    body = children;
  } else {
    body = (
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-0 pb-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:px-4">
        <div className="min-w-0">{children}</div>
        <aside className="min-w-0 px-4 xl:px-0 xl:pt-4">
          <div className="xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto xl:[scrollbar-width:thin]">
            <AllRoomsPanel currentGame={game?.id} />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <ShellContext.Provider value={{ openRename: () => setRenaming(true) }}>
      <Toaster theme="dark" position="top-center" richColors visibleToasts={3} toastOptions={{ duration: 2800 }} />
      <div className={cn("flex min-h-[100dvh] flex-col [&_h1]:[font-family:var(--font-game)] [&_h2]:[font-family:var(--font-game)] [&_h3]:[font-family:var(--font-game)]", gameFont.variable, table && "games-shell-table")}>
        <GamesTopBar compact={table} name={name} onRename={() => setRenaming(true)} />
        {/* The bar is taller on phones (finger-sized buttons): keep the table exactly one screen tall. */}
        <div className={cn("flex-1", table && "games-table max-sm:[--games-bar-h:calc(2.75rem_+_1px)] short:[--games-bar-h:calc(2.75rem_+_1px)]")}>{body}</div>
        {!table && <GamesFooter />}
      </div>
      {renaming && name && <RenameDialog current={name} inTable={table} onClose={() => setRenaming(false)} />}
    </ShellContext.Provider>
  );
}

function GamesTopBar({ compact, name, onRename }: { compact: boolean; name: string | null; onRename: () => void }) {
  const pathname = usePathname();
  const active = gameOfPath(pathname);
  const profile = usePlayerProfile();

  return (
    <header
      className={cn(
        "z-40 w-full border-b border-white/10 bg-black/60 text-white backdrop-blur-xl",
        // Tables: slim; the table's own header (room code, invite…) lives in here too.
        compact ? "relative" : "sticky top-0",
      )}
    >
      <nav className={cn("mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-4", compact ? "h-9 max-sm:h-11 short:h-11" : "h-12")} aria-label="Games">
        <Link
          href="/"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 font-black tracking-tight transition-colors hover:bg-white/10 max-sm:min-h-9 short:min-h-9",
            !active && "text-amber-300",
          )}
          aria-current={!active ? "page" : undefined}
        >
          <span className={cn("grid place-items-center rounded-md bg-gradient-to-br from-amber-400 to-rose-500 text-black", compact ? "size-6 text-sm" : "size-7")} aria-hidden>
            🎮
          </span>
          <span className={cn("hidden", compact ? "text-sm xl:inline" : "text-base sm:inline")}>Games</span>
        </Link>

        <span className="h-5 w-px shrink-0 bg-white/10" aria-hidden />

        <ul className={cn("flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]", compact ? "hidden shrink-0 lg:flex" : "flex-1")}>
          {ONLINE_GAMES.map((g) => {
            const on = active?.id === g.id;
            return (
              <li key={g.id} className="shrink-0">
                <Link
                  href={g.href}
                  title={g.title}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 transition-colors",
                    compact ? "py-0.5 text-xs" : "py-1 text-sm max-sm:min-h-9 max-sm:min-w-9 max-sm:justify-center",
                    on ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40" : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span aria-hidden>{g.emoji}</span>
                  {/* Tables: icons only, so the table header portalled next to them always has room.
                      Hub / lobbies: the current game's label from sm, every label once all of them fit. */}
                  {!compact && <span className={cn("hidden", on ? "sm:inline" : "xl:inline")}>{g.short}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {compact && <div id={GAME_HEADER_SLOT_ID} className="flex min-w-0 flex-1 items-center" />}
        <FullscreenButton />

        {name && (
          <button
            onClick={onRename}
            title="Đổi tên"
            className={cn(
              "flex min-w-0 shrink items-center gap-1.5 rounded-full border border-white/15 bg-white/5 pl-1 pr-2.5 transition-colors hover:border-amber-300/50 hover:bg-white/10 max-sm:min-h-9 max-sm:pl-1.5 short:min-h-9",
              compact ? "py-0.5 text-xs" : "py-1 text-sm",
            )}
          >
            <PlayerAvatar name={name} profile={profile} className={compact ? "size-5 text-[10px]" : "size-6 text-xs"} />
            {/* Tables: the name only on wide screens, the table header needs the room. */}
            <span className={cn("max-w-[10rem] truncate font-medium max-sm:hidden", compact && "hidden xl:inline")}>{name}</span>
            <span className={cn("text-white/50 max-sm:hidden", compact && "hidden xl:inline")} aria-hidden>
              ✎
            </span>
          </button>
        )}
      </nav>
    </header>
  );
}

function GamesFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/40 text-xs text-white/50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p>
          🎮 <span className="font-semibold text-white/70">Games</span> · chơi online cùng bạn bè, ngay trên trình duyệt
        </p>
        <p className="flex items-center gap-3">
          <Link href="/" className="hover:text-white max-sm:py-2">
            Tất cả game
          </Link>
          <span>© {new Date().getFullYear()} ThachHuynh</span>
        </p>
      </div>
    </footer>
  );
}

function NameInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      id="games-player-name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={MAX_NAME_LENGTH}
      autoFocus={autoFocus}
      autoComplete="nickname"
      enterKeyHint="go"
      placeholder="VD: Thạch"
      className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-lg text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-400"
    />
  );
}

/** First stop of the games section: pick the name used at every table. */
function NameGate() {
  const [value, setValue] = useState("");
  const [profile, setProfile] = useState<PlayerProfile>(getSavedProfile);
  const trimmed = value.trim();
  return (
    <main className="flex min-h-[calc(100dvh-3rem)] items-center justify-center px-4 py-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          saveProfile(profile);
          saveName(trimmed);
        }}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/45 p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <p className="mb-4 whitespace-nowrap text-center text-2xl leading-none sm:text-3xl" aria-hidden>
          🃏 😼 🎩 💎 🤠 🪨 🐴
        </p>
        <h1 className="text-center text-2xl font-black tracking-tight text-amber-300">Chào mừng tới Games!</h1>
        <p className="mb-6 mt-2 text-center text-sm text-white/65">Chọn một cái tên để bạn bè nhận ra bạn — tên này dùng cho mọi game và đổi được bất cứ lúc nào.</p>
        <label htmlFor="games-player-name" className="mb-1.5 block text-sm text-white/70">
          Tên của bạn
        </label>
        <NameInput value={value} onChange={setValue} autoFocus />
        <ProfilePicker name={trimmed} value={profile} onChange={setProfile} />
        <button
          type="submit"
          disabled={!trimmed}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-3 font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Vào chơi →
        </button>
      </form>
    </main>
  );
}

function RenameDialog({ current, inTable, onClose }: { current: string; inTable: boolean; onClose: () => void }) {
  const [value, setValue] = useState(current);
  const saved = usePlayerProfile();
  const [profile, setProfile] = useState<PlayerProfile>(saved);
  const trimmed = value.trim();
  const changed = trimmed !== current || profile.icon !== saved.icon || profile.color !== saved.color;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="games-rename-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          saveProfile(profile);
          saveName(trimmed);
          onClose();
        }}
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#111013] p-5 text-white shadow-2xl"
      >
        <h2 id="games-rename-title" className="mb-3 text-lg font-bold text-amber-300">
          Đổi tên &amp; biểu tượng
        </h2>
        <NameInput value={value} onChange={setValue} autoFocus />
        <ProfilePicker name={trimmed} value={profile} onChange={setProfile} />
        {inTable && <p className="mt-2 text-xs text-white/50">Bàn hiện tại vẫn giữ tên cũ — tên mới dùng từ bàn tiếp theo. Biểu tượng và màu đổi ngay tại bàn.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
            Huỷ
          </button>
          <button
            type="submit"
            disabled={!trimmed || !changed}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
          >
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}
