"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A button that asks "sure?" on the first tap and acts on the second (resets after 3.5 s).
 * Used instead of window.confirm, which some in-app browsers (Zalo, Facebook…) and fullscreen block.
 * `as="span"` renders a span with role="button" for places already inside a <button>.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Chắc chắn?",
  onConfirm,
  disabled,
  title,
  className,
  as = "button",
}: {
  children: React.ReactNode;
  confirmLabel?: React.ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  as?: "button" | "span";
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  const onClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (armed) {
      setArmed(false);
      onConfirm();
    } else setArmed(true);
  };
  const cls = cn(className, armed && "animate-pulse ring-2 ring-rose-400");
  const label = armed ? confirmLabel : children;
  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        title={title}
        onClick={onClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(e)}
        className={cls}
      >
        {label}
      </span>
    );
  }
  return (
    <button type="button" disabled={disabled} title={title} onClick={onClick} className={cls}>
      {label}
    </button>
  );
}
