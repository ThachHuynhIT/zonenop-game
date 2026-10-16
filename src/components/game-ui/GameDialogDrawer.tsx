"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { dialogClasses, type GameDialogProps } from "./dialogShared";
import { useGameTheme } from "./theme";

/** Phone variant of `GameDialog`: a bottom drawer (vaul). Loaded on first open, see GameDialog.tsx. */
export default function GameDialogDrawer({ open, onOpenChange, title, description, footer, light, hideTitle, children }: GameDialogProps) {
  const game = useGameTheme() ?? "hub";
  const c = dialogClasses(light, hideTitle);
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          data-game={game}
          className={cn(c.surface, "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-game-card pb-[env(safe-area-inset-bottom)] outline-none")}
        >
          <div aria-hidden className={cn("mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full", light ? "bg-emerald-900/25" : "bg-white/25")} />
          <div className="px-5 pt-3">
            <Drawer.Title className={c.title}>{title}</Drawer.Title>
            {description && <Drawer.Description className={cn("mt-1 text-sm", c.muted)}>{description}</Drawer.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className={cn("flex flex-wrap justify-end gap-2 border-t px-5 py-3", c.rule)}>{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
