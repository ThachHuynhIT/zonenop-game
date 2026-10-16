"use client";

import { lazy, Suspense, useState } from "react";
import { useIsMobile } from "./useIsMobile";
import type { GameDialogProps } from "./dialogShared";

// The primitives (vaul, Base UI dialog) are heavy: fetch them when a dialog is first opened, not with the page.
const DrawerImpl = lazy(() => import("./GameDialogDrawer"));
const CentredImpl = lazy(() => import("./GameDialogCentred"));

/**
 * Rules, settings and confirmations: a centred dialog from `md` up, a bottom drawer on phones.
 * The popup is portalled out of `.game-shell`, so it carries the page's `data-game` itself.
 */
export function GameDialog(props: GameDialogProps) {
  const mobile = useIsMobile();
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true); // latch: keeps the exit animation after the first open
  if (!used) return null;
  const Impl = mobile ? DrawerImpl : CentredImpl;
  return (
    <Suspense fallback={null}>
      <Impl {...props} />
    </Suspense>
  );
}
