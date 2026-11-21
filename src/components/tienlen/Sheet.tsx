"use client";

import { cn } from "@/lib/utils";
import { LegacyDialog } from "@/components/game-ui";

/** Keep the table sheets' fixed header and independently scrolling body. */
export function Sheet({ title, label, onClose, children, className, bodyClassName, bodyRef }: {
  title: React.ReactNode;
  label?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
}) {
  return <LegacyDialog title={title} label={label} onClose={onClose} className={cn("max-w-md", className)} bodyClassName={bodyClassName} bodyRef={bodyRef}>{children}</LegacyDialog>;
}
