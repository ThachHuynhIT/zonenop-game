# Cờ Tỷ Phú — làm mới UI, phần 1: bố cục điện thoại, `game-ui`, tách file — thiết kế

Ngày: 2026-10-14 · Trạng thái: chờ duyệt · Phụ thuộc: PR #68 (`game-ui`, `docs/superpowers/specs/2026-10-14-game-ui-foundation-design.md`)

## 1. Bối cảnh và mục tiêu

Người dùng muốn làm mới bàn Cờ Tỷ Phú theo bốn hướng: chơi tốt trên điện thoại, cảm giác game hơn, đồng bộ với
`game-ui`, dễ hiểu hơn. Chia thành ba phần (mỗi phần một spec → kế hoạch → PR):

1. **Bố cục điện thoại + chuyển sang `game-ui` + tách file** ← spec này.
2. Cảm giác game: xúc xắc 3D, quân đi từng ô, tiền bay, hiệu ứng mua/xây.
3. Dễ hiểu: thẻ ô đất kèm bảng tiền thuê, bảng tài sản theo nhóm, ai nợ ai.

Hiện trạng (ảnh chụp 2026-10-14, bàn 4 người với bot, 1440 px và 390 px):

- Toàn bộ UI nằm trong `src/components/typhu/TyPhuTable.tsx` (~2 800 dòng, ~40 component nội bộ).
- Máy tính: bàn cờ 11×11 bên trái (`PinchZoom`), cột phải 20–22 rem (người chơi, diễn biến). Nút hành động nằm trong
  khung kính ở giữa bàn (`Centre`). Bố cục ổn.
- Điện thoại dọc: bàn cờ chiếm đầu màn hình, **chữ trong ô ~6–7 px** không đọc được, quân cùng ô chồng nhau, danh sách
  người chơi và diễn biến nằm dưới bàn (phải cuộn), nút chat nổi che diễn biến.
- Tự viết: `CBtn` và ~36 `<button>`, 5 modal `fixed inset-0` (`Modal`), `PlayerRow`, `NowClock`, dùng `TurnRing`,
  `MyTurnBadge`, `SettingsTabs light`, `WinCelebration` từ `components/games`.

**Thành công nghĩa là:** trên điện thoại 375–390 px dọc, mọi ô đọc được (chữ ≥ 10 px), thấy người chơi + lượt + nút
hành động mà không cuộn, quân cùng ô không chồng; mọi hộp thoại là drawer; bàn dùng `game-ui` (màu nhấn vàng `typhu`);
máy tính và điện thoại ngang không kém hơn hiện tại; logic game và protocol không đổi.

### Ngoài phạm vi

- Hiệu ứng mới (xúc xắc 3D, quân đi từng ô, tiền bay, overlay mới) — phần 2. Overlay hiện có giữ nguyên.
- Thẻ ô đất/bảng tài sản/nợ thiết kế lại — phần 3 (phần 1 chỉ chuyển chúng vào `GameDialog`, nội dung giữ nguyên).
- Thay đổi be_game, protocol (`src/lib/typhu/*`), luật, phím tắt.

## 2. Bố cục

### 2.1. Điện thoại dọc (< `lg`, không phải `short:`)

```
┌─────────────────────────────┐
│ GameHeader              ⚙   │  ⚙: tuỳ chọn người xem (2.4)
│ [chip][chip][chip][chip] →  │  PlayerStrip: SeatChip cuộn ngang, chip đang tới lượt có viền sáng
│ ┌─────────────────────────┐ │
│ │ BÀN CỜ vuông (ô rút gọn)│ │  PinchZoom như hiện tại
│ │   [xúc xắc + nút]       │ │  nút ở giữa bàn (mặc định)
│ └─────────────────────────┘ │
│ Diễn biến: 3 dòng mới nhất  │  bấm → LogDialog (drawer)
│ [Tài sản] [Đổi đất] [Vay]   │
│▓▓▓ ActionBar (tuỳ chọn) ▓▓▓▓│  khi chọn "thanh dưới": dính đáy, chừa chỗ cụm chat/emoji
└─────────────────────────────┘
```

