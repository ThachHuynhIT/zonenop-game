# Game UI foundation — PR 1 (token + `game-ui` + `/ui-kit`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bộ token "casual mobile game" và thư mục component `src/components/game-ui/` cùng trang xem trước
`/ui-kit` (chỉ chạy ở dev), **không đổi UI đang chạy**.

**Architecture:** Token là biến CSS trong `globals.css`, màu nhấn đổi theo thuộc tính `data-game` (đặt bởi
`GameThemeScope`). Component bọc primitive của Base UI (`@base-ui/react/{button,dialog,tabs}`) và `vaul` (Drawer), style
bằng Tailwind 4 + `cva`, chuyển động bằng `motion` (`m`, vì app chạy `LazyMotion strict`). Logic thuần nằm riêng trong
`logic.ts` để test bằng vitest (môi trường node).

**Tech Stack:** Next 16, React 19, Tailwind 4, `@base-ui/react` 1.7, `vaul` 1.1.2 (mới), `motion` 13, `@number-flow/react`,
`canvas-confetti`, `sonner`, `class-variance-authority`, vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-14-game-ui-foundation-design.md`

## Global Constraints

- Làm trên nhánh mới từ `develop`: `feature/game-ui-foundation`; PR vào `develop`.
- Không sửa file nào trong `src/components/{games,tienlen,meono,typhu,splendor,bang,oanquan,cangua,game}/` và
  `src/app/*/layout.tsx` ở PR này (đó là PR 2).
- Chuyển động: import `{ m, AnimatePresence } from "motion/react"` (KHÔNG dùng `motion.div` — root layout bật
  `LazyMotion strict`, `motion.*` sẽ ném lỗi).
- Trong `.game-shell`, mọi phần tử có `border-color: currentColor` (rule trong `globals.css`) → component phải ghi màu
  viền tường minh (`border-white/10`…), không dựa vào `border-border`.
- Rule reduced-motion toàn cục **bỏ qua** `.game-shell`: mọi animation CSS mới phải tự có
  `@media (prefers-reduced-motion: reduce)`; component `m.*` đã được `MotionConfig reducedMotion="user"` xử lý.
- Màu nhấn (oklch) đúng bảng spec 3.1: hub `oklch(0.70 0.20 300)`, tienlen `oklch(0.72 0.17 160)`, meono
  `oklch(0.74 0.18 55)`, typhu `oklch(0.80 0.16 85)`, splendor `oklch(0.66 0.20 295)`, bang `oklch(0.64 0.17 35)`, oanquan
  `oklch(0.68 0.10 70)`, cangua `oklch(0.68 0.16 245)`. Chữ trên nền nhấn: `--game-accent-fg: oklch(0.2 0.02 270)`.
  Tương phản accent/fg ≥ 4.5:1.
- `--game-depth: 4px` (3px dưới `sm`), bo thẻ `--radius-game-card: 1.25rem`, nút `rounded-full`.
- Vùng chạm: `GameButton` size `md` = 44 px, `lg` = 56 px.
- Chữ giao diện tiếng Việt; comment/code tiếng Anh như phần còn lại của repo.
- Trước mỗi commit: `npm run lint && npm run typecheck && npm test`.
- Commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Điều chỉnh so với spec (cần người dùng biết khi duyệt)

1. **Không `npx shadcn add`**: dùng thẳng primitive Base UI (`dialog`, `tabs`, `button` đã có trong `node_modules`) và
   `vaul` cho Drawer. Các component shadcn trong danh sách spec (tooltip, popover, badge, avatar, progress, scroll-area)
   chưa có nơi dùng ở PR 1 → không thêm (YAGNI); thêm khi PR sau cần.
2. **Nhấn nút bằng CSS** (`translateY` + đổi bóng, 75 ms) thay vì spring của `motion`, để giữ primitive `Button` của
   Base UI. Spring `pop`/`win` vẫn dùng `motion`.
3. **Chế độ sáng**: mọi route game có nền tối cứng trong layout (`bg-[radial-gradient(...)] text-white`), nên `game-ui`
   thiết kế cho nền tối; `/ui-kit` không có nút sáng/tối. Spec 3.5 và mục C ("sáng/tối") được thu hẹp lại cho đúng thực tế.
4. **Hiệu ứng tự viết** (CSS `@property` + `conic-gradient`, `::after` trượt) theo ý tưởng border-beam/shine của Magic
   UI — không copy mã nguồn, nên không cần ghi license.
5. **Dialog/Drawer render qua portal ra ngoài `.game-shell`** → mất `data-game`. `GameDialog` gắn lại `data-game` (lấy từ
   `useGameTheme()`) lên popup.
6. **Kế hoạch PR 2 (lớp dùng chung) viết riêng** sau khi PR 1 merge và người dùng xem `/ui-kit`.

## Review Focus

1. **Dialog mở trên trang game mất màu nhấn/viền** (portal ra `body`) → popup phải có `data-game` của trang. Kiểm ở Task 7
   (script đọc `--game-accent` trên popup).
2. **Nút xác nhận 2 lần**: bấm lần 2 sau khi hết 3.5 s phải chỉ "arm" lại, không chạy hành động; bấm khi `disabled`
   không làm gì. Kiểm ở Task 1 (`confirmStep`) và Task 6 Step 3 (chờ 4 s rồi bấm).
3. **Đếm ngược với dữ liệu xấu**: `deadline` đã qua, `total` = 0, `deadline` = `NaN` → không âm, không `NaN`, hiện 0 và
   `urgent`. Kiểm ở Task 1.
4. **Màu nhấn thiếu tương phản** trên từng game → `/ui-kit` hiện tỉ lệ, script Task 7 fail nếu < 4.5. Hàm tính ở Task 1.
5. **Tên dài / điện thoại 375 px**: `SeatChip` với tên 24 ký tự không làm tràn ngang; `prefers-reduced-motion` tắt
   beam/shine. Kiểm ở Task 7.

---

### Task 1: Logic thuần (`logic.ts`)

**Files:**
- Create: `src/components/game-ui/logic.ts`
- Test: `src/components/game-ui/logic.test.ts`

**Interfaces:**
- Produces:
  - `CONFIRM_RESET_MS = 3500`
  - `confirmStep(armed: boolean): { fire: boolean; armed: boolean }`
  - `URGENT_FRACTION = 0.25`
  - `countdownState(deadline: number, total: number, now: number): { remainingMs: number; fraction: number; urgent: boolean }`
  - `contrastRatio(a: [number, number, number], b: [number, number, number]): number` (sRGB 0–255, WCAG 2.x)

- [ ] **Step 1: Tạo nhánh**

```bash
cd D:/WorkSpace/zonenop-game
git switch develop && git pull --ff-only
git switch -c feature/game-ui-foundation
```

- [ ] **Step 2: Viết test (fail)** — `src/components/game-ui/logic.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { CONFIRM_RESET_MS, URGENT_FRACTION, confirmStep, contrastRatio, countdownState } from "./logic";

describe("confirmStep", () => {
  it("arms on the first press without firing", () => {
    expect(confirmStep(false)).toEqual({ fire: false, armed: true });
  });
  it("fires and disarms on the second press", () => {
    expect(confirmStep(true)).toEqual({ fire: true, armed: false });
  });
  it("resets after 3.5 s", () => {
    expect(CONFIRM_RESET_MS).toBe(3500);
  });
});

describe("countdownState", () => {
  const T = 1_000_000;
  it("reports the remaining share of the turn", () => {
    expect(countdownState(T + 15_000, 30_000, T)).toEqual({ remainingMs: 15_000, fraction: 0.5, urgent: false });
  });
  it("is urgent from a quarter left", () => {
    expect(countdownState(T + 7_500, 30_000, T).urgent).toBe(true);
    expect(URGENT_FRACTION).toBe(0.25);
  });
  it("never goes below zero once the deadline passed", () => {
    expect(countdownState(T - 5_000, 30_000, T)).toEqual({ remainingMs: 0, fraction: 0, urgent: true });
  });
  it("caps the fraction at 1 when the deadline is further than the total", () => {
    expect(countdownState(T + 60_000, 30_000, T).fraction).toBe(1);
  });
  it("treats a zero total or a NaN deadline as expired", () => {
    expect(countdownState(T + 5_000, 0, T)).toEqual({ remainingMs: 5_000, fraction: 0, urgent: true });
    expect(countdownState(Number.NaN, 30_000, T)).toEqual({ remainingMs: 0, fraction: 0, urgent: true });
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and symmetric", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
  });
  it("is 1 for identical colours", () => {
    expect(contrastRatio([120, 40, 200], [120, 40, 200])).toBe(1);
  });
  it("matches a known pair (#777 on white ≈ 4.48)", () => {
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 2);
  });
});
```

- [ ] **Step 3: Chạy để thấy fail**

Run: `npx vitest run src/components/game-ui/logic.test.ts`
Expected: FAIL — `Failed to resolve import "./logic"`.

- [ ] **Step 4: Viết `logic.ts`**

```ts
/** Pure helpers behind the game-ui components (tested in node, no DOM). */

