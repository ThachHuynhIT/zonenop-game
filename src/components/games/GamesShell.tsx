"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AllRoomsPanel } from "./AllRoomsPanel";
import { FullscreenButton, GAME_HEADER_SLOT_ID } from "./GameHeader";
import { Toaster } from "sonner";
import { PixelIcon } from "@/components/game-ui";
import styles from "./GamesShell.module.scss";
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
      <div className={styles.columns}>
        <div className={styles.content}>{children}</div>
        <aside className={styles.aside}>
          <div className={styles.rooms}>
            <AllRoomsPanel currentGame={game?.id} />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <ShellContext.Provider value={{ openAccount: () => setRenaming(true) }}>
      <Toaster theme="dark" position="top-center" richColors visibleToasts={3} toastOptions={{ duration: 2800 }} />
      <div className={cn(styles.shell, gameFont.variable, table && "games-shell-table")}>
        <GamesTopBar compact={table} name={signedIn ? name : null} onRename={() => setRenaming(true)} />
        {/* The bar is taller on phones (finger-sized buttons): keep the table exactly one screen tall. */}
        <div className={cn(styles.body, table && ["games-table", styles.tableBody])}>{body}</div>
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
    <header className={cn(styles.topbar, compact && styles.compact)}>
      <nav className={styles.nav} aria-label="Điều hướng game">
        <Link href="/" className={styles.brand} aria-label="Games — tất cả game" aria-current={!active ? "page" : undefined}>
          <PixelIcon name="controller" /><span>Games</span>
        </Link>
        <ul className={styles.links}>
          {ONLINE_GAMES.map(g => <li key={g.id}><Link href={g.href} title={g.title} aria-label={g.title} aria-current={active?.id === g.id ? "page" : undefined}><PixelIcon name={g.id} /><span>{g.short}</span></Link></li>)}
        </ul>
        {compact && <div id={GAME_HEADER_SLOT_ID} className={styles.headerSlot} />}
        <FullscreenButton />
        {name && <button type="button" onClick={onRename} aria-label={`Tài khoản của ${name}`} className={styles.account}><PlayerAvatar name={name} profile={profile} className={styles.avatar} /><span>{name}</span><span aria-hidden>▾</span></button>}
      </nav>
    </header>
  );
}

function GamesFooter() {
  return <footer className={styles.footer}><div><p><strong>Games</strong> / Chơi cùng nhau, ngay trên trình duyệt.</p><Link href="/">Tất cả game</Link><span>© {new Date().getFullYear()} ThachHuynh</span></div></footer>;
}
