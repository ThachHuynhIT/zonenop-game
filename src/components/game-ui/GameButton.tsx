"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CONFIRM_RESET_MS, confirmStep } from "./logic";

export const gameButtonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-heading font-extrabold tracking-tight outline-none transition-[transform,box-shadow,background-color] duration-75 focus-visible:ring-3 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "game-raised bg-game-accent text-game-accent-fg active:not-disabled:game-pressed",
        secondary:
          "game-raised bg-white/12 text-white ring-1 ring-inset ring-white/15 [--game-raise-color:oklch(0_0_0/0.45)] hover:bg-white/18 active:not-disabled:game-pressed",
        danger: "game-raised bg-rose-500 text-white [--game-raise-color:var(--color-rose-800)] active:not-disabled:game-pressed",
        ghost: "bg-transparent text-white/80 hover:bg-white/10 hover:text-white active:not-disabled:scale-95",
      },
      size: {
        sm: "h-9 min-w-9 px-3 text-sm",
        md: "h-11 min-w-11 px-5 text-base",
        lg: "h-14 min-w-14 px-7 text-lg",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type GameButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof gameButtonVariants> & {
    className?: string;
    /** A highlight sweeps across (primary only). */
    shine?: boolean;
    /** Shows a spinner and blocks presses. */
    loading?: boolean;
    /**
     * Two-press confirm (replaces window.confirm, which in-app browsers block): the first press shows this label,
     * the second within 3.5 s runs `onClick`.
     */
    confirm?: React.ReactNode;
  };

/** The game's chunky button: sits on a darker base and sinks into it when pressed. */
export function GameButton({ variant, size, className, shine, loading, confirm, onClick, disabled, children, ...props }: GameButtonProps) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const handleClick: ButtonPrimitive.Props["onClick"] = (event) => {
    if (confirm === undefined) return onClick?.(event);
    event.stopPropagation();
    const step = confirmStep(armed);
    setArmed(step.armed);
    if (step.fire) onClick?.(event);
  };

  return (
    <ButtonPrimitive
      data-slot="game-button"
      data-armed={armed || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(gameButtonVariants({ variant, size }), armed && "ring-3 ring-rose-300 motion-safe:animate-pulse", className)}
      onClick={handleClick}
      {...props}
    >
      {shine && variant === "primary" && <span aria-hidden className="game-shine" />}
      {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {armed ? confirm : children}
    </ButtonPrimitive>
  );
}