/** A confirm button disarms itself after this long without the second press. */
export const CONFIRM_RESET_MS = 3500;

/** Two-press confirm: the first press arms, the second fires (and disarms). */
export function confirmStep(armed: boolean): { fire: boolean; armed: boolean } {
  return armed ? { fire: true, armed: false } : { fire: false, armed: true };
}

/** A countdown turns urgent once this share of the turn is left. */
export const URGENT_FRACTION = 0.25;

/** Time left on a turn. Bad input (past or NaN deadline, total ≤ 0) reads as an expired, urgent timer. */
export function countdownState(deadline: number, total: number, now: number) {
  const remainingMs = Number.isFinite(deadline) && Number.isFinite(now) ? Math.max(0, deadline - now) : 0;
  const fraction = total > 0 ? Math.min(1, remainingMs / total) : 0;
  return { remainingMs, fraction, urgent: fraction <= URGENT_FRACTION };
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG 2.x contrast ratio between two sRGB colours (0–255 channels), 1…21. */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 5: Chạy test → PASS**

Run: `npx vitest run src/components/game-ui/logic.test.ts`
Expected: 11 passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/game-ui/logic.ts src/components/game-ui/logic.test.ts
git commit -m "feat(game-ui): pure helpers for confirm buttons, countdowns and contrast"
```

---

### Task 2: Token, hiệu ứng CSS, theme scope, preset chuyển động

**Files:**
- Modify: `src/app/globals.css` (thêm khối mới ở cuối file, và một khối `@theme inline` mới)
- Create: `src/components/game-ui/theme.tsx`
- Create: `src/components/game-ui/motion.ts`

**Interfaces:**
- Produces:
  - CSS vars: `--game-accent`, `--game-accent-strong`, `--game-accent-soft`, `--game-accent-fg`, `--game-depth`,
    `--game-raise-color` (tuỳ chọn, mặc định `--game-accent-strong`).
  - Tailwind: màu `game-accent`, `game-accent-strong`, `game-accent-soft`, `game-accent-fg` (dùng được `bg-`, `text-`,
    `border-`, `stroke-`, `ring-`, kèm `/opacity`), bo `rounded-game-card`, utility `game-raised`, `game-pressed`.
  - Class CSS: `.game-beam` (viền sáng chạy, đặt trong phần tử `relative` có bo góc), `.game-shine` (ánh lên).
  - `type GameId = OnlineGame["id"]`; `GameThemeScope({ game: GameId | null, className?, children })` (div có
    `data-game={game ?? "hub"}` + context); `useGameTheme(): GameId | null`;
    `CONFETTI_COLORS: Record<GameId | "hub", string[]>`.
  - `pop: Variants` (`hidden` → `shown`), `winBanner: Variants`.

- [ ] **Step 1: Thêm token vào cuối `src/app/globals.css`**

```css
/*
 * Game UI tokens (docs/superpowers/specs/2026-10-14-game-ui-foundation-design.md §3). Every element carrying
 * `data-game` (GameThemeScope, and GameDialog's portalled popup) recomputes the derived colours from its own accent.
 */
:where(.game-shell, [data-game]) {
  --game-accent: oklch(0.7 0.2 300);
  --game-accent-strong: color-mix(in oklch, var(--game-accent), black 32%);
  --game-accent-soft: color-mix(in oklch, var(--game-accent) 18%, transparent);
  --game-accent-fg: oklch(0.2 0.02 270);
  --game-depth: 4px;
}
@media (max-width: 639px) {
  :where(.game-shell, [data-game]) {
    --game-depth: 3px;
  }
}
[data-game="tienlen"] { --game-accent: oklch(0.72 0.17 160); }
[data-game="meono"] { --game-accent: oklch(0.74 0.18 55); }
[data-game="typhu"] { --game-accent: oklch(0.8 0.16 85); }
[data-game="splendor"] { --game-accent: oklch(0.66 0.2 295); }
[data-game="bang"] { --game-accent: oklch(0.64 0.17 35); }
[data-game="oanquan"] { --game-accent: oklch(0.68 0.1 70); }
[data-game="cangua"] { --game-accent: oklch(0.68 0.16 245); }

@theme inline {
  --color-game-accent: var(--game-accent);
  --color-game-accent-strong: var(--game-accent-strong);
  --color-game-accent-soft: var(--game-accent-soft);
  --color-game-accent-fg: var(--game-accent-fg);
  --radius-game-card: 1.25rem;
}

/* A chunky "raised" block: a solid darker base under the element plus a soft drop shadow. */
@utility game-raised {
  box-shadow:
    0 var(--game-depth) 0 var(--game-raise-color, var(--game-accent-strong)),
    0 calc(var(--game-depth) + 4px) 12px -4px oklch(0 0 0 / 45%);
}
/* Pressed: sinks onto its base. */
@utility game-pressed {
  transform: translateY(var(--game-depth));
  box-shadow:
    0 0 0 var(--game-raise-color, var(--game-accent-strong)),
    0 2px 6px -2px oklch(0 0 0 / 45%);
}

/* Light running around a rounded element (its parent must be `relative`): marks whose turn it is. */
@property --game-beam-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
.game-beam {
  position: absolute;
  inset: -2px;
  padding: 2px;
  border-radius: inherit;
  pointer-events: none;
  background: conic-gradient(from var(--game-beam-angle), transparent 0 62%, var(--game-accent) 82%, white 90%, transparent 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  animation: game-beam 2.4s linear infinite;
}
@keyframes game-beam {
  to { --game-beam-angle: 360deg; }
}

/* A highlight sweeping across a primary button every few seconds. */
.game-shine {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.game-shine::after {
  content: "";
  position: absolute;
  top: -50%;
  bottom: -50%;
  left: -60%;
  width: 40%;
  transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, oklch(1 0 0 / 35%), transparent);
  animation: game-shine 3.2s ease-in-out infinite;
}
@keyframes game-shine {
  0%, 60% { left: -60%; }
  100% { left: 130%; }
}

/* The global reduced-motion rule skips .game-shell, so these effects stop themselves. */
@media (prefers-reduced-motion: reduce) {
  .game-beam {
    animation: none;
    background: var(--game-accent);
  }
  .game-shine::after {
    animation: none;
    opacity: 0;
  }
}
```

- [ ] **Step 2: Tạo `src/components/game-ui/theme.tsx`**

```tsx
"use client";

import { createContext, useContext } from "react";
import type { OnlineGame } from "@/components/games/gamesRegistry";

export type GameId = OnlineGame["id"];

const GameThemeContext = createContext<GameId | null>(null);

/** The game whose accent colours the current subtree (null = the games hub). */
export const useGameTheme = () => useContext(GameThemeContext);

/**
 * Sets `data-game` (which picks the accent in globals.css) and tells portalled children such as GameDialog which
 * game they belong to.
 */
export function GameThemeScope({ game, className, children }: { game: GameId | null; className?: string; children: React.ReactNode }) {
  return (
    <GameThemeContext.Provider value={game}>
      <div data-game={game ?? "hub"} className={className}>
        {children}
      </div>
    </GameThemeContext.Provider>
  );
}

/** Confetti palettes (canvas-confetti needs hex, not oklch): the game's accent first, then gold and white. */
export const CONFETTI_COLORS: Record<GameId | "hub", string[]> = {
  hub: ["#b57bff", "#8b5cf6", "#fbbf24", "#ffffff"],
  tienlen: ["#34d399", "#10b981", "#fbbf24", "#ffffff"],
  meono: ["#fb923c", "#f97316", "#fde68a", "#ffffff"],
  typhu: ["#facc15", "#eab308", "#fef3c7", "#ffffff"],
  splendor: ["#a78bfa", "#7c3aed", "#f0abfc", "#ffffff"],
  bang: ["#f87171", "#c2410c", "#fbbf24", "#ffffff"],
  oanquan: ["#d6a75c", "#a16207", "#fde68a", "#ffffff"],
  cangua: ["#60a5fa", "#2563eb", "#fbbf24", "#ffffff"],
};
```

- [ ] **Step 3: Tạo `src/components/game-ui/motion.ts`**

```ts
import type { Variants } from "motion/react";

/** Things popping in (badges, chips, toasts). */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  shown: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 24 } },
};

