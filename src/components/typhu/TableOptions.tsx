"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
import { type ActionsPlacement, type FxPrefs, type TyPhuPrefs, type ViewMode } from "./prefs";
import styles from "./TableOptions.module.scss";

interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const VIEWS: Choice<ViewMode>[] = [
  { value: "full", label: "Đầy đủ", hint: "Hiện tên ô trên bàn cờ và bảng người chơi với tiền, đất, nhà." },
  { value: "minimal", label: "Tối giản", hint: "Chỉ bàn cờ và hàng người chơi; chạm vào ai để xem chi tiết." },
];

const PLACEMENTS: Choice<ActionsPlacement>[] = [
  { value: "center", label: "Nút ở giữa bàn", hint: "Nút nằm ngay trong khung giữa bàn cờ." },
  { value: "bottom", label: "Thanh nút dưới màn hình", hint: "Nút dính ở đáy màn hình, bàn cờ gọn hơn." },
];

function RadioGroup<T extends string>({ label, choices, value, onPick }: { label: string; choices: Choice<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
      {choices.map((c) => {
        const on = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(c.value)}
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
  );
}

const EFFECTS: { key: keyof FxPrefs; label: string; hint: string }[] = [
  { key: "money", label: "Tiền bay", hint: "Đồng xu bay giữa người chơi, số tiền +/− nổi lên." },
  { key: "turn", label: "Báo lượt", hint: "Dải chữ ngang màn hình khi đổi lượt." },
  { key: "flag", label: "Cắm cờ & rung ô", hint: "Cờ cắm xuống ô vừa mua, ô rung nhẹ." },
  { key: "end", label: "Phá sản & chiến thắng", hint: "Hiệu ứng PHÁ SẢN!, kèn, cờ và pháo hoa khi thắng." },
];

/** One on/off switch per table effect. */
function EffectSwitches({ fx, onChange }: { fx: FxPrefs; onChange: (next: FxPrefs) => void }) {
  return (
    <div className={styles.group} role="group" aria-labelledby="typhu-fx-label">
      <p id="typhu-fx-label" className={styles.legend}>
        Hiệu ứng
      </p>
      {EFFECTS.map((e) => {
        const on = fx[e.key];
        const hintId = `typhu-fx-${e.key}`;
        return (
          <button
            key={e.key}
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={e.label}
            aria-describedby={hintId}
            onClick={() => onChange({ ...fx, [e.key]: !on })}
            className={styles.row}
          >
            <span className={styles.text}>
              <span className={styles.label}>{e.label}</span>
              <span id={hintId} className={styles.hint}>
                {e.hint}
              </span>
            </span>
            <span aria-hidden className={cn(styles.track, on && styles.on)}>
              <span className={styles.thumb} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The small ⚙ in the table header: this viewer's options (saved on this device only). Effects on every screen;
 * the layout choices (Giao diện, Vị trí nút) only matter on a phone held upright, so only show there.
 */
export function TableOptions({ prefs, onChange, phonePortrait }: { prefs: TyPhuPrefs; onChange: (next: TyPhuPrefs) => void; phonePortrait: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GameButton variant="ghost" size="sm" aria-label="Tuỳ chọn hiển thị và hiệu ứng" onClick={() => setOpen(true)} className="size-9 px-0 text-base">
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
        <div className="flex flex-col gap-4">
          {phonePortrait && (
            <>
              <RadioGroup label="Giao diện" choices={VIEWS} value={prefs.view} onPick={(view) => onChange({ ...prefs, view })} />
              <RadioGroup label="Vị trí nút" choices={PLACEMENTS} value={prefs.actions} onPick={(actions) => onChange({ ...prefs, actions })} />
            </>
          )}
          <EffectSwitches fx={prefs.fx} onChange={(fx) => onChange({ ...prefs, fx })} />
        </div>
      </GameDialog>
    </>
  );
}
