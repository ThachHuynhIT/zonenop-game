# Nền tảng UI cho game (`game-ui`) — thiết kế

Ngày: 2026-10-14 · Trạng thái: chờ duyệt · Phạm vi: phần 1/3 của đợt làm mới UI

## 1. Bối cảnh và mục tiêu

Người dùng muốn làm mới UI của site game theo ba mục tiêu: **đồng bộ, chuyên nghiệp hơn**, **cảm giác "game" hơn**, và
**dễ chơi trên điện thoại**. Phong cách đã chọn: **casual mobile game** (nút dày có chiều sâu, bo tròn lớn, màu tươi theo
từng game, chuyển động nảy). Âm thanh/rung: **chưa làm**.

Hiện trạng:

- Stack: Next 16, React 19, Tailwind 4, shadcn/ui bản Base UI (`components.json` style `base-nova`), `motion`,
  `@formkit/auto-animate`, `@number-flow/react`, `canvas-confetti`, `sonner`, `class-variance-authority`.
- `src/components/ui/` có 11 component shadcn nhưng gần như **không được dùng** ngoài chính thư mục đó.
- Các bàn chơi tự viết: hơn 140 `<button>` và khoảng 10 modal `fixed inset-0`, mỗi game một kiểu. File bàn chơi lớn
  (Tỷ Phú 2 800 dòng, Mèo Nổ/Bang ~1 750 dòng).
- Lớp dùng chung đã có trong `src/components/games/` và được cả 7 game import: `GamesShell`, `GameHeader`,
  `GameLobby`, `ChatBox`, `AllRoomsPanel`, `WinCelebration`, `TurnIndicator`, `PlayerAvatar`, `SettingsTabs`,
  `ConfirmButton`, `RankPointsPicker`.

Lộ trình chung (mỗi phần một spec → kế hoạch → PR riêng):

1. **Nền tảng `game-ui` + lớp dùng chung** ← spec này.
2. Trang chủ và sảnh (phần còn lại sau khi lớp dùng chung đã đổi).
3. Từng bàn chơi một (mỗi game một spec/PR, dùng lại `game-ui`).

**Thành công nghĩa là:** sau phần 1, khung trang, sảnh, chat, bảng điểm/cài đặt và hiệu ứng thắng của cả 7 game dùng
chung một ngôn ngữ thị giác casual-game, chạm thoải mái trên điện thoại 375 px, và các bàn chơi chưa bị sửa vẫn chạy
như cũ.

### Ngoài phạm vi

- Viết lại nội dung bàn chơi (bài, bàn cờ, nút trong bàn) — phần 3.
- Âm thanh, rung.
- Đổi nội dung/luồng của sảnh (chỉ đổi giao diện).
- Thư viện component khác (HeroUI, Mantine…) hay bộ UI retro (RPGUI, NES.css): đã cân nhắc và loại.

## 2. Hướng tiếp cận

Mở rộng shadcn/Base UI đang có: tự định nghĩa token "chất game" + biến thể `cva`, thêm vài component shadcn còn thiếu,
và copy có chọn lọc 2–3 hiệu ứng từ các registry tương thích shadcn (Magic UI / Motion Primitives) vào repo.
Phụ thuộc runtime mới duy nhất: **`vaul`** (Drawer).

## 3. Phần A — Ngôn ngữ thị giác (token)

Khai báo trong `src/app/globals.css` (Tailwind 4 `@theme inline` + biến CSS), dùng qua utility Tailwind.

### 3.1. Màu nhấn theo game

`GamesShell` đã biết game hiện tại (`gamesRegistry`); gắn `data-game="<id>"` lên phần tử gốc của shell. CSS đặt:

| `data-game` | Màu nhấn (`--game-accent`) | Gợi ý |
|---|---|---|
| (không có — trang chủ) | `oklch(0.70 0.20 300)` | tím của brand hiện tại |
| `tienlen` | `oklch(0.72 0.17 160)` | ngọc lục bảo |
| `meono` | `oklch(0.74 0.18 55)` | cam |
| `typhu` | `oklch(0.80 0.16 85)` | vàng |
| `splendor` | `oklch(0.66 0.20 295)` | tím đá quý |
| `bang` | `oklch(0.64 0.17 35)` | đỏ đất |
| `oanquan` | `oklch(0.68 0.10 70)` | nâu tre |
| `cangua` | `oklch(0.68 0.16 245)` | xanh dương |

Từ `--game-accent` suy ra bằng `color-mix`/`oklch(from …)`:

- `--game-accent-strong` (đáy khối, L − 0.14),
- `--game-accent-soft` (nền nhạt, 18 % trên nền),
- `--game-accent-fg: oklch(0.2 0.02 270)` (chữ tối, dùng chung mọi game). Mọi màu nhấn trong bảng có L ≥ 0.64 để chữ tối
  này đạt tương phản ≥ 4.5:1; `/ui-kit` hiển thị tỉ lệ tương phản đo được cho từng game để kiểm.