/** The victory banner dropping in. */
export const winBanner: Variants = {
  hidden: { opacity: 0, y: -24, scale: 0.9 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 18 } },
};
```

- [ ] **Step 4: Kiểm tra**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: tất cả pass; `next build` không báo lỗi CSS (`@utility`, `@property`).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/game-ui/theme.tsx src/components/game-ui/motion.ts
git commit -m "feat(game-ui): per-game accent tokens, raised/pressed utilities, beam and shine effects"
```

---

### Task 3: `GameButton`, `GameBadge`, `GamePanel`, `GameAvatar`, `SeatChip`

**Files:**
- Create: `src/components/game-ui/GameButton.tsx`, `GameBadge.tsx`, `GamePanel.tsx`, `GameAvatar.tsx`, `SeatChip.tsx`

**Interfaces:**
- Consumes: `confirmStep`, `CONFIRM_RESET_MS` (Task 1); `pop` (Task 2); utilities `game-raised`, `game-pressed`,
  `.game-shine`, `.game-beam`, màu `game-accent*`, `rounded-game-card` (Task 2); `PlayerProfile` từ
  `@/components/games/gameClient` (type-only).
- Produces:
  - `GameButton(props: Omit<ButtonPrimitive.Props, "className"> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" | "lg"; className?: string; shine?: boolean; loading?: boolean; confirm?: React.ReactNode })`, `gameButtonVariants`
  - `GameBadge({ tone?: "accent" | "success" | "warning" | "danger" | "neutral"; pulse?: boolean; role?: string; className?: string; children })`
  - `GamePanel({ title?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; tone?: "default" | "accent"; className?: string; children })`
  - `GameAvatar({ name: string; profile: PlayerProfile; className?: string })`
  - `SeatChip({ name: string; profile: PlayerProfile; points?: number; online?: boolean; isTurn?: boolean; isHost?: boolean; isYou?: boolean; out?: boolean; size?: "sm" | "md"; className?: string })`