- **Ô rút gọn** (`compact`): bật khi **bề rộng một ô cạnh < 64 px**, đo bằng `ResizeObserver` trên bàn (bàn có 3 cỡ bản
  đồ `std`/`large`/`huge` nên số ô mỗi cạnh thay đổi; ngưỡng theo ô chứ không theo bề rộng bàn):
  vạch màu nhóm + biểu tượng (ảnh ô như hiện tại, nhỏ lại) + **một** nhãn số: giá khi chưa có chủ, tiền thuê hiện tại khi
  đã có chủ (ô đặc biệt: nhãn ngắn, ví dụ "Thuế 200"). Chữ nhãn ≥ 10 px. Ô có chủ: chấm màu quân của chủ. Tên đầy đủ
  hiện khi chạm (mở `SquareDialog`).
- **Quân cùng ô**: xếp theo `tokenSlots(n)` (lưới 2×2, thêm hàng khi 5–6 quân), mỗi quân thu nhỏ theo số quân, không
  chồng tâm lên nhau.
- **PlayerStrip**: thay lưới 2 cột `PlayerRow` ở dưới bàn bằng dải `SeatChip` (`size="sm"`) cuộn ngang ngay trên bàn;
  chạm chip mở `AssetPanel` của người đó trong `GameDialog`.

### 2.2. Máy tính (≥ `lg`) và điện thoại ngang (`short:`)

Giữ bố cục hiện tại (bàn trái, cột phải; `short:` cột phải cuộn). Ô đầy đủ như hiện nay. Chỉ đổi thành phần sang
`game-ui` (mục 4). ActionBar dạng "thanh dưới" chỉ áp dụng < `lg` dọc; ở đây nút luôn ở giữa bàn.

### 2.3. Vị trí nút hành động (hai kiểu)

- `center` (mặc định): nút trong khung giữa bàn như hiện nay, cỡ `GameButton size="md"` (44 px).
- `bottom`: `ActionBar` dính đáy (`fixed inset-x-0 bottom-0`, `pb-[env(safe-area-inset-bottom)]`), chừa bên phải đủ cho
  cụm chat/emoji (`ChatBox`), trang thêm `padding-bottom` bằng chiều cao thanh; giữa bàn chỉ còn xúc xắc + dòng sự kiện
  mới nhất.
- Hai kiểu dùng **cùng một component** `ActionBar` (prop `placement`), nên tập nút và điều kiện hiện là một.

### 2.4. Tuỳ chọn người xem (⚙)

Nút ⚙ nhỏ (`GameButton variant="ghost" size="sm"`, `aria-label="Tuỳ chọn hiển thị"`) ở góc thanh trên của bàn, mở
popover/drawer nhỏ với: **Vị trí nút** (`Giữa bàn` / `Thanh dưới`). Lưu `localStorage["typhu:prefs"]` qua
`parsePrefs`/`savePrefs` (dữ liệu hỏng/thiếu → mặc định `{ actions: "center" }`); đọc sau mount (không lệch SSR).
Chỉ hiện ⚙ ở < `lg` (máy tính không có lựa chọn).

## 3. Tách file (`src/components/typhu/`)

Tách **trước** khi đổi giao diện, mỗi bước giữ nguyên hành vi.

| File | Nội dung |
|---|---|
| `TyPhuTable.tsx` | Kết nối (`useGameRoom`), state, hotkeys, ghép bố cục |
| `board/Board.tsx`, `board/Cell.tsx`, `board/Buildings.tsx`, `board/layout.ts` | Bàn, ô (đầy đủ + rút gọn), nhà; `cellLabel`, `tokenSlots` |
| `centre/Centre.tsx`, `centre/Dice.tsx`, `ActionBar.tsx` | Khu giữa, xúc xắc, thanh hành động (`placement: "center" \| "bottom"`) |
| `players/PlayerStrip.tsx`, `players/PlayerRow.tsx` | Dải chip (điện thoại), danh sách (máy tính) |
| `panels/AssetPanel.tsx`, `panels/BuildPanel.tsx`, `panels/DebtControls.tsx` | Tài sản, xây, trả nợ |
| `dialogs/SquareDialog.tsx`, `LoanDialog.tsx`, `TradeDialog.tsx`, `RulesDialog.tsx`, `LogDialog.tsx`, `PiecePicker.tsx` | Các hộp thoại trên `GameDialog` |
| `waiting/Waiting.tsx`, `waiting/TableSettings.tsx` | Phòng chờ, cài đặt |
| `fx/Overlays.tsx` | `BankruptOverlay`, `BuildOverlay`, `CardOverlay` (giữ nguyên) |
| `shared.ts(x)` | `TOKENS`, `ArtIcon`, `NowContext`, hằng dùng chung |
| `prefs.ts` | `parsePrefs`, `savePrefs`, `useTyPhuPrefs` |

