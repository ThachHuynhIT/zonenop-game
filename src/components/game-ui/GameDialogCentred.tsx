"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { dialogClasses, type GameDialogProps } from "./dialogShared";
import { useGameTheme } from "./theme";

/** Desktop/tablet variant of `GameDialog`: a centred dialog (Base UI). Loaded on first open, see GameDialog.tsx. */
export default function GameDialogCentred({ open, onOpenChange, title, description, footer, light, hideTitle, children }: GameDialogProps) {
  const game = useGameTheme() ?? "hub";
  const c = dialogClasses(light, hideTitle);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-game={game}
          className={cn(
            c.surface,
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-game-card outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <div className="px-6 pt-5">
            <Dialog.Title className={c.title}>{title}</Dialog.Title>
            {description && <Dialog.Description className={cn("mt-1 text-sm", c.muted)}>{description}</Dialog.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className={cn("flex flex-wrap justify-end gap-2 border-t px-6 py-3", c.rule)}>{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