- [ ] **Step 1: `GameButton.tsx`**

```tsx
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
```

- [ ] **Step 2: `GameBadge.tsx`**

```tsx
"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { pop } from "./motion";

const TONES = {
  accent: "bg-game-accent text-game-accent-fg",
  success: "bg-emerald-400 text-emerald-950",
  warning: "bg-amber-300 text-amber-950",
  danger: "bg-rose-500 text-white",
  neutral: "bg-white/12 text-white ring-1 ring-inset ring-white/15",
} as const;

/** Small pill for states (online, playing, player count, "Lượt của bạn"…). */
export function GameBadge({
  tone = "neutral",
  pulse,
  role,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  pulse?: boolean;
  role?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <m.span
      variants={pop}
      initial="hidden"
      animate="shown"
      role={role}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-extrabold",
        TONES[tone],
        pulse && "motion-safe:animate-pulse",
        className,
      )}
    >
      {children}
    </m.span>
  );
}
```

- [ ] **Step 3: `GamePanel.tsx`**

```tsx
import { cn } from "@/lib/utils";

/** A rounded, slightly raised card for lobby lists, scores and settings. */
export function GamePanel({
  title,
  icon,
  actions,
  tone = "default",
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "default" | "accent";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "game-raised rounded-game-card border p-4 [--game-depth:3px] sm:p-5",
        tone === "accent"
          ? "border-game-accent/40 bg-game-accent-soft"
          : "border-white/10 bg-white/[0.06] backdrop-blur [--game-raise-color:oklch(0_0_0/0.4)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-center gap-2">
          {icon && <span aria-hidden className="text-xl">{icon}</span>}
          {title && <h2 className="font-heading text-lg font-extrabold tracking-tight">{title}</h2>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 4: `GameAvatar.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@/components/games/gameClient";

/** Round avatar: the player's icon on their colour, or the name's first letter when no icon is chosen. */
export function GameAvatar({ name, profile, className }: { name: string; profile: PlayerProfile; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-bold text-black ring-2 ring-black/30", className)}
      style={{ backgroundColor: profile.color }}
    >
      {profile.icon || name.charAt(0).toUpperCase()}
    </span>
  );
}
```

- [ ] **Step 5: `SeatChip.tsx`**

```tsx
"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@/components/games/gameClient";
import { GameAvatar } from "./GameAvatar";

/** A player at the table: avatar, name, live points, online dot, host crown, and a running light on their turn. */
export function SeatChip({
  name,
  profile,
  points,
  online = true,
  isTurn,
  isHost,
  isYou,
  out,
  size = "md",
  className,
}: {
  name: string;
  profile: PlayerProfile;
  points?: number;
  online?: boolean;
  isTurn?: boolean;
  isHost?: boolean;
  isYou?: boolean;
  out?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex min-w-0 max-w-full items-center rounded-full border bg-black/35",
        size === "sm" ? "gap-1.5 py-0.5 pl-0.5 pr-2 text-xs" : "gap-2 py-1 pl-1 pr-3 text-sm",
        isTurn ? "border-transparent" : "border-white/10",
        !online && "opacity-60",
        className,
      )}
    >
      {isTurn && <span aria-hidden className="game-beam" />}
      <span className="relative shrink-0">
        <GameAvatar name={name} profile={profile} className={cn(size === "sm" ? "size-6 text-sm" : "size-9 text-lg", out && "grayscale")} />
        <span
          aria-hidden
          className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-black/60", online ? "bg-emerald-400" : "bg-zinc-500")}
        />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1 font-bold leading-tight">
          <span className="truncate">{name}</span>
          {isHost && (
            <span role="img" aria-label="Chủ phòng" className="shrink-0">
              👑
            </span>
          )}
          {isYou && <span className="shrink-0 rounded-full bg-white/15 px-1.5 text-[10px] font-extrabold">Bạn</span>}
        </span>
        {points !== undefined && <NumberFlow value={points} className="block text-xs font-bold tabular-nums text-game-accent" />}
      </span>
      <span className="sr-only">
        {online ? "đang online" : "offline"}
        {isTurn ? ", đang tới lượt" : ""}
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Kiểm tra**

Run: `npm run lint && npm run typecheck && npm test`
Expected: pass. Nếu `ButtonPrimitive.Props["onClick"]` không nhận `event.stopPropagation`, đổi kiểu tham số sang
`React.MouseEvent<HTMLButtonElement>` (Base UI truyền React event chuẩn).

- [ ] **Step 7: Commit**

```bash
git add src/components/game-ui/GameButton.tsx src/components/game-ui/GameBadge.tsx src/components/game-ui/GamePanel.tsx src/components/game-ui/GameAvatar.tsx src/components/game-ui/SeatChip.tsx
git commit -m "feat(game-ui): raised buttons with two-press confirm, badges, panels, avatars and seat chips"
```

---

### Task 4: `GameDialog` (Dialog / Drawer) và `GameTabs`

**Files:**
- Modify: `package.json`, `package-lock.json` (thêm `vaul@1.1.2`)
- Create: `src/components/game-ui/useIsMobile.ts`, `GameDialog.tsx`, `GameTabs.tsx`

**Interfaces:**
- Consumes: `useGameTheme` (Task 2).
- Produces:
  - `useIsMobile(): boolean` (true khi `(max-width: 767px)`; SSR trả `false`)
  - `GameDialog({ open: boolean; onOpenChange: (open: boolean) => void; title: React.ReactNode; description?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode })`
  - `GameTabs({ tabs: { id: string; label: string; content: React.ReactNode }[]; className?: string })`