`export function TyPhuRules` và `export const TOKENS` vẫn xuất từ `TyPhuTable.tsx` (re-export) vì nơi khác import.

## 4. Dùng `game-ui`

| Hiện tại | Thay bằng |
|---|---|
| `CBtn`, `<button>` hành động | `GameButton` (chính `primary`, phụ `secondary`; Phá sản/Trả nợ bằng tài sản `danger` + `confirm`) |
| `Modal` (5 chỗ) | `GameDialog` |
| `PlayerRow` | `SeatChip` (dải) / `PlayerRow` dựng từ `SeatChip` + tài sản (máy tính) |
| `NowClock` | `Countdown` |
| `TurnRing`, `MyTurnBadge` | `GameBadge tone="accent"` + `.game-beam` quanh khu hành động |
| `SettingsTabs light` | `GameTabs light` |
| `WinCelebration` | `Celebration` |
| Khung `bg-black/35` | `GamePanel` |

Bọc bàn bằng `GameThemeScope game="typhu"`. Import từng file `@/components/game-ui/<Component>` (không qua `index.ts`).
Giữ: nền minh hoạ giữa bàn, ảnh ô, phím tắt, logic, protocol.

## 5. Logic thuần (vitest, node)

`board/layout.ts` và `prefs.ts`:

- `cellLabel(sq: Square, deed: Deed | undefined, settings: TPSettings): string` — chưa có chủ: giá (`"220"`);
  có chủ: tiền thuê hiện tại; ô thuế: `"Thuế <số>"`; ô góc/cơ hội/khí vận: chuỗi rỗng (chỉ biểu tượng).
- `tokenSlots(n: number): { x: number; y: number; scale: number }[]` — n ∈ 1…6, vị trí theo % ô, các tâm cách nhau
  ≥ 30 % cạnh ô, `scale` giảm khi n tăng; n ngoài khoảng bị kẹp.
- `isCompact(cellPx: number): boolean` — `cellPx < 64`.
- `parsePrefs(raw: string | null): { actions: "center" | "bottom" }` — JSON hỏng/giá trị lạ → mặc định.

## 6. Kiểm tra

1. **Tách file**: sau mỗi bước `npm run typecheck && npm run lint`; ảnh chụp bàn đang chơi trước/sau tách giống nhau
   (so bằng mắt + kích thước ảnh).
2. **Unit**: test cho `cellLabel`, `tokenSlots`, `parsePrefs` (gồm dữ liệu hỏng).
3. **Playwright + bot** (`typhu-bots.mjs`: bot tạo bàn, tự tung/mua/kết thúc lượt) ở 375, 390, 390×844 xoay ngang,
   768, 1440 px; phòng chờ và đang chơi:
   - nhãn ô ≥ 10 px (< `lg`), không tràn ngang, `GameButton` md/lg ≥ 44 px;
   - quân cùng ô không chồng (bounding box các quân trên một ô không giao nhau quá 30 %);
   - ⚙ → "Thanh dưới": thanh dính đáy, không che nút chat (không giao nhau bounding box);
   - mỗi hộp thoại (ô đất, vay, đổi đất, luật, diễn biến, chọn quân) là drawer ở 390 px, dialog ở 1440 px;
   - console không lỗi.
4. **Một ván trọn với bot**: đi qua mua, xây, vay, đổi đất, nợ, phá sản; người thật thao tác các hộp thoại.
5. **Bundle**: JS thực tải của `/co-ty-phu/[room]` trước/sau (Next 16 không in kích thước); tăng ≤ 15 KB gzip.

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Tách file làm đổi hành vi ngầm (closure, memo) | Tách thuần di chuyển code, không sửa logic trong cùng commit; ảnh trước/sau |
| Ô rút gọn mất thông tin quan trọng | Chạm ô luôn mở `SquareDialog` đầy đủ; máy tính giữ ô đầy đủ |
| ActionBar dưới che nội dung/chat | Padding đáy trang + chừa vùng chat; kiểm bằng bounding box |
| PR #68 đổi API khi review | Nhánh tách từ `feature/game-ui-foundation`; rebase khi #68 merge |
