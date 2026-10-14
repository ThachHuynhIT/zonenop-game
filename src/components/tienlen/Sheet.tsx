"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Dialog used by the Tiến Lên and Mèo Nổ tables: a bottom sheet on phones (fixed ✕ plus a
 * thumb-height "Đóng" bar), a centred card from `sm` up. Esc and a tap on the backdrop close it.
 * The body scrolls by default; pass `bodyClassName` to lay it out yourself (e.g. a fixed top part
 * with its own scrolling list below).
 */
export function Sheet({
  title,
  label,
  onClose,
  children,
  className,
  bodyClassName,
  bodyRef,
}: {
  title: React.ReactNode;
  /** Accessible name when `title` isn't plain text. */
  label?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Panel colours / width, e.g. `max-w-lg bg-[#0b2a1c] text-emerald-50 border-emerald-200/15`. */
  className?: string;
  bodyClassName?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={label ?? (typeof title === "string" ? title : undefined)}
        className={cn(
          "relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 py-2 pl-4 pr-2 sm:py-2.5 sm:pl-5">
          <h2 className="min-w-0 text-base font-black text-amber-300 sm:text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg leading-none text-white/80 hover:bg-white/20 hover:text-white"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
        <div ref={bodyRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", bodyClassName)}>
          {children}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 border-t border-white/10 bg-black/25 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold text-white/85 sm:hidden"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