- [ ] **Step 1: Cài `vaul`**

```bash
npm install vaul@1.1.2
```

Expected: `package.json` có `"vaul": "^1.1.2"`; `npm ls react` không báo peer lỗi.

- [ ] **Step 2: `useIsMobile.ts`**

```ts
"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** Phone-sized viewport (below Tailwind's `md`). False while rendering on the server. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
```

- [ ] **Step 3: `GameDialog.tsx`**

```tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useGameTheme } from "./theme";
import { useIsMobile } from "./useIsMobile";

const SURFACE = "border border-white/10 bg-[oklch(0.2_0.03_290)] text-white game-raised [--game-raise-color:oklch(0_0_0/0.5)]";

/**
 * Rules, settings and confirmations: a centred dialog from `md` up, a bottom drawer on phones.
 * The popup is portalled out of `.game-shell`, so it carries the page's `data-game` itself.
 */
export function GameDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const mobile = useIsMobile();
  const game = useGameTheme() ?? "hub";

  if (mobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Drawer.Content
            data-game={game}
            className={cn(SURFACE, "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-game-card pb-[env(safe-area-inset-bottom)] outline-none")}
          >
            <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/25" />
            <div className="px-5 pt-3">
              <Drawer.Title className="font-heading text-xl font-extrabold tracking-tight">{title}</Drawer.Title>
              {description && <Drawer.Description className="mt-1 text-sm text-white/70">{description}</Drawer.Description>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3">{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-game={game}
          className={cn(
            SURFACE,
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-game-card outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <div className="px-6 pt-5">
            <Dialog.Title className="font-heading text-xl font-extrabold tracking-tight">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-1 text-sm text-white/70">{description}</Dialog.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-6 py-3">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: `GameTabs.tsx`**

```tsx
"use client";

