# Cờ Tỷ Phú UI phần 1 (bố cục điện thoại, `game-ui`, tách file) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bàn Cờ Tỷ Phú chơi tốt trên điện thoại (ô đọc được, người chơi + nút luôn thấy, quân không chồng, hộp thoại là
drawer), dùng `game-ui`, và `TyPhuTable.tsx` (2 804 dòng) được tách thành các file nhỏ — logic game và protocol không đổi.

**Architecture:** Tách file trước bằng các commit **chỉ di chuyển code** (biến `let BOARD` toàn module → `boardRef.current`
trong module dùng chung). Sau đó thay thành phần bằng `game-ui` (lớp bọc `CBtn`/`Modal` để không phải sửa từng chỗ gọi), rồi
thêm ô rút gọn, dải người chơi, và `ActionBar` hai vị trí với tuỳ chọn người xem lưu `localStorage`. Logic mới thuần nằm ở
`board/layout.ts` và `prefs.ts`, test bằng vitest.

**Tech Stack:** Next 16, React 19, Tailwind 4, `game-ui` (PR #68), `@base-ui/react`, `vaul`, `motion` (`m`), vitest 4,
Playwright (`playwright-core` ở `%TEMP%/shots`, Edge).

**Spec:** `docs/superpowers/specs/2026-10-14-typhu-ui-part1-design.md`

## Global Constraints

- Nhánh `feature/typhu-ui-part1` (đã tạo từ `feature/game-ui-foundation`, có commit spec). PR vào `develop` sau khi #68
  merge (rebase lên `develop` lúc đó).
- Chỉ sửa trong `src/components/typhu/`, `src/components/game-ui/GameDialog.tsx` (Task 4), `docs/`. Không sửa
  `src/lib/typhu/*`, be_game, các game khác, `src/components/games/*`.
- Commit tách file (Task 2–3): **chỉ di chuyển** code + thêm `import`/`export` + đổi `BOARD` → `boardRef.current`. Không
  sửa logic, className, chữ trong cùng commit.
- `import { m as motion } from "motion/react"` như file gốc (`LazyMotion strict`).
- Import `game-ui` theo từng file: `@/components/game-ui/GameButton`… (không `@/components/game-ui`).
- Chữ hiển thị tiếng Việt; comment tiếng Anh; giữ phím tắt hiện có (R B S E X A J K Space L, Ctrl+Shift+Y).
- Nhãn ô rút gọn ≥ 10 px; `GameButton` md = 44 px; ô rút gọn khi bề rộng ô cạnh < 64 px.
- Tuỳ chọn người xem: `localStorage["typhu:prefs"]`, mặc định `{ "actions": "center" }`, chỉ áp dụng < `lg` dọc
  (không `short:`).
- Trước mỗi commit: `npm run lint && npm run typecheck && npm test`.
- Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Môi trường thử: be_game local `PORT=4123 npx tsx src/local.ts` (repo be_game), frontend
  `NEXT_PUBLIC_TIENLEN_SERVER_URL=http://localhost:4123 NEXT_PUBLIC_TIENLEN_FALLBACK_URL= npx next dev -p 3105`, bot
  `node "$TEMP/shots/typhu-bots.mjs" 3 4` (in `CODE xxxxx`; bot tự tung/mua/kết thúc lượt; bàn bắt đầu khi đủ 4 ghế).

## Review Focus

1. **Tách file làm đổi hành vi ngầm**: `BOARD` bị gán trong render (`TableBody`); sau tách, mọi helper phải đọc
   `boardRef.current` cùng thời điểm → bản đồ `large`/`huge` vẫn đúng. Kiểm ở Task 3 (ảnh bàn `huge`).
2. **Ô rút gọn mất thông tin**: chạm ô vẫn mở thẻ đầy đủ; ô thế chấp/có chủ/có nhà vẫn phân biệt được. Kiểm ở Task 5.
3. **Thanh dưới che nội dung hoặc chat** khi bàn phím ảo/notch/thanh trình duyệt. Kiểm ở Task 7 + Task 8.
4. **Hai `ActionBar` cùng lúc / phím tắt đăng ký hai lần**: phím tắt chỉ ở `Centre`; `ActionBar` chỉ render một chỗ theo
   `placement`. Kiểm ở Task 7.
5. **Dữ liệu `localStorage` hỏng / SSR**: `parsePrefs` trả mặc định; đọc sau mount nên không lệch hydration. Kiểm ở Task 1
   (unit) và Task 8 (console sạch).

---

### Task 1: Logic thuần — `board/layout.ts`, `prefs.ts`

**Files:**
- Create: `src/components/typhu/board/layout.ts`, `src/components/typhu/board/layout.test.ts`
- Create: `src/components/typhu/prefs.ts`, `src/components/typhu/prefs.test.ts`

**Interfaces — Produces:**
- `shortNum(n: number): string` — `< 1000` → `"220"`; `≥ 1000` → `"1k"`, `"1,2k"` (một chữ số thập phân, dấu phẩy, bỏ `,0`)
- `cellLabel(sq: Square, deed: Deed | undefined, rent: number | null): string`
- `rentAmount(sq: Square, deed: Deed | undefined, ownerCount: number, fullGroup: boolean): number | null`
- `tokenSlots(n: number): { x: number; y: number; scale: number }[]`
- `sideCellPx(boardPx: number, edge: number): number`; `COMPACT_CELL_PX = 64`; `isCompact(cellPx: number): boolean`
- `type ActionsPlacement = "center" | "bottom"`; `interface TyPhuPrefs { actions: ActionsPlacement }`;
  `DEFAULT_PREFS`; `PREFS_KEY = "typhu:prefs"`; `parsePrefs(raw: string | null): TyPhuPrefs`

- [ ] **Step 1: Test `layout.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { BOARD, type Square } from "@/lib/typhu/board";
import type { Deed } from "@/lib/typhu/protocol";
import { COMPACT_CELL_PX, cellLabel, isCompact, rentAmount, shortNum, sideCellPx, tokenSlots } from "./layout";

const prop = BOARD.find((s) => s.kind === "prop") as Extract<Square, { kind: "prop" }>;
const air = BOARD.find((s) => s.kind === "air")!;
const util = BOARD.find((s) => s.kind === "util")!;
const tax = BOARD.find((s) => s.kind === "tax") as Extract<Square, { kind: "tax" }>;
const chance = BOARD.find((s) => s.kind === "chance")!;
const deed = (d: Partial<Deed> = {}): Deed => ({ owner: "p1", houses: 0, mortgaged: false, ...d }) as Deed;

describe("shortNum", () => {
  it("keeps small numbers and shortens thousands", () => {
    expect(shortNum(220)).toBe("220");
    expect(shortNum(1000)).toBe("1k");
    expect(shortNum(1250)).toBe("1,3k");
    expect(shortNum(2000)).toBe("2k");
  });
});

describe("rentAmount", () => {
  it("is the base rent, doubled for a full group, then the house row", () => {
    expect(rentAmount(prop, deed(), 1, false)).toBe(prop.rent[0]);
    expect(rentAmount(prop, deed(), 1, true)).toBe(prop.rent[0] * 2);
    expect(rentAmount(prop, deed({ houses: 2 }), 1, true)).toBe(prop.rent[2]);
  });
  it("is 0 while mortgaged, null for utilities (depends on the dice), null without a deed", () => {
    expect(rentAmount(prop, deed({ mortgaged: true }), 1, true)).toBe(0);
    expect(rentAmount(util, deed(), 1, false)).toBeNull();
    expect(rentAmount(prop, undefined, 0, false)).toBeNull();
  });
  it("grows with the number of airports owned", () => {
    expect(rentAmount(air, deed(), 2, false)).toBeGreaterThan(rentAmount(air, deed(), 1, false)!);
  });
});

describe("cellLabel", () => {
  it("shows the price of a free square and the rent of an owned one", () => {
    expect(cellLabel(prop, undefined, null)).toBe(shortNum(prop.price));
    expect(cellLabel(prop, deed(), 26)).toBe("26");
  });
  it("marks mortgaged squares, dice-based rent and taxes", () => {
    expect(cellLabel(prop, deed({ mortgaged: true }), 0)).toBe("TC");
    expect(cellLabel(util, deed(), null)).toBe("🎲");
    expect(cellLabel(tax, undefined, null)).toBe(`Thuế ${shortNum(tax.amount)}`);
  });
  it("is empty for squares that only show an icon", () => {
    expect(cellLabel(chance, undefined, null)).toBe("");
  });
});

describe("tokenSlots", () => {
  it("returns one slot per token, inside the cell, with centres at least 30% apart", () => {
    for (let n = 1; n <= 6; n++) {
      const slots = tokenSlots(n);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(100);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y)).toBeGreaterThanOrEqual(30);
    }
  });
  it("shrinks tokens as more share a cell and clamps the count", () => {
    expect(tokenSlots(1)[0].scale).toBeGreaterThan(tokenSlots(4)[0].scale);
    expect(tokenSlots(0)).toEqual([]);
    expect(tokenSlots(9)).toHaveLength(6);
  });
});

describe("compact cells", () => {
  it("measures a side square from the board width (corners are 1.6 squares wide)", () => {
    expect(sideCellPx(1220, 10)).toBeCloseTo(100, 5);
  });
  it("is compact under 64 px", () => {
    expect(COMPACT_CELL_PX).toBe(64);
    expect(isCompact(63.9)).toBe(true);
    expect(isCompact(64)).toBe(false);
  });
});
```

- [ ] **Step 2: Test `prefs.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs } from "./prefs";

describe("parsePrefs", () => {
  it("defaults to actions in the centre", () => {
    expect(DEFAULT_PREFS).toEqual({ actions: "center" });
    expect(PREFS_KEY).toBe("typhu:prefs");
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  });
  it("reads a saved bottom bar", () => {
    expect(parsePrefs(JSON.stringify({ actions: "bottom" }))).toEqual({ actions: "bottom" });
  });
  it("ignores broken JSON and unknown values", () => {
    expect(parsePrefs("{oops")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify({ actions: "left" }))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify([1, 2]))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
  });
});
```

- [ ] **Step 3: Chạy → FAIL** — `npx vitest run src/components/typhu` → `Failed to resolve import "./layout"` / `"./prefs"`.

- [ ] **Step 4: `board/layout.ts`**

```ts
import { AIR_RENT, isOwnable, type Square } from "@/lib/typhu/board";
import type { Deed } from "@/lib/typhu/protocol";

/** Compact number for tiny squares: 220, 1k, 1,3k. */
export function shortNum(n: number): string {
  if (n < 1000) return String(n);
  const k = Math.round(n / 100) / 10;
  return `${String(k).replace(".", ",")}k`;
}

/**
 * Rent due on an owned square right now (null = no deed, or it depends on the dice). `ownerCount` = squares of the same
 * kind (airports / utilities) the owner holds; `fullGroup` = the owner holds the whole colour group.
 */
export function rentAmount(sq: Square, deed: Deed | undefined, ownerCount: number, fullGroup: boolean): number | null {
  if (!deed || !isOwnable(sq)) return null;
  if (deed.mortgaged) return 0;
  if (sq.kind === "prop") return deed.houses > 0 ? sq.rent[deed.houses] : fullGroup ? sq.rent[0] * 2 : sq.rent[0];
  if (sq.kind === "air") return AIR_RENT[Math.max(0, ownerCount - 1)];
  return null; // utilities: dice total × multiplier

}

/** The one number a compact square shows: price when free, rent when owned; "" for icon-only squares. */
export function cellLabel(sq: Square, deed: Deed | undefined, rent: number | null): string {
  if (sq.kind === "tax") return `Thuế ${shortNum(sq.amount)}`;
  if (!isOwnable(sq)) return "";
  if (!deed) return shortNum(sq.price);
  if (deed.mortgaged) return "TC";
  return rent === null ? "🎲" : shortNum(rent);
}

const SLOTS: { x: number; y: number }[][] = [
  [],
  [{ x: 50, y: 50 }],
  [{ x: 30, y: 50 }, { x: 70, y: 50 }],
  [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 50, y: 72 }],
  [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 30, y: 70 }, { x: 70, y: 70 }],
  [{ x: 18, y: 30 }, { x: 50, y: 30 }, { x: 82, y: 30 }, { x: 30, y: 72 }, { x: 70, y: 72 }],
  [{ x: 18, y: 30 }, { x: 50, y: 30 }, { x: 82, y: 30 }, { x: 18, y: 72 }, { x: 50, y: 72 }, { x: 82, y: 72 }],
];
const SCALE = [0, 1, 0.8, 0.7, 0.65, 0.5, 0.5];

/** Where tokens sharing a square sit (percent of the square) so none covers another. */
export function tokenSlots(n: number): { x: number; y: number; scale: number }[] {
  const k = Math.max(0, Math.min(6, Math.floor(n)));
  return SLOTS[k].map((s) => ({ ...s, scale: SCALE[k] }));
}

/** Width of a side square: the grid is `1.6fr repeat(edge - 1, 1fr) 1.6fr`. */
export const sideCellPx = (boardPx: number, edge: number) => boardPx / (edge - 1 + 3.2);

export const COMPACT_CELL_PX = 64;
export const isCompact = (cellPx: number) => cellPx < COMPACT_CELL_PX;
```

Ghi chú: `shortNum(1250)` = `Math.round(12.5)/10` = `1.3` → `"1,3k"` (khớp test).

- [ ] **Step 5: `prefs.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

export type ActionsPlacement = "center" | "bottom";
export interface TyPhuPrefs {
  /** Phones only: action buttons in the board centre (default) or in a bar stuck to the bottom of the screen. */
  actions: ActionsPlacement;
}
export const DEFAULT_PREFS: TyPhuPrefs = { actions: "center" };
export const PREFS_KEY = "typhu:prefs";

/** Saved prefs, falling back to the defaults for anything missing or broken. */
export function parsePrefs(raw: string | null): TyPhuPrefs {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object" && !Array.isArray(v) && (v as { actions?: unknown }).actions === "bottom") return { actions: "bottom" };
  } catch {
    // broken JSON: defaults
  }
  return DEFAULT_PREFS;
}

/** This viewer's display prefs, read after mount (the server render always uses the defaults). */
export function useTyPhuPrefs(): [TyPhuPrefs, (next: TyPhuPrefs) => void] {
  const [prefs, setPrefs] = useState<TyPhuPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setPrefs(parsePrefs(localStorage.getItem(PREFS_KEY)));
      } catch {
        // storage blocked: keep the defaults
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const save = useCallback((next: TyPhuPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: this tab only
    }
  }, []);
  return [prefs, save];
}
```

- [ ] **Step 6: Chạy → PASS** — `npx vitest run src/components/typhu` → tất cả pass. Nếu `rentAmount(air, …, 2)` không lớn
  hơn `…, 1` thì đọc `AIR_RENT` trong `src/lib/typhu/board.ts` và sửa test theo bảng thật (không đổi `AIR_RENT`).
- [ ] **Step 7: Commit** — `git add src/components/typhu/board/layout.ts src/components/typhu/board/layout.test.ts src/components/typhu/prefs.ts src/components/typhu/prefs.test.ts`;
  message `feat(typhu): compact square labels, token slots and viewer prefs (pure helpers)`.

---

### Task 2: Ảnh mốc + tách phần dùng chung (`board-ref.ts`, `shared.tsx`, `now.tsx`)

**Files:**
- Create: `src/components/typhu/board-ref.ts`, `src/components/typhu/shared.tsx`, `src/components/typhu/now.tsx`
- Modify: `src/components/typhu/TyPhuTable.tsx`

**Interfaces — Produces:**
- `board-ref.ts`: `boardRef: { current: Square[] }` (khởi tạo `STD_BOARD`); `groupPositions(group: Group): number[]`
  (= `groupPositionsIn(group, boardRef.current)` như dòng 151 cũ).
- `now.tsx`: `NowContext`, `NowProvider`, `useSecondsLeft`, `NowClock`, `useNow`, `formatClock`.
- `shared.tsx`: `pieceOfSeat`, `TOKENS`, `SQUARE_IMG`, `squareImg`, `ArtIcon`, `money`, `type Act`, `GROUP_NAMES`,
  `ALL_GROUPS`, `buildableGroups`, `buildRuleText`, `mortgageBlocker`, `rentDue`, `Building`, `CBtn`, `Modal`.

- [ ] **Step 1: Chụp ảnh mốc trước khi đổi code** (script `$TEMP/shots/typhu-shot.mjs` đã có; bàn mới: chạy lại bot)

```bash
cd "$TEMP/shots" && node typhu-bots.mjs 3 4 > typhu-bots.log 2>&1 &
sleep 3; CODE=$(grep -oE "CODE [A-Z0-9]+" "$TEMP/shots/typhu-bots.log" | cut -d' ' -f2)
sed -i "s#/co-ty-phu/[A-Z0-9]*\"#/co-ty-phu/$CODE\"#" "$TEMP/shots/typhu-shot.mjs" && (cd "$TEMP/shots" && node typhu-shot.mjs)
mkdir -p "$TEMP/shots/baseline" && cp "$TEMP/shots"/typhu-play-*.png "$TEMP/shots"/typhu-wait-*.png "$TEMP/shots/baseline/"
```

Expected: 4 ảnh trong `baseline/`.

- [ ] **Step 2: Tạo `board-ref.ts`** (thay cho `let BOARD` dòng 150–151)

```ts
import { BOARD as STD_BOARD, groupPositions as groupPositionsIn, type Group, type Square } from "@/lib/typhu/board";

/**
 * The board of the table being shown. TableBody sets it every render (`boardRef.current = boardOf(...)`) before any
 * child reads it — same contract as the old module-level `let BOARD`, now shared across files.
 */
export const boardRef: { current: Square[] } = { current: STD_BOARD };

/** Positions of a colour group on the current board. */
export const groupPositions = (group: Group) => groupPositionsIn(group, boardRef.current);
```

(Như dòng 151 gốc: thư viện là `groupPositions(group, board = BOARD)`.)

- [ ] **Step 3: Tạo `now.tsx`** — di chuyển nguyên văn các khai báo `NowContext` (119), `NowProvider` (121–123),
  `useSecondsLeft` (126–129), `NowClock` (131–134), `useNow` (136–144), `formatClock` (649–652), thêm `export` cho từng
  cái. Đầu file: `"use client";` và `import { createContext, useContext, useEffect, useState } from "react";`.

- [ ] **Step 4: Tạo `shared.tsx`** — di chuyển nguyên văn, thêm `export`: `pieceOfSeat` (60), `TOKENS` (62–69),
  `SQUARE_IMG` (72–81), `squareImg` (84), `ArtIcon` (86–89), `money` (92), `type Act` (94), `GROUP_NAMES` (1131–1140),
  `ALL_GROUPS` (1141), `buildableGroups` (1144–1149), `buildRuleText` (1152–1155), `CBtn` (1279–1319),
  `mortgageBlocker` (1367–1374), `rentDue` (1892–1905), `Building` (657–659), `Modal` (2643–2686). Trong các khai báo
  này đổi mọi `BOARD` → `boardRef.current`, `groupPositions` lấy từ `./board-ref`. Đầu file:

```ts
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AIR_RENT, GROUP_COLORS, JAIL_FINE, UTIL_MULT, isOwnable, type Group, type Square } from "@/lib/typhu/board";
import type { TPGameView, TPSeatView, TPSettings } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { boardRef, groupPositions } from "./board-ref";
```

  Bỏ những import mà lint báo không dùng; thêm những gì typecheck báo thiếu (chỉ tên đã có trong import gốc dòng 1–54).

- [ ] **Step 5: Sửa `TyPhuTable.tsx`** — xoá các khai báo đã di chuyển; dòng 288 đổi `BOARD = boardOf(...)` thành
  `boardRef.current = boardOf(...)`; mọi `BOARD` còn lại → `boardRef.current`; thêm
  `import { ... } from "./shared"`, `from "./now"`, `from "./board-ref"`. Giữ `export { money, pieceOfSeat, TOKENS } from "./shared";`
  để các export cũ không mất.

- [ ] **Step 6: Kiểm tra** — `npm run lint && npm run typecheck && npm test` → pass. `grep -n "\bBOARD\b" src/components/typhu/*.tsx`
  → chỉ còn trong chuỗi import `BOARD as STD_BOARD` của `board-ref.ts`. Mở bàn trên `http://localhost:3105` (bot đang
  chơi) → không lỗi console.

- [ ] **Step 7: Commit** — `refactor(typhu): move shared helpers, board ref and clock out of TyPhuTable (no behaviour change)`.

---

### Task 3: Tách component theo thư mục (chỉ di chuyển)

**Files:** Create theo bảng; Modify `TyPhuTable.tsx`.

| File mới | Di chuyển nguyên văn (dòng gốc) | Export |
|---|---|---|
| `board/walk.ts` | `walkPath` (158–173), `useWalkingTokens` (179–209) | `useWalkingTokens` |
| `board/Cell.tsx` | `cellOf` (212–227), `BuildBurst` (662–702), `Buildings` (705–725), `CellToken` (727–732), `NO_TOKENS` (733), `CellProps` (736–748), `sameCell` (750–763), `Cell` (765–863) | `Cell`, `CellToken`, `NO_TOKENS` |
| `centre/Dice.tsx` | `PIPS` (867), `Die` (869–883) | `Die` |
| `centre/OfferCards.tsx` | `LoanCard` (1983–2011), `TradeCard` (2084–2134) | cả hai |
| `centre/Centre.tsx` | `Centre` (885–1105), `BuyHint` (1108–1129) | `Centre` |
| `panels/BuildPanel.tsx` | `BuildPanel` (1158–1277) | ✓ |
| `panels/DebtControls.tsx` | `DebtControls` (1322–1364) | ✓ |
| `panels/AssetPanel.tsx` | `AssetPanel` (1380–1550) | ✓ |
| `fx/Overlays.tsx` | `MONEY_BITS` (1552), `BankruptOverlay` (1555–1603), `BuildOverlay` (1605–1629), `CardOverlay` (1631–1663) | 3 overlay |
| `players/PlayerRow.tsx` | `PlayerRow` (1667–1772) | ✓ |
| `dialogs/SquareDialog.tsx` | `SquareModal` (1776–1889), `OwnableInfo` (1907–1969), `SQUARE_TEXT` (1971–1979) | `SquareModal` |
| `dialogs/LoanDialog.tsx` | `LoanModal` (2013–2080) | ✓ |
| `dialogs/TradeDialog.tsx` | `TradeModal` (2136–2236, gồm `Picker` lồng bên trong), `CashInput` (2238–2254) | `TradeModal` |
| `dialogs/RulesDialog.tsx` | `TyPhuRules` (2608–2628), `RulesModal` (2630–2637) | cả hai |
| `dialogs/PiecePicker.tsx` | `PiecePicker` (2689–2754) | ✓ |
| `dialogs/LogDialog.tsx` | `LogList` (2757–2782), `LogModal` (2785–2804) | cả hai |
| `waiting/Waiting.tsx` | `Waiting` (2258–2315) | ✓ |
| `waiting/TableSettings.tsx` | `RULE_PRESETS` (2319–2326), `TableSettings` (2328–2561), `SELECT` (2563), `SettingSelect` (2565–2595), `Toggle` (2597–2604) | `TableSettings` |

`TyPhuTable.tsx` giữ: import, `SCORE_NOTE`, `localize`, `TyPhuTable` (default), `Table`, `TableBody`, và re-export
`export { TyPhuRules } from "./dialogs/RulesDialog";` (vì `src/app/co-ty-phu/page.tsx` import nó).

- [ ] **Step 1: Di chuyển từng nhóm** theo bảng, mỗi file mới có `"use client";` (trừ `board/walk.ts` nếu chỉ có hook —
  vẫn cần `"use client"` vì dùng hook) và import đúng những tên nó dùng: tên nội bộ lấy từ `../shared`, `../now`,
  `../board-ref` hoặc file anh em; tên ngoài lấy y như import gốc (dòng 1–54). Thứ tự: `board/*` → `centre/*` →
  `panels/*` → `fx/*` → `players/*` → `dialogs/*` → `waiting/*`.
- [ ] **Step 2: Sau mỗi nhóm** chạy `npm run typecheck && npm run lint` (sửa chỉ bằng thêm/bớt import/export).
- [ ] **Step 3: So ảnh** — chạy lại Step 1 của Task 2 (bàn mới, chụp vào `$TEMP/shots/after-split/`); mở cặp ảnh
  `baseline/typhu-play-desktop.png` và `after-split/typhu-play-desktop.png` (tương tự phone, wait): bố cục, màu, chữ giống
  nhau (vị trí quân/tiền khác do ván khác là bình thường).
- [ ] **Step 4: Bản đồ `huge`** — trong `/co-ty-phu/<CODE>` khi đang chờ, chủ bàn (bot đầu) đổi được map qua lệnh
  settings; thay vào đó chạy `typhu-bots.mjs` với bot gửi `{type:"settings", map:"huge"}` trước khi start (thêm dòng
  `if (i === 0 && !g && !v.settings.map?.startsWith("huge")) await b.send({ type: "settings", map: "huge" });` vào
  `onState` của bot 0), chụp desktop → bàn có nhiều ô hơn, đúng tên ô, không lỗi console.
- [ ] **Step 5: Kiểm tra cuối** — `npm run lint && npm run typecheck && npm test`; `wc -l src/components/typhu/TyPhuTable.tsx`
  → ≲ 600.
- [ ] **Step 6: Commit** (một commit cho cả bảng hoặc một commit mỗi thư mục) —
  `refactor(typhu): split TyPhuTable into board, centre, panels, dialogs, waiting, fx and players (no behaviour change)`.

---

### Task 4: Chuyển sang `game-ui`

**Files:** Modify `src/components/game-ui/GameDialog.tsx`, `shared.tsx`, `TyPhuTable.tsx`, `centre/Centre.tsx`,
`panels/DebtControls.tsx`, `panels/AssetPanel.tsx`, `dialogs/PiecePicker.tsx`, `dialogs/LogDialog.tsx`,
`dialogs/SquareDialog.tsx`, `players/PlayerRow.tsx`, `waiting/TableSettings.tsx`.

**Interfaces:**
- `GameDialog` thêm props tuỳ chọn (tương thích ngược): `light?: boolean` (nền kem `bg-[#f4efe1] text-emerald-950`,
  viền `border-emerald-900/15`), `hideTitle?: boolean` (tiêu đề chỉ cho trình đọc màn hình: `sr-only`).
- `shared.tsx` `CBtn` giữ nguyên props (`primary`, `danger`, `build`, `hotkey`, `title`, `disabled`, `onClick`), render
  `GameButton`; `Modal` giữ props (`children`, `onClose`, `dark`) + `title?: string`, render `GameDialog`.

- [ ] **Step 1: `GameDialog`** — thêm `light`, `hideTitle`; `SURFACE` chọn theo `light`; `Dialog.Title`/`Drawer.Title`
  thêm `className={cn(..., hideTitle && "sr-only")}`; mô tả và footer giữ nguyên. Kiểm `/ui-kit` vẫn như cũ.

- [ ] **Step 2: `CBtn` → `GameButton`**

```tsx
export function CBtn({ children, onClick, disabled, primary, danger, build, title, hotkey }: { /* props như cũ */ }) {
  return (
    <GameButton
      size="md"
      variant={danger ? "danger" : primary || build ? "primary" : "secondary"}
      shine={build}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
      {hotkey && (
        <kbd className="hidden rounded border border-current/30 bg-black/10 px-1 font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
    </GameButton>
  );
}
```

  (Nút trong khung giữa bàn nền sáng: `secondary` có chữ trắng trên `bg-white/12` → không đọc được trên `bg-[#dff1e5]`.
  Thêm vào `CBtn` khi `!primary && !danger && !build`: `className="bg-emerald-900/80 text-white"` để giữ tương phản.)

- [ ] **Step 3: `Modal` → `GameDialog`**

```tsx
export function Modal({ children, onClose, dark, title }: { children: React.ReactNode; onClose: () => void; dark?: boolean; title?: string }) {
  return (
    <GameDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title ?? "Chi tiết"}
      hideTitle={!title}
      light={!dark}
      footer={<GameButton size="sm" onClick={onClose}>Đóng</GameButton>}
    >
      {children}
    </GameDialog>
  );
}
```

  Bỏ `createPortal`/`useEffect` Esc khỏi `Modal` (GameDialog lo). Các nơi gọi giữ nguyên.

- [ ] **Step 4: `PiecePicker`, `LogModal`** — thay overlay tự viết (`fixed inset-0 z-[60]…`) và listener Esc bằng
  `GameDialog` (`title="Chọn quân cờ"` / `"Diễn biến"`, `open`, `onOpenChange={(o) => !o && onClose()}`), nội dung giữ
  nguyên.
- [ ] **Step 5: `ConfirmButton`** trong `DebtControls`, `AssetPanel`, `SquareDialog`, `PlayerRow` → `GameButton`
  (`variant="danger"`, `size="sm"`, `confirm={<giữ confirmLabel gốc hoặc "Chắc chắn?">}`, giữ `onClick`=`onConfirm` gốc).
- [ ] **Step 6: Lượt + đồng hồ trong `Centre`** — thay `<TurnRing active={myTurn} className="inset-0" />` bằng
  `{myTurn && <span aria-hidden className="game-beam" />}` (khung đã `relative rounded-2xl`); `MyTurnBadge` →
  `<GameBadge tone="accent" role="status">Lượt của bạn</GameBadge>`; `⏱ {secs}s` →
  `<Countdown deadline={g.deadline} total={stepMs} size={36} />` khi `g.deadline` có, với `stepMs` = thời gian một bước
  lượt: `view.settings.stepSeconds` × 1000 (trường tuỳ chọn — mặc định lấy giá trị đầu của `STEP_SECONDS_OPTIONS` hoặc mặc
  định server ghi trong be_game `docs/games/typhu.md`). `timeLimit` là tổng giờ cả ván (đồng hồ ⏰ trên header), **không**
  dùng cho Countdown. `g.deadline` sau `localize` đã là giờ local.
- [ ] **Step 7: Còn lại** — `SettingsTabs light` → `GameTabs light` (`waiting/TableSettings.tsx`); `WinCelebration` →
  `Celebration` (`TyPhuTable.tsx`, cùng props); hộp người chơi/vay/diễn biến `rounded-2xl bg-black/35 p-3` →
  `GamePanel` (`title` = tiêu đề hộp hiện có); bọc nội dung root của `TableBody` bằng
  `<GameThemeScope game="typhu" className="contents">` (không đổi bố cục).
- [ ] **Step 8: Kiểm tra** — `npm run lint && npm run typecheck && npm test`; trên bàn đang chơi (desktop 1440 + phone 390):
  bấm Tung/Mua/Kết thúc chạy đúng; mở ô đất (sáng), vay, đổi đất, luật, diễn biến, chọn quân → dialog (desktop) / drawer
  (phone) và Esc/nút Đóng đóng được; không lỗi console. Chụp `$TEMP/shots/after-gameui/`.
- [ ] **Step 9: Commit** — `feat(typhu): use game-ui buttons, dialogs, badges, countdown, tabs and celebration`.

---

### Task 5: Ô rút gọn và quân không chồng

**Files:** Modify `board/Cell.tsx`, `TyPhuTable.tsx` (phần bàn), `shared.tsx` (`rentDue` dùng `rentAmount`).

**Interfaces:** Consumes `cellLabel`, `rentAmount`, `tokenSlots`, `sideCellPx`, `isCompact`, `shortNum` (Task 1).
`CellProps` thêm `compact: boolean`, `label: string`; `sameCell` so thêm hai trường này.

- [ ] **Step 1: Đo bàn** — trong `TableBody`: `const boardEl = useRef<HTMLDivElement>(null); const [compact, setCompact] = useState(false);`
  và effect `ResizeObserver` trên lưới bàn: `setCompact(isCompact(sideCellPx(entry.contentRect.width, boardRef.current.length / 4)))`.
  Gắn `ref={boardEl}` vào div lưới bàn (`grid aspect-square …`).
- [ ] **Step 2: Nhãn** — trong `boardRef.current.map(...)` tính
  `const owned = deed ? Object.entries(g!.deeds).filter(([p, x]) => x.owner === deed.owner && boardRef.current[Number(p)].kind === sq.kind).length : 0;`
  `const full = sq.kind === "prop" && !!deed && groupPositions(sq.group).every((p) => g!.deeds[p]?.owner === deed.owner);`
  `label={cellLabel(sq, deed, rentAmount(sq, deed, owned, full))}`, `compact={compact}`.
- [ ] **Step 3: `Cell` khi `compact`**: không render tên; render `label` (nếu khác rỗng) `text-[10px] font-extrabold leading-none tabular-nums`;
  ô `prop` bỏ ảnh (vạch màu là nhận diện), ô khác giữ ảnh `size-4`; dải màu giữ nhưng 18%/30% (có nhà);
  huy hiệu chủ giữ. Không `compact`: giữ nguyên giao diện hiện tại (máy tính).
- [ ] **Step 4: Quân** — thay khối `flex flex-wrap` bằng vị trí tuyệt đối:

```tsx
{here.length > 0 && (
  <span className="pointer-events-none absolute inset-0">
    {here.map((p, i) => {
      const s = tokenSlots(here.length)[i] ?? tokenSlots(6)[i % 6];
      return (
        <motion.span
          key={p.id}
          layoutId={`token-${p.id}`}
          transition={{ layout: { type: "tween", ease: "easeOut", duration: 0.16 } }}
          className={cn(
            "absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white text-[8px] shadow-md sm:text-sm short:text-[8px]",
            p.turn && "z-10 ring-2 ring-amber-400",
          )}
          style={{ left: `${s.x}%`, top: `${s.y}%`, height: `${42 * s.scale}%`, minHeight: 12, background: p.color }}
        >
          {p.emoji}
        </motion.span>
      );
    })}
  </span>
)}
```

  (Chiều cao theo % ô, `aspect-square` lo chiều rộng.)
- [ ] **Step 5: `rentDue`** (shared) — phần số dùng `rentAmount` để không lệch với nhãn ô (chữ hiển thị giữ nguyên).
- [ ] **Step 6: Kiểm tra** — 390 px: đo bằng Playwright `getComputedStyle` cỡ chữ mọi nhãn trong ô ≥ 10 px; ô có chủ hiện
  tiền thuê, ô thế chấp "TC"; chạm ô mở thẻ đầy đủ; bàn có ≥ 2 quân cùng ô (đầu ván ở ô Khởi hành) → bounding box các quân
  không giao nhau quá 30 %. 1440 px: ô đầy đủ như trước. `npm run lint && npm run typecheck && npm test`.
- [ ] **Step 7: Commit** — `feat(typhu): readable compact squares on phones and tokens that never cover each other`.

---

### Task 6: Dải người chơi, diễn biến rút gọn, hàng nút nhanh (điện thoại)

**Files:** Create `players/PlayerStrip.tsx`; Modify `TyPhuTable.tsx`.

**Interfaces:** `PlayerStrip({ seats, g, meId, tokenOf, nameOf, onOpen }: { seats: (TPSeatView | null)[]; g: TPGameView | null; meId: string; tokenOf: (id: string) => { emoji: string; color: string }; onOpen: (id: string) => void })`.

- [ ] **Step 1: `PlayerStrip`** — `ul` cuộn ngang (`flex gap-2 overflow-x-auto snap-x lg:hidden short:hidden`), mỗi ghế một
  `SeatChip` (`size="sm"`, `profile={{ icon: token.emoji, color: token.color }}`, `points={p?.cash}`, `online={seat.connected}`,
  `isTurn={g?.turn === seat.id}`, `isHost`, `isYou={seat.id === meId}`, `out={p?.bankrupt}`), bọc trong `button` →
  `onOpen(seat.id)`.
- [ ] **Step 2: Gắn vào `TableBody`** — render `PlayerStrip` ngay trên khối bàn (< `lg`, không `short:`); `onOpen`: nếu là
  mình → `openAssets()`; người khác → mở `GameDialog` hiển thị `PlayerRow` của người đó (dùng lại component). Hộp người chơi
  ở `aside` thêm `max-lg:hidden short:block` (máy tính và điện thoại ngang giữ như cũ).
- [ ] **Step 3: Diễn biến rút gọn + nút nhanh** (< `lg` dọc) ngay dưới bàn: 3 dòng cuối `g.log` (bấm → `setShowLog(true)`)
  và hàng `GameButton size="sm"`: `Tài sản` (`openAssets`, khi có đất), `Đổi đất` (`setShowTrade(true)`), `Vay`
  (`setShowLoan(true)`), cùng điều kiện hiện như trong `Centre` (`canTrade && !trade && !loan`). Hộp diễn biến ở `aside` thêm
  `max-lg:hidden short:block`. Trong `Centre` bỏ danh sách log `lg:hidden` cũ và hàng nút Đổi đất/Vay khi < `lg` dọc
  (`max-lg:hidden short:flex`) để không trùng.
- [ ] **Step 4: Kiểm tra** — 390 px: thấy chip mọi người + chip đang tới lượt có viền sáng, không cần cuộn dọc; bấm chip
  mình mở tài sản; bấm chip người khác mở dialog thông tin; 3 dòng diễn biến mở toàn bộ; 1440 px và 844×390 ngang không đổi.
- [ ] **Step 5: Commit** — `feat(typhu): player strip, short log and quick actions on phones`.

---

### Task 7: `ActionBar` hai vị trí và ⚙ tuỳ chọn

**Files:** Create `centre/ActionBar.tsx`, `TableOptions.tsx`; Modify `centre/Centre.tsx`, `TyPhuTable.tsx`.

**Interfaces:**
- `ActionBar({ placement, g, view, myTurn, mine, busy, run, nameOf, assetsOpen, onOpenAssets, onBuild }: { placement: "center" | "bottom"; …; onBuild: () => void })`
  — chứa đúng khối "lượt + nút" của `Centre` (dòng gốc 1010–1068: badge lượt, Countdown, các `CBtn`, `DebtControls`).
- `showBuild` chuyển lên `TableBody` (`useState`), truyền `showBuild`/`setShowBuild` cho `Centre` (phím X/Escape và
  `BuildPanel` vẫn ở `Centre`).
- `useBottomBarAllowed(): boolean` (trong `prefs.ts`): `matchMedia("(max-width: 1023px)")` và **không**
  `"(orientation: landscape) and (max-height: 500px)"`, qua `useSyncExternalStore`, server `false`.
- `TableOptions({ prefs, onChange })`: nút ⚙ `GameButton variant="ghost" size="sm" aria-label="Tuỳ chọn hiển thị"` mở
  `GameDialog` `title="Tuỳ chọn hiển thị"` với 2 lựa chọn "Nút ở giữa bàn" / "Thanh nút dưới màn hình" (radio, `role="radiogroup"`).

- [ ] **Step 1: Tách `ActionBar`** (di chuyển khối 1010–1068 của `Centre` sang `ActionBar`; `Centre` render
  `<ActionBar placement="center" … />` khi `placement === "center"`, ngược lại chỉ còn xúc xắc + dòng trạng thái).
  `placement="bottom"`: bọc trong
  `<div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[oklch(0.2_0.03_290)]/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 pr-24 backdrop-blur">`
  (`pr-24` chừa cụm chat/emoji ở góc phải), khi không phải lượt mình chỉ hiện dòng "Lượt của …" + Countdown.
- [ ] **Step 2: `TableBody`** — `const [prefs, setPrefs] = useTyPhuPrefs(); const bottomAllowed = useBottomBarAllowed();`
  `const placement = bottomAllowed && prefs.actions === "bottom" ? "bottom" : "center";` truyền cho `Centre`; khi
  `"bottom"` render `<ActionBar placement="bottom" …/>` cuối root và thêm `pb-28` cho root. `TableOptions` đặt trong
  `extra` của `GameHeader` khi `bottomAllowed`.
- [ ] **Step 3: Kiểm tra** — 390 px: mặc định nút ở giữa; ⚙ → "Thanh nút dưới" → thanh dính đáy, nút vẫn chạy (Tung/Mua/
  Kết thúc), bounding box thanh không giao cụm chat; reload giữ lựa chọn; `localStorage["typhu:prefs"]="{oops"` → về giữa,
  không lỗi; phím tắt R/E vẫn chỉ gửi một lệnh mỗi lần (log server chỉ một dòng). 1440 px: không có ⚙, nút ở giữa.
- [ ] **Step 4: Commit** — `feat(typhu): action buttons in the board centre or a bottom bar, chosen per viewer`.

---

### Task 8: Kiểm tra tổng, docs, PR

**Files:** Create (ngoài repo) `$TEMP/shots/typhu-check.mjs`; Modify `docs/GAMES_GUIDE.md` (§4.3 Cờ Tỷ Phú).

- [ ] **Step 1: `typhu-check.mjs`** — với bàn đang chơi (bot), ở 375, 390, 844×390 (ngang), 768, 1440: không tràn ngang;
  `[data-slot="game-button"]` md/lg ≥ 44 px; < `lg` dọc: mọi nhãn ô ≥ 10 px, `PlayerStrip` hiện, quân cùng ô không giao
  > 30 %; mở lần lượt ô đất / vay / đổi đất / luật / diễn biến / chọn quân → là drawer ở ≤ 390 (`[data-vaul-drawer]` có
  mặt) và dialog ở 1440 (`[role=dialog]` giữa màn hình); ⚙ bottom → thanh không giao `ChatBox`; console không lỗi. In
  PASS/FAIL từng mục, `process.exitCode = 1` nếu có FAIL.
- [ ] **Step 2: Một ván trọn** — chơi tay (Playwright hoặc trình duyệt) với 3 bot tới khi có người phá sản: đi qua mua, xây
  (đủ nhóm), thế chấp, vay, đổi đất, nợ → phá sản; ghi lại bước nào lỗi (nếu có) và sửa trước khi tiếp.
- [ ] **Step 3: Bundle** — JS thực tải của `/co-ty-phu/<CODE>` (production build, cách đo của PR #68: tổng byte `.js`
  qua Playwright) trên `develop` + #68 và trên nhánh này; ghi số; mục tiêu tăng ≤ 15 KB gzip.
- [ ] **Step 4: Docs** — `GAMES_GUIDE.md` §4.3: cấu trúc thư mục mới, `boardRef`, ô rút gọn (ngưỡng 64 px), `ActionBar` +
  `typhu:prefs`, cách chạy bot `typhu-bots.mjs`.
- [ ] **Step 5: lint/typecheck/test, commit docs, review toàn nhánh, push, PR** vào `develop` (sau khi #68 merge: rebase
  `git rebase develop`), mô tả gồm ảnh trước/sau (`baseline/` vs cuối), kết quả `typhu-check.mjs`, bundle, các ruling.
