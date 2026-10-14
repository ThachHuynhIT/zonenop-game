"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
import { type ActionsPlacement, type TyPhuPrefs } from "./prefs";

const CHOICES: { value: ActionsPlacement; label: string; hint: string }[] = [
  { value: "center", label: "Nút ở giữa bàn", hint: "Nút nằm ngay trong khung giữa bàn cờ." },
  { value: "bottom", label: "Thanh nút dưới màn hình", hint: "Nút dính ở đáy màn hình, bàn cờ gọn hơn." },
];

/** The small ⚙ in the table header: this viewer's display options (saved on this device only). */
export function TableOptions({ prefs, onChange }: { prefs: TyPhuPrefs; onChange: (next: TyPhuPrefs) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GameButton variant="ghost" size="sm" aria-label="Tuỳ chọn hiển thị" onClick={() => setOpen(true)} className="size-9 px-0 text-base">
        ⚙
      </GameButton>
      <GameDialog
        open={open}
        onOpenChange={setOpen}
        title="Tuỳ chọn hiển thị"
        description="Chỉ áp dụng cho bạn, trên máy này."
        footer={
          <GameButton size="sm" onClick={() => setOpen(false)}>
            Xong
          </GameButton>
        }
      >
        <div role="radiogroup" aria-label="Vị trí nút" className="flex flex-col gap-2">
          {CHOICES.map((c) => {
            const on = prefs.actions === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...prefs, actions: c.value })}
                className={cn(
                  "flex min-h-12 flex-col items-start rounded-xl px-4 py-2 text-left outline-none ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-white/70",
                  on ? "bg-game-accent/20 ring-game-accent" : "bg-white/5 ring-white/15 hover:bg-white/10",
                )}
              >
                <span className="font-heading font-extrabold">
                  {on ? "● " : "○ "}
                  {c.label}
                </span>
                <span className="text-xs text-white/70">{c.hint}</span>
              </button>
            );
          })}
        </div>
      </GameDialog>
    </>
  );
}