import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export interface GameTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Tabbed box (waiting-room settings…): one group at a time, with an underline sliding to the active tab. */
export function GameTabs({ tabs, className }: { tabs: GameTab[]; className?: string }) {
  return (
    <Tabs.Root defaultValue={tabs[0]?.id} className={cn("overflow-hidden rounded-2xl border border-white/10 bg-white/5", className)}>
      <Tabs.List className="relative flex border-b border-white/10 bg-black/20">
        {tabs.map((t) => (
          <Tabs.Tab
            key={t.id}
            value={t.id}
            className="min-h-11 flex-1 whitespace-nowrap px-2 text-sm font-bold text-white/60 outline-none transition-colors hover:text-white focus-visible:bg-white/10 data-[selected]:text-white"
          >
            {t.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute bottom-0 left-[var(--active-tab-left)] h-1 w-[var(--active-tab-width)] rounded-full bg-game-accent transition-[left,width] duration-200 ease-out" />
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Panel key={t.id} value={t.id} className="p-3 text-sm outline-none">
          {t.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
```

- [ ] **Step 5: Kiểm tra**

Run: `npm run lint && npm run typecheck && npm test`
Expected: pass. Nếu typecheck báo `onOpenChange` của `Drawer.Root` khác kiểu, giữ nguyên chữ ký `(open: boolean) => void`
— vaul 1.1 khai báo `onOpenChange?: (open: boolean) => void`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/game-ui/useIsMobile.ts src/components/game-ui/GameDialog.tsx src/components/game-ui/GameTabs.tsx
git commit -m "feat(game-ui): dialog that becomes a bottom drawer on phones, tabs with a sliding underline"
```

---

### Task 5: `Countdown`, `Celebration`, `gameToast`

**Files:**
- Create: `src/components/game-ui/Countdown.tsx`, `Celebration.tsx`, `toast.ts`, `index.ts`

**Interfaces:**
- Consumes: `countdownState` (Task 1); `winBanner`, `CONFETTI_COLORS`, `useGameTheme` (Task 2).
- Produces:
  - `Countdown({ deadline: number | null; total: number; size?: number; className?: string })`
  - `Celebration({ show: boolean; playing: boolean; won: boolean; title?: string })` — cùng props/hành vi phát một lần như `WinCelebration`
  - `gameToast: { success(msg: string): void; error(msg: string): void; info(msg: string): void }`
  - `src/components/game-ui/index.ts` re-export tất cả component, hook và type công khai.

- [ ] **Step 1: `Countdown.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { countdownState } from "./logic";

/** Turn timer: a ring emptying clockwise around the seconds left, red once a quarter is left. */
export function Countdown({ deadline, total, size = 44, className }: { deadline: number | null; total: number; size?: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;

  const { remainingMs, fraction, urgent } = countdownState(deadline, total, now);
  const secs = Math.ceil(remainingMs / 1000);
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <span role="timer" aria-label={`Còn ${secs} giây`} className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn("transition-[stroke-dashoffset] duration-200 ease-linear", urgent ? "stroke-rose-500" : "stroke-game-accent")}
        />
      </svg>
      <span aria-hidden className={cn("absolute font-heading text-sm font-extrabold tabular-nums", urgent && "text-rose-300 motion-safe:animate-pulse")}>
        {secs}
      </span>
    </span>
  );
}
```

- [ ] **Step 2: `Celebration.tsx`** (logic phát-một-lần giữ nguyên từ `src/components/games/WinCelebration.tsx`)

```tsx
"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { winBanner } from "./motion";
import { CONFETTI_COLORS, useGameTheme } from "./theme";

const DURATION = 4200;

/**
 * Victory effect for every table: confetti in the game's colours + a banner, only on the playing → ended transition
 * this mounted component saw (a reconnect onto a finished game never replays it). Same props as WinCelebration.
 * Pointer-events-none overlay (z-40, below dialogs), ~4 s. prefers-reduced-motion: banner only.
 */
export function Celebration({ show, playing, won, title }: { show: boolean; playing: boolean; won: boolean; title?: string }) {
  const [run, setRun] = useState(0);
  const wasPlaying = useRef(false);
  const wasShow = useRef(false);

  useEffect(() => {
    if (show && !wasShow.current && wasPlaying.current) setRun((r) => r + 1);
    if (playing && !show) wasPlaying.current = true;
    if (!playing && !show) wasPlaying.current = false;
    wasShow.current = show;
  }, [show, playing]);

  if (!run) return null;
  return <Burst key={run} won={won} title={title} />;
}

function Burst({ won, title }: { won: boolean; title?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useGameTheme() ?? "hub";
  const [alive, setAlive] = useState(true);
  const [fading, setFading] = useState(false);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), DURATION - 700);
    const t2 = setTimeout(() => setAlive(false), DURATION);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!won || reduced || !cv) return;
    let stop = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (stop) return;
      const fire = confetti.create(cv, { resize: true, useWorker: false });
      const base = { colors: CONFETTI_COLORS[game], disableForReducedMotion: true, zIndex: 40 };
      fire({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.85 }, startVelocity: 55 });
      fire({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.85 }, startVelocity: 55 });
      fire({ ...base, particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.4 }, scalar: 1.1 });
      for (let i = 0; i < 6; i++) {
        timers.push(
          setTimeout(() => {
            fire({ ...base, particleCount: 50, spread: 360, startVelocity: 28, ticks: 70, gravity: 0.8, scalar: 0.9, origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 } });
          }, 450 + i * 380),
        );
      }
    });
    return () => {
      stop = true;
      timers.forEach(clearTimeout);
    };
  }, [won, reduced, game]);

  if (!alive) return null;
  const text = won ? "🏆 Bạn thắng!" : title;
  return (
    <div aria-hidden data-game={game} className={cn("pointer-events-none fixed inset-0 z-40 overflow-hidden transition-opacity duration-700", fading ? "opacity-0" : "opacity-100")}>
      {won && !reduced && <canvas ref={canvas} className="absolute inset-0 h-full w-full" />}
      {text && (
        <div className={cn("absolute inset-x-0 flex justify-center", won ? "top-[22%]" : "top-16")}>
          <m.div
            variants={winBanner}
            initial="hidden"
            animate="shown"
            className={
              won
                ? "game-raised rounded-game-card border border-white/20 bg-game-accent px-7 py-3 font-heading text-3xl font-extrabold text-game-accent-fg"
                : "rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-sm font-bold text-white"
            }
          >
            {text}
          </m.div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `toast.ts`**

```ts
import { toast } from "sonner";

const base = "!rounded-2xl !border !font-bold";

/** Toasts in the game style (GamesShell already mounts sonner's <Toaster>). */
export const gameToast = {
  success: (msg: string) => toast.success(msg, { className: `${base} !border-emerald-400/40` }),
  error: (msg: string) => toast.error(msg, { className: `${base} !border-rose-400/40` }),
  info: (msg: string) => toast(msg, { className: `${base} !border-white/20` }),
};
```

- [ ] **Step 4: `index.ts`**

```ts
export { GameButton, gameButtonVariants, type GameButtonProps } from "./GameButton";
export { GameBadge } from "./GameBadge";
export { GamePanel } from "./GamePanel";
export { GameAvatar } from "./GameAvatar";
export { SeatChip } from "./SeatChip";
export { GameDialog } from "./GameDialog";
export { GameTabs, type GameTab } from "./GameTabs";
export { Countdown } from "./Countdown";
export { Celebration } from "./Celebration";
export { gameToast } from "./toast";
export { GameThemeScope, useGameTheme, CONFETTI_COLORS, type GameId } from "./theme";
export { useIsMobile } from "./useIsMobile";
export { pop, winBanner } from "./motion";
```

- [ ] **Step 5: Kiểm tra**

Run: `npm run lint && npm run typecheck && npm test`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/game-ui/Countdown.tsx src/components/game-ui/Celebration.tsx src/components/game-ui/toast.ts src/components/game-ui/index.ts
git commit -m "feat(game-ui): ring countdown, victory celebration in the game's colours, styled toasts"
```

---

### Task 6: Trang xem trước `/ui-kit`

**Files:**
- Create: `src/app/ui-kit/page.tsx`, `src/app/ui-kit/UiKit.tsx`

**Interfaces:**
- Consumes: mọi export của `@/components/game-ui` (Task 3–5), `contrastRatio` (Task 1), `ONLINE_GAMES` từ
  `@/components/games/gamesRegistry`, `DEFAULT_PROFILE`/`PROFILE_COLORS` từ `@/components/games/gameClient`.
- Produces: route `/ui-kit` (404 khi `NODE_ENV === "production"`), các `data-testid` dùng ở Task 7:
  `contrast-<game>` (text = tỉ lệ, ví dụ `5.12`), `kit-root`, `open-dialog`, `game-dialog-body`.

- [ ] **Step 1: `src/app/ui-kit/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiKit } from "./UiKit";

export const metadata: Metadata = { title: "Game UI kit", robots: { index: false, follow: false } };

/** Dev-only gallery of the game-ui components (404 in production builds). */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKit />;
}
```

- [ ] **Step 2: `src/app/ui-kit/UiKit.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Celebration, Countdown, GameBadge, GameButton, GameDialog, GamePanel, GameTabs, GameThemeScope, SeatChip, gameToast, type GameId } from "@/components/game-ui";
import { contrastRatio } from "@/components/game-ui/logic";
import { ONLINE_GAMES } from "@/components/games/gamesRegistry";
import { PROFILE_COLORS } from "@/components/games/gameClient";

const GAMES: (GameId | null)[] = [null, ...ONLINE_GAMES.map((g) => g.id)];

/** Resolve any CSS colour (oklch, color-mix…) to sRGB by painting one canvas pixel. */
function toRgb(color: string): [number, number, number] {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function ContrastTable() {
  const [rows, setRows] = useState<{ game: string; ratio: number }[]>([]);
  useEffect(() => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const next = GAMES.map((g) => {
      probe.setAttribute("data-game", g ?? "hub");
      probe.style.color = "var(--game-accent)";
      const accent = getComputedStyle(probe).color;
      probe.style.color = "var(--game-accent-fg)";
      const fg = getComputedStyle(probe).color;
      return { game: g ?? "hub", ratio: contrastRatio(toRgb(accent), toRgb(fg)) };
    });
    probe.remove();
    setRows(next);
  }, []);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <li key={r.game} data-game={r.game} className="rounded-xl bg-game-accent px-3 py-2 text-game-accent-fg">
          <span className="font-bold">{r.game}</span>{" "}
          <span data-testid={`contrast-${r.game}`} className={r.ratio < 4.5 ? "font-extrabold underline" : ""}>
            {r.ratio.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function UiKit() {
  const [game, setGame] = useState<GameId | null>("tienlen");
  const [dialog, setDialog] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [points, setPoints] = useState(12);
  const [celebrate, setCelebrate] = useState({ playing: true, show: false });
  useEffect(() => setDeadline(Date.now() + 20_000), []);

  return (
    <div className="game-shell min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#1e1633_0%,#0a0810_70%)] text-white">
      <GameThemeScope game={game} className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div data-testid="kit-root" className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <GameButton key={g ?? "hub"} size="sm" variant={g === game ? "primary" : "secondary"} onClick={() => setGame(g)}>
              {g ?? "hub"}
            </GameButton>
          ))}
        </div>

        <GamePanel title="Tương phản màu nhấn / chữ (≥ 4.5)" icon="🎨">
          <ContrastTable />
        </GamePanel>

        <GamePanel title="Nút" icon="🔘">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="mb-3 flex flex-wrap items-center gap-3">
              <GameButton size={size} variant="primary" shine>Chơi ngay</GameButton>
              <GameButton size={size}>Mời bạn</GameButton>
              <GameButton size={size} variant="danger" confirm="Chắc chắn?" onClick={() => gameToast.error("Đã rời bàn")}>Rời bàn</GameButton>
              <GameButton size={size} variant="ghost">Luật chơi</GameButton>
              <GameButton size={size} variant="primary" loading>Đang tạo</GameButton>
              <GameButton size={size} disabled>Khoá</GameButton>
            </div>
          ))}
        </GamePanel>

        <GamePanel title="Huy hiệu và ghế" icon="🪑" tone="accent">
          <div className="mb-3 flex flex-wrap gap-2">
            <GameBadge tone="accent">Lượt của bạn</GameBadge>
            <GameBadge tone="success">Online</GameBadge>
            <GameBadge tone="warning" pulse>Sắp hết giờ</GameBadge>
            <GameBadge tone="danger">Phá sản</GameBadge>
            <GameBadge>3/4 người</GameBadge>
          </div>
          <div className="flex flex-wrap gap-3">
            <SeatChip name="Thạch" profile={{ icon: "😼", color: PROFILE_COLORS[0] }} points={points} isTurn isHost isYou />
            <SeatChip name="Lan" profile={{ icon: "", color: PROFILE_COLORS[4] }} points={-3} />
            <SeatChip name="Một cái tên rất dài để thử tràn" profile={{ icon: "🐼", color: PROFILE_COLORS[6] }} points={0} online={false} />
            <SeatChip name="Minh" profile={{ icon: "🦊", color: PROFILE_COLORS[2] }} size="sm" out />
          </div>
          <GameButton className="mt-3" size="sm" onClick={() => setPoints((p) => p + 5)}>+5 điểm</GameButton>
        </GamePanel>

        <GamePanel title="Đếm ngược, tab, hộp thoại" icon="⏱">
          <div className="mb-4 flex items-center gap-4">
            <Countdown deadline={deadline} total={30_000} />
            <Countdown deadline={deadline} total={30_000} size={64} />
            <GameButton size="sm" onClick={() => setDeadline(Date.now() + 30_000)}>Đặt lại 30 s</GameButton>
            <GameButton size="sm" onClick={() => setDeadline(Date.now() + 6_000)}>Còn 6 s</GameButton>
          </div>
          <GameTabs
            className="mb-4"
            tabs={[
              { id: "rules", label: "Luật", content: <p>Đánh bài theo vòng, chặt heo…</p> },
              { id: "points", label: "Điểm", content: <p>Nhất +3, Nhì +1…</p> },
              { id: "other", label: "Khác", content: <p>Tự bỏ lượt khi không đánh được.</p> },
            ]}
          />
          <GameButton data-testid="open-dialog" variant="primary" onClick={() => setDialog(true)}>Mở hộp thoại</GameButton>
          <GameDialog
            open={dialog}
            onOpenChange={setDialog}
            title="Luật chơi"
            description="Trên điện thoại đây là bảng kéo từ dưới lên."
            footer={<GameButton variant="primary" onClick={() => setDialog(false)}>Đã hiểu</GameButton>}
          >
            <div data-testid="game-dialog-body" className="space-y-2">
              {Array.from({ length: 12 }, (_, i) => (
                <p key={i}>Dòng luật số {i + 1}.</p>
              ))}
            </div>
          </GameDialog>
        </GamePanel>

        <GamePanel title="Ăn mừng, thông báo" icon="🏆">
          <div className="flex flex-wrap gap-3">
            <GameButton
              variant="primary"
              onClick={() => {
                setCelebrate({ playing: true, show: false });
                setTimeout(() => setCelebrate({ playing: false, show: true }), 50);
              }}
            >
              Thắng
            </GameButton>
            <GameButton onClick={() => gameToast.success("Đã sao chép link mời")}>Toast</GameButton>
          </div>
          <Celebration playing={celebrate.playing} show={celebrate.show} won title="Ván đã kết thúc" />
        </GamePanel>
      </GameThemeScope>
      {/* /ui-kit is outside GamesShell, which normally mounts the toaster. */}
      <Toaster theme="dark" position="top-center" richColors visibleToasts={3} />
    </div>
  );
}
```

- [ ] **Step 3: Chạy dev và xem**

Run: `npm run dev` rồi mở `http://localhost:3000/ui-kit`.
Expected: trang hiện đủ các khối; bấm từng game đổi màu nhấn; bảng tương phản hiện 8 số; "Rời bàn" bấm lần 1 đổi
thành "Chắc chắn?", lần 2 hiện toast; bấm lần 1, **chờ 4 giây** (nút về lại "Rời bàn"), bấm tiếp → chỉ hiện lại
"Chắc chắn?", không có toast; "Mở hộp thoại" mở dialog giữa màn hình (thu cửa sổ < 768 px → drawer).

- [ ] **Step 4: Kiểm tra build production trả 404**

Run: `npm run build && npx next start -p 3100` rồi `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ui-kit`
Expected: `404`. Dừng server sau khi kiểm.

- [ ] **Step 5: Commit**

```bash
git add src/app/ui-kit
git commit -m "feat(game-ui): dev-only /ui-kit gallery with per-game accents and contrast readout"
```

---

### Task 7: Kiểm tra trên điện thoại / truy cập / hiệu năng, rồi mở PR

**Files:**
- Create (ngoài repo, thư mục tạm): `%TEMP%/shots/ui-kit-check.mjs`
- Modify: `docs/GAMES_GUIDE.md` (thêm mục ngắn "Bộ UI `game-ui`")

**Interfaces:**
- Consumes: `data-testid` của Task 6.

- [ ] **Step 1: Chuẩn bị Playwright** (theo `docs/GAMES_GUIDE.md` §7.2)

```bash
mkdir -p "$TEMP/shots" && cd "$TEMP/shots" && npm init -y >/dev/null && npm i playwright-core
```

- [ ] **Step 2: Viết `ui-kit-check.mjs`**

```js
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge" });
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exitCode = 1;
};

for (const vp of [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: vp.name === "phone" ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`${vp.name} pageerror: ${e.message}`));
  await page.goto(`${BASE}/ui-kit`, { waitUntil: "networkidle" });

  // No horizontal overflow (long seat names, button rows).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) fail(`${vp.name}: page overflows by ${overflow}px`);

  // md/lg buttons are at least 44px tall.
  const small = await page.$$eval('[data-slot="game-button"]', (els) =>
    els.filter((e) => /h-11|h-14/.test(e.className) && e.getBoundingClientRect().height < 44).length,
  );
  if (small) fail(`${vp.name}: ${small} md/lg buttons under 44px`);

  // Accent/text contrast >= 4.5 for every game.
  const ratios = await page.$$eval('[data-testid^="contrast-"]', (els) => els.map((e) => [e.dataset.testid, Number(e.textContent)]));
  for (const [id, r] of ratios) if (!(r >= 4.5)) fail(`${vp.name}: ${id} contrast ${r}`);

  // Reduced motion: the turn beam does not animate.
  if (vp.name === "phone") {
    const running = await page.$$eval(".game-beam", (els) => els.reduce((n, e) => n + e.getAnimations().length, 0));
    if (running) fail(`phone (reduced motion): ${running} beam animations running`);
  }

  await page.screenshot({ path: `ui-kit-${vp.name}.png`, fullPage: true });

  // Dialog: a bottom drawer on phones, a centred dialog elsewhere; carries the page's game accent.
  await page.getByTestId("open-dialog").click();
  const body = page.getByTestId("game-dialog-body");
  await body.waitFor();
  const info = await body.evaluate((el) => {
    const popup = el.closest("[data-game]");
    const r = el.getBoundingClientRect();
    return { game: popup?.getAttribute("data-game"), accent: popup ? getComputedStyle(popup).getPropertyValue("--game-accent").trim() : "", bottomGap: window.innerHeight - r.bottom };
  });
  if (info.game !== "tienlen" || !info.accent) fail(`${vp.name}: dialog lost the game accent (${JSON.stringify(info)})`);
  await page.screenshot({ path: `ui-kit-${vp.name}-dialog.png` });
  await page.keyboard.press("Escape");
  await ctx.close();
}
await browser.close();
console.log(process.exitCode ? "ui-kit check FAILED" : "ui-kit check passed");
```

- [ ] **Step 3: Chạy kiểm tra**

Run (repo): `npm run dev` (giữ chạy). Run (thư mục tạm): `node ui-kit-check.mjs`
Expected: `ui-kit check passed`; 6 ảnh `ui-kit-*.png`. Nếu một màu nhấn < 4.5, tăng L của màu đó trong `globals.css`
(giữ ≥ 0.64), cập nhật bảng trong spec, chạy lại.

- [ ] **Step 4: So kích thước bundle**

Run: `git switch develop && npm run build > "$TEMP/before.txt"; git switch feature/game-ui-foundation && npm run build > "$TEMP/after.txt"` rồi so dòng
"First Load JS" của `/tien-len/[room]` và `/`.
Expected: không đổi (PR 1 chưa import `game-ui` vào route thật). Ghi số vào mô tả PR.

- [ ] **Step 5: Thêm mục vào `docs/GAMES_GUIDE.md`** (cuối phần component dùng chung)

```md
### Bộ UI `game-ui` (`src/components/game-ui/`)

Nền tảng giao diện casual-game dùng chung (spec: `docs/superpowers/specs/2026-10-14-game-ui-foundation-design.md`).
Xem mọi component ở `/ui-kit` khi chạy `npm run dev` (bản production trả 404).

- Màu nhấn theo game: `GameThemeScope game="<id>"` đặt `data-game`; dùng `bg-game-accent`, `text-game-accent-fg`,
  `border-game-accent/40`… Không viết màu cứng cho phần "của game".
- Nút: `GameButton` (`primary` tối đa một nút chính mỗi khu vực; `confirm="Chắc chắn?"` thay `window.confirm`).
- Hộp thoại: `GameDialog` (tự thành drawer trên điện thoại) thay cho modal `fixed inset-0` tự viết.
- Chuyển động: `import { m } from "motion/react"` (app chạy `LazyMotion strict`); animation CSS mới phải tự có
  `@media (prefers-reduced-motion: reduce)` vì rule chung bỏ qua `.game-shell`.
```

- [ ] **Step 6: Lint/typecheck/test, commit, push, mở PR**

```bash
npm run lint && npm run typecheck && npm test
git add docs/GAMES_GUIDE.md
git commit -m "docs: game-ui section in the games guide"
git push -u origin feature/game-ui-foundation
gh pr create -R ThachHuynhIT/zonenop-game --base develop --title "feat(game-ui): casual-game UI foundation and /ui-kit gallery" --body-file -
```

Nội dung PR: tóm tắt các component, link spec + plan, kết quả `ui-kit-check.mjs`, số bundle trước/sau, đính kèm 6 ảnh
chụp (kéo thả vào PR trên GitHub), mục "Điều chỉnh so với spec" (copy từ plan), dòng
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Expected: CI `lint-typecheck-build` xanh trên PR.
