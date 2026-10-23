"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AllRoomsPanel } from "./AllRoomsPanel";
import { FullscreenButton, GAME_HEADER_SLOT_ID } from "./GameHeader";
import { Toaster } from "sonner";
import { gameFont } from "./gameFont";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { refreshMe, useSession } from "@/components/auth/session";
import { usePlayerName, usePlayerProfile } from "./gameClient";
import { PlayerAvatar } from "./PlayerAvatar";
import { ONLINE_GAMES, gameOfPath, gamesPageKind } from "./gamesRegistry";

interface GamesShellContext {
  /** Opens the account dialog of the games top bar. */
  openAccount: () => void;
}

const ShellContext = createContext<GamesShellContext>({ openAccount: () => {} });

export const useGamesShell = () => useContext(ShellContext);

/**
 * Layout of every games route (/games, each lobby, each table): games top bar,
 * the required sign-in, the all-rooms panel on hub/lobby pages and a slim footer.
 * Replaces the portfolio's Navigation/Footer, which hide themselves on these routes.
 */
export function GamesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const kind = gamesPageKind(pathname);
  const game = gameOfPath(pathname);
  const name = usePlayerName();
  const router = useRouter();
  const session = useSession();
  const [renaming, setRenaming] = useState(false);
  const signedIn = session !== null;

  // Not signed in: off to the sign-in page, which brings us back here afterwards.
  useEffect(() => {
    if (name !== null && !signedIn) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/dang-nhap?next=${encodeURIComponent(here)}`);
    }
  }, [name, signedIn, router]);
  // Signed in: re-read the account once (role / look may have changed elsewhere).
  const refreshed = useRef(false);
  useEffect(() => {
    if (!signedIn) refreshed.current = false;
    else if (!refreshed.current) {
      refreshed.current = true;
      void refreshMe();
    }
  }, [signedIn]);
  const lastCheckedAt = useRef(0);
  useEffect(() => {
    if (!signedIn) return;
    lastCheckedAt.current = Date.now();
    const onVisible = () => {
      const now = Date.now();
      if (document.visibilityState !== "visible" || now - lastCheckedAt.current < 30_000) return;
      lastCheckedAt.current = now;
      void refreshMe();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [signedIn]);
  const table = kind === "table";

  let body: React.ReactNode;
  if (name === null) {
    // Not read yet (SSR / first paint): keep hub & lobby markup for SSR, tables wait for the name.
    body = table ? null : <div className="invisible">{children}</div>;
  } else if (!signedIn) {
    body = null; // redirecting to /dang-nhap
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
    <ShellContext.Provider value={{ openAccount: () => setRenaming(true) }}>
      <Toaster theme="dark" position="top-center" richColors visibleToasts={3} toastOptions={{ duration: 2800 }} />
      <div className={cn("flex min-h-[100dvh] flex-col [&_h1]:[font-family:var(--font-game)] [&_h2]:[font-family:var(--font-game)] [&_h3]:[font-family:var(--font-game)]", gameFont.variable, table && "games-shell-table")}>
        <GamesTopBar compact={table} name={signedIn ? name : null} onRename={() => setRenaming(true)} />
        {/* The bar is taller on phones (finger-sized buttons): keep the table exactly one screen tall. */}
        <div className={cn("flex-1", table && "games-table max-sm:[--games-bar-h:calc(2.75rem_+_1px)] short:[--games-bar-h:calc(2.75rem_+_1px)]")}>{body}</div>
        {!table && <GamesFooter />}
      </div>
      {renaming && signedIn && <AccountMenu onClose={() => setRenaming(false)} />}
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
            title="Tài khoản"
            aria-label="Tài khoản"
            className={cn(
              "flex min-w-0 shrink items-center gap-1.5 rounded-full border border-white/15 bg-white/5 pl-1 pr-2.5 transition-colors hover:border-amber-300/50 hover:bg-white/10 max-sm:min-h-9 max-sm:pl-1.5 short:min-h-9",
              compact ? "py-0.5 text-xs" : "py-1 text-sm",
            )}
          >
            <PlayerAvatar name={name} profile={profile} className={compact ? "size-5 text-[10px]" : "size-6 text-xs"} />
            {/* Tables: the name only on wide screens, the table header needs the room. */}
            <span className={cn("max-w-[10rem] truncate font-medium max-sm:hidden", compact && "hidden xl:inline")}>{name}</span>
            <span className={cn("text-white/50 max-sm:hidden", compact && "hidden xl:inline")} aria-hidden>
              ▾
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
