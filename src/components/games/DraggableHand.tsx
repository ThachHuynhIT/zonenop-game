"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Let a player arrange their own hand. The custom order only lives in this browser
 * (sessionStorage per room), so it never touches the game server.
 *
 * `defaultOrder` is used until the player drags a card; after that new cards are appended
 * at the end and cards that left the hand drop out. `reset()` goes back to the default.
 */
export function useHandOrder<K extends string | number>(defaultOrder: K[], storageKey: string | null) {
  const [custom, setCustom] = useState<K[] | null>(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as K[]) : null;
    } catch {
      return null;
    }
  });

  const save = useCallback(
    (next: K[] | null) => {
      setCustom(next);
      if (!storageKey) return;
      try {
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
      } catch {
        // Private mode / storage full: the order just won't survive a reload.
      }
    },
    [storageKey],
  );

  const inHand = new Set(defaultOrder);
  const ordered = custom ? [...custom.filter((k) => inHand.has(k)), ...defaultOrder.filter((k) => !custom.includes(k))] : defaultOrder;

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = ordered.slice();
    const [k] = next.splice(from, 1);
    next.splice(to, 0, k);
    save(next);
  };

  /** Replace the whole order (e.g. after moving a stack of identical cards). */
  const setOrder = (next: K[]) => save(next);

  return { ordered, isCustom: !!custom, move, setOrder, reset: () => save(null) };
}

const DRAG_THRESHOLD = 8;

/**
 * A row of cards the player can drag sideways to reorder. A short tap still reaches the
 * card's own onClick (selecting it); only a real drag moves it.
 */
export function DraggableRow<K extends string | number>({
  items,
  onMove,
  renderItem,
  itemStyle,
  disabled,
  className,
}: {
  items: K[];
  onMove: (from: number, to: number) => void;
  renderItem: (key: K, index: number) => React.ReactNode;
  /** Extra per-item style (e.g. negative margins for overlapping cards). */
  itemStyle?: (index: number) => React.CSSProperties | undefined;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ index: number; startX: number; startY: number; centers: { x: number; y: number }[]; active: boolean; pointer: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState<{ index: number; dx: number; dy: number; target: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    refs.current = refs.current.slice(0, items.length);
  }, [items.length]);

  /** The card whose centre is nearest the pointer is where the dragged card lands (works for wrapped rows too). */
  const targetFor = (x: number, y: number, centers: { x: number; y: number }[]) => {
    let best = 0;
    let bestD = Infinity;
    centers.forEach((c, i) => {
      const d = (c.x - x) ** 2 + ((c.y - y) * 1.5) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const centers = refs.current.map((el) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
    });
    drag.current = { index, startX: e.clientX, startY: e.clientY, centers, active: false, pointer: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      // Vertical swipes scroll the page; only a sideways move starts a drag.
      if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setDragging({ index: d.index, dx, dy, target: targetFor(e.clientX, e.clientY, d.centers) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    suppressClick.current = true;
    const target = targetFor(e.clientX, e.clientY, d.centers);
    setDragging(null);
    onMove(d.index, target);
  };

  return (
    <div
      className={cn("flex touch-pan-y select-none", className)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(null);
      }}
      // A drag ends with a click on the card underneath — swallow it.
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {items.map((k, i) => {
        const isDragged = dragging?.index === i;
        const isTarget = !!dragging && !isDragged && dragging.target === i;
        return (
          <div
            key={k}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onPointerDown={onPointerDown(i)}
            style={{
              ...itemStyle?.(i),
              transform: isDragged
                ? `translate(${dragging!.dx}px, ${dragging!.dy - 12}px) rotate(${Math.max(-8, Math.min(8, dragging!.dx / 20))}deg)`
                : isTarget
                  ? `translateX(${dragging!.index < i ? -14 : 14}px)`
                  : undefined,
              zIndex: isDragged ? 50 : undefined,
              transition: isDragged ? "none" : "transform 150ms ease",
              cursor: disabled ? undefined : isDragged ? "grabbing" : "grab",
            }}
            className="relative"
          >
            {isTarget && (
              <span
                className={cn("pointer-events-none absolute inset-y-1 z-40 w-1 rounded-full bg-amber-300 shadow-[0_0_8px_#fbbf24]", dragging!.index < i ? "-right-1" : "-left-1")}
              />
            )}
            {renderItem(k, i)}
          </div>
        );
      })}
    </div>
  );
}