Utility Tailwind: `bg-game-accent`, `text-game-accent`, `border-game-accent`, `bg-game-accent-soft`…

### 3.2. Khối nổi (depth)

- `--game-depth: 4px` (3px dưới `sm`). Nút/thẻ "nổi" dùng `box-shadow: 0 var(--game-depth) 0 var(--game-accent-strong)`
  (đáy đậm) + một bóng mềm nhỏ. Khi `:active`: `translateY(var(--game-depth))` và đáy về 0.
- Bo góc: thẻ `--radius-game-card: 1.25rem`, nút dạng viên thuốc (`rounded-full`) hoặc `1rem` cho nút vuông.
- Nền trang: giữ gradient tối tím hiện tại (`game-shell`), thêm một vầng sáng `--game-accent` 12 % ở góc trên và hoạ tiết
  chấm rất nhẹ (CSS `radial-gradient`, không ảnh).

### 3.3. Chữ và số

- Tiêu đề: `font-heading` (Bricolage Grotesque đã nạp qua `--font-display`), đậm 800, `tracking-tight`.
- Số (điểm, đếm ngược, số người): `@number-flow/react`, `tabular-nums`.

### 3.4. Chuyển động

`src/components/game-ui/motion.ts` xuất preset `motion` dùng chung:

| Preset | Dùng cho | Giá trị |
|---|---|---|
| `press` | nút | spring `stiffness 600, damping 30` |
| `pop` | xuất hiện (badge, toast, chip) | scale 0.9 → 1, spring `stiffness 420, damping 24` |
| `turn` | đến lượt | viền sáng chạy + scale 1.02 lặp |
| `win` | ăn mừng | banner trượt xuống + confetti màu `--game-accent` |

Mọi chuyển động tôn trọng `prefers-reduced-motion` (`useReducedMotion` của `motion` + `motion-safe:` trong CSS): khi
bật thì chỉ đổi màu/độ mờ, không di chuyển.

### 3.5. Sáng/tối

Token có giá trị cho cả `.dark` và sáng (dùng `next-themes` sẵn có). Bàn chơi giữ nền tối như hiện nay; tương phản chữ
≥ 4.5:1 ở cả hai chế độ.

## 4. Phần B — Bộ component `src/components/game-ui/`

Mỗi component một file, `"use client"` khi cần, props có type rõ ràng, không phụ thuộc lẫn nhau ngoài `motion.ts` và
`cn`. Bọc primitive Base UI qua các file shadcn trong `components/ui/` (thêm bằng `npx shadcn add`).

Component shadcn cần thêm vào `components/ui/`: `dialog`, `drawer` (vaul), `tabs`, `tooltip`, `popover`, `badge`,
`avatar`, `progress`, `scroll-area`.

| Component | API chính | Thay cho |
|---|---|---|
| `GameButton` | `variant: "primary" \| "secondary" \| "danger" \| "ghost"`, `size: "sm" \| "md" \| "lg"`, `confirm?: ReactNode` (bật chế độ bấm 2 lần, reset sau 3.5 s như `ConfirmButton`), `asChild`-tương đương qua `render` của Base UI, `loading?` | `<button>` tự viết, `ConfirmButton` |
| `GamePanel` | `title?`, `icon?`, `actions?`, `tone?: "default" \| "accent"`, `children` | khung kính/thẻ tự viết |
| `GameDialog` | `open`, `onOpenChange`, `title`, `description?`, `children`, `footer?`; ≥ `md` là `Dialog` giữa màn hình, < `md` là `Drawer` kéo từ dưới (hook `useIsMobile` theo `matchMedia("(max-width: 767px)")`) | modal `fixed inset-0` |
| `GameBadge` | `tone: "accent" \| "success" \| "warning" \| "danger" \| "neutral"`, `pulse?` | pill trạng thái |
| `SeatChip` | `name`, `profile` (icon + màu, như `PlayerAvatar`), `points?`, `online`, `isTurn`, `isHost`, `isYou`, `out?`, `size` | `PlayerAvatar`/`SeatAvatar` + `TurnRing`; mỗi game tự làm chip |
| `GameTabs` | `tabs: { id, label, content }[]`, `light?` (giữ API của `SettingsTabs`) | `SettingsTabs` |
| `Countdown` | `deadline` (giờ local), `total`, `size`; vòng tiến trình SVG, chuyển màu cảnh báo khi ≤ 25 % | đếm ngược lượt mỗi game |
| `Celebration` | giữ nguyên props và logic chống phát lại của `WinCelebration` (`playing`, `show`, `won`, `title`) | `WinCelebration` |
| `gameToast` | wrapper `sonner` có style game (`success`, `error`, `info`) | toast rời rạc |

