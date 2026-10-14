"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

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
    <div className="flex min-w-0 flex-1 items-center gap-1 text-xs sm:gap-1.5">
      {primary}
      {extra && (
        <>
          <span className="hidden items-center gap-1.5 sm:flex">{extra}</span>
          <MoreMenu>{extra}</MoreMenu>
        </>
      )}
      {status && <span className="ml-auto flex min-w-0 items-center gap-2 text-white/70">{status}</span>}
    </div>
  );
  return slot ? createPortal(content, slot) : <div className="flex shrink-0 items-center px-3 pt-2">{content}</div>;
}

function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Thêm"
        className="grid h-7 min-w-8 place-items-center rounded-md border border-white/20 px-2 text-sm leading-5 hover:bg-white/10 max-sm:h-9 max-sm:min-w-9"
      >
        ⋯
      </button>
      {open && (
        // Buttons inside close the menu once used.
        <div
          onClick={() => setOpen(false)}
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[11rem] flex-col items-stretch gap-1 rounded-xl border border-white/15 bg-[#14100c]/95 p-1.5 text-sm shadow-2xl backdrop-blur [&>*]:min-h-9 [&>*]:justify-start [&>*]:py-1.5 [&>*]:text-left"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Text of an `extra` header button: shown in the phone "⋯" menu and on wide screens, hidden in
 * between (sm–lg) where the bar only has room for the button's icon (keep a `title` on the button).
 */
export function HeaderLabel({ children }: { children: React.ReactNode }) {
  return <span className="hidden max-sm:inline lg:inline">{children}</span>;
}

/** Standard look for a header button (use for links too via className). */
/** Phones (portrait `max-sm`, sideways `short`) get finger-sized targets; the bar grows to fit. */
export const headerBtn =
  "flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-white/20 px-2 py-0.5 leading-5 hover:bg-white/10 max-sm:min-h-9 max-sm:min-w-9 max-sm:px-2.5 short:min-h-9 short:min-w-9";

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
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white max-sm:size-9 short:size-9", className)}
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
