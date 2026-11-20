"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "./GameHeader.module.scss";

/** Id of the element in the games top bar that a table's header is moved into. */
export const GAME_HEADER_SLOT_ID = "games-header-slot";

/**
 * A table's own header (← Sảnh, room code, invite link, scores, rules…) shown inside the games
 * top bar instead of taking a row of its own. `primary` is always visible; `extra` sits inline
 * from `sm` up and folds into a "⋯" menu on phones. Without the top bar it renders in place.
 */
export function GameHeader({ primary, extra, status }: { primary: React.ReactNode; extra?: React.ReactNode; status?: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(GAME_HEADER_SLOT_ID)), []);

  const content = (
    <div className={styles.header}>
      {primary}
      {extra && (
        <>
          <span className={styles.extra}>{extra}</span>
          <MoreMenu>{extra}</MoreMenu>
        </>
      )}
      {status && <span className={styles.status}>{status}</span>}
    </div>
  );
  return slot ? createPortal(content, slot) : <div className={styles.fallback}>{content}</div>;
}

function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    // This is a disclosure of ordinary controls, so retain their native keyboard behavior.
    popup.current?.querySelector<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]')?.focus();
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={ref} className={styles.more} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button ref={trigger} type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={id} aria-label="Thêm thao tác bàn chơi" className={styles.moreButton}>⋯</button>
      {open && <div id={id} ref={popup} role="group" aria-label="Thao tác bàn chơi" onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button,a')) return;
        setOpen(false);
        // Dialog actions handle their own focus on mount; ordinary actions return here.
        trigger.current?.focus();
      }} className={styles.popup}>{children}</div>}
    </div>
  );
}

/**
 * Text of an `extra` header button: shown in the phone "⋯" menu and on wide screens, hidden in
 * between (sm–lg) where the bar only has room for the button's icon (keep a `title` on the button).
 */
export function HeaderLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.label}>{children}</span>;
}

/** Standard look for a header button (use for links too via className). */
/** Phones (portrait `max-sm`, sideways `short`) get finger-sized targets; the bar grows to fit. */
export const headerBtn = styles.button;

/** Toggle browser fullscreen; hidden where the browser can't (iPhone Safari). */
export function FullscreenButton({ className }: { className?: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setSupported(!!document.fullscreenEnabled);
    const sync = () => setOn(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!supported) return null;
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? "Thoát toàn màn hình" : "Toàn màn hình"}
      aria-label={on ? "Thoát toàn màn hình" : "Toàn màn hình"}
      aria-pressed={on}
      className={cn(styles.fullscreen, className)}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {on ? (
          <path d="M9 3v4a2 2 0 0 1-2 2H3M21 9h-4a2 2 0 0 1-2-2V3M3 15h4a2 2 0 0 1 2 2v4M15 21v-4a2 2 0 0 1 2-2h4" />
        ) : (
          <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
        )}
      </svg>
    </button>
  );
}