Hiệu ứng copy vào `src/components/game-ui/effects/` (ghi nguồn + license MIT ở đầu file): `BorderBeam` (viền sáng
chạy — dùng cho `SeatChip` khi đến lượt), `ShineButton` overlay (ánh lên trên `GameButton` primary), và không thêm số
nảy riêng (đã có `number-flow`).

`ConfirmButton`, `WinCelebration`, `TurnIndicator` (`TurnRing`, `MyTurnBadge`), `PlayerAvatar` (`SeatAvatar`),
`SettingsTabs` **được giữ lại làm lớp mỏng** gọi sang component mới (cùng tên, cùng props) để các bàn chơi chưa sửa
vẫn dùng được; xoá dần ở phần 3.

### Logic thuần (để test bằng vitest, môi trường node)

`src/components/game-ui/logic.ts`:

- `confirmStep(armed: boolean)` → `{ fire: boolean; armed: boolean }` (máy trạng thái của nút xác nhận 2 lần).
- `countdownState(deadline: number, total: number, now: number)` → `{ remainingMs, fraction, urgent }`
  (`fraction` kẹp 0..1, `urgent` khi `fraction ≤ 0.25`).

## 5. Áp vào lớp dùng chung (PR 2)

Viết lại bằng `game-ui`, **giữ nguyên export và props** (các bàn chơi không phải sửa):

- `GamesShell`: `data-game`, nền mới, thanh trên cùng, cổng nhập tên (dùng `GamePanel`, `GameButton`), footer.
- `GameHeader`: nút ← Sảnh, mã phòng, nút mời, menu "⋯" trên điện thoại (dùng `GameDialog`/dropdown có sẵn).
- `GameLobby`: tạo/vào phòng, danh sách bàn (`GamePanel`, `GameBadge`, `SeatChip` thu nhỏ), bảng xếp hạng.
- `ChatBox`: nút nổi + bảng chat (Drawer trên điện thoại).
- `AllRoomsPanel`, `RankPointsPicker`: dùng `GamePanel`/`GameButton`.
- Lớp mỏng tương thích: `ConfirmButton`, `WinCelebration`, `TurnIndicator`, `PlayerAvatar`, `SettingsTabs`.

## 6. Phần C — Triển khai và kiểm tra

### Thứ tự PR (vào `develop`)

1. **PR 1 — token + `game-ui` + trang xem trước.** `globals.css`, `src/components/game-ui/*`, component shadcn thêm,
   `vaul`, trang `/ui-kit` (chỉ khi `process.env.NODE_ENV !== "production"`, ngược lại `notFound()`; `robots: noindex`).
   Trang này hiện mọi component × biến thể × kích thước, sáng/tối, và bộ chọn `data-game` để đổi màu nhấn. Không đụng UI
   thật.
2. **PR 2 — lớp dùng chung** (mục 5).
3. Release `develop` → `main` (Vercel + `play.fudio101.com` tự deploy).

### Kiểm tra

- **Unit (vitest, node):** `logic.test.ts` cho `confirmStep`, `countdownState`.
- **Hình ảnh:** script Playwright theo `GAMES_GUIDE.md` §7.2 (`playwright-core` ở thư mục tạm, Edge), chụp ở
  375 / 768 / 1280 px × sáng/tối: `/ui-kit` (PR 1); trang chủ, sảnh 7 game, một bàn đang chơi với be_game chạy local
  (PR 2) — **trước và sau**, đính kèm PR.
- **Điện thoại:** vùng chạm ≥ 44 px cho mọi `GameButton` `md`/`lg` (kiểm bằng script đo bounding box trên `/ui-kit`),
  `GameDialog` thành Drawer ở 375 px, không tràn ngang (`scrollWidth ≤ innerWidth`). Người dùng thử thật trên preview
  Vercel của PR.
- **Truy cập:** điều khiển bằng bàn phím, có focus ring, `prefers-reduced-motion` (Playwright `reducedMotion: "reduce"`
  không có chuyển động vị trí).
- **Hiệu năng:** so "First Load JS" trong output `next build` trước/sau; tăng ≤ ~15 KB gzip cho route bàn chơi.
- **Chung:** `npm run lint && npm run typecheck && npm test` và CI xanh trước khi merge.

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Màu nhấn thiếu tương phản ở chế độ sáng | Kiểm tương phản từng màu trong `/ui-kit`; chỉnh L trong bảng 3.1 nếu < 4.5:1 |
| Drawer xung đột với `PinchZoom`/kéo bài trên điện thoại | Drawer chỉ mở khi người dùng bấm; kiểm trong ảnh chụp bàn đang chơi |
| Lớp mỏng tương thích làm bàn chơi trông lẫn cũ/mới | Chấp nhận trong giai đoạn chuyển tiếp; phần 3 xử lý từng bàn |
| Base UI khác API Radix (`render` thay `asChild`) | Theo đúng các file shadcn `base-nova` đã sinh trong repo |
