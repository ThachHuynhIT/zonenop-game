# Hướng dẫn frontend các game online

Tài liệu này dành cho người (hoặc AI) cần **sửa giao diện một game mà không phải đọc hết mã nguồn**. Nó nói về phần frontend trong repo này (zonenop-game — site games, tách ra từ repo portfolio).

**Luật chơi, state và protocol của từng game không được viết lại ở đây.** Nguồn sự thật là backend be_game:
- Tổng quan backend: `be_game/docs/GUIDE.md`
- Từng game: `be_game/docs/games/<id>.md`, với `<id>` là `tienlen`, `meono`, `typhu`, `splendor`, `bang`, `cangua`, `oanquan`

Đường dẫn trong tài liệu tính từ gốc repo này. Số dòng chỉ để tham khảo vì code thay đổi, nên hãy tìm theo tên.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Khung games (shell)](#2-khung-games-shell)
3. [Component dùng chung](#3-component-dùng-chung)
4. [Từng game](#4-từng-game)
5. [Quy ước responsive](#5-quy-ước-responsive)
6. [Ảnh lá bài](#6-ảnh-lá-bài-card-art-pipeline)
7. [Kiểm thử UI](#7-kiểm-thử-ui)
8. [Thêm một game mới](#8-thêm-một-game-mới-frontend-checklist)
9. [Bẫy thường gặp](#9-bẫy-thường-gặp)

---

## 1. Tổng quan

### 1.1. Các game và route

| `id` | Tên | Lobby → bàn | Thư mục UI | Bản sao lib | WS path | Số ghế tối đa |
|---|---|---|---|---|---|---|
| `tienlen` | Tiến Lên Miền Nam | `/tien-len` → `/tien-len/[room]` | `src/components/tienlen/` | `src/lib/tienlen/` | `/api/ws` | 4 |
| `meono` | Mèo Nổ | `/meo-no` → `/meo-no/[room]` | `src/components/meono/` | `src/lib/meono/` | `/api/meono/ws` | 7 |
| `typhu` | Cờ Tỷ Phú | `/co-ty-phu` → `/co-ty-phu/[room]` | `src/components/typhu/` | `src/lib/typhu/` | `/api/typhu/ws` | 6 |
| `splendor` | Đá Quý (Splendor) | `/splendor` → `/splendor/[room]` | `src/components/splendor/` | `src/lib/splendor/` | `/api/splendor/ws` | 4 |
| `bang` | Đấu Súng (Bang!) | `/bang` → `/bang/[room]` | `src/components/bang/` | `src/lib/bang/` | `/api/bang/ws` | 8 |
| `oanquan` | Ô Ăn Quan | `/o-an-quan` → `/o-an-quan/[room]` | `src/components/oanquan/` | `src/lib/oanquan/` | `/api/oanquan/ws` | 2–4 |
| `cangua` | Cờ Cá Ngựa | `/co-ca-ngua` → `/co-ca-ngua/[room]` | `src/components/cangua/` | `src/lib/cangua/` | `/api/cangua/ws` | 4 |

Một số đường dẫn khác:
- **`/`** là trang hub. Nội dung các thẻ game (tagline, số người) được viết cứng trong `src/app/page.tsx`. Trang này có cả thẻ `/contra`.
- **`/contra`** là game canvas offline (`src/components/game/ContraGame.tsx`, nạp bằng `dynamic(..., { ssr: false })`). Nó **không** nằm trong khung games: không có `layout.tsx` với `GamesShell` và không có trong `ONLINE_GAMES`. Tài liệu này không nói thêm về Contra.
- Mỗi bàn có thể mở ở chế độ xem bằng `?watch=1`, ví dụ `/meo-no/ABCDE?watch=1`.

Mỗi route game có ba file:

| File | Vai trò |
|---|---|
| `src/app/<route>/layout.tsx` | `metadata`, rồi `<div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(...)] text-...">` bọc `<GamesShell>`. Màu nền của từng game nằm ở đây. |
| `src/app/<route>/page.tsx` | Lobby (`"use client"`), render `<GameLobby …/>` |
| `src/app/<route>/[room]/page.tsx` | Bàn chơi (`"use client"`), mô tả bên dưới |

Mọi `[room]/page.tsx` đều theo cùng một mẫu:

```tsx
const MeoTable = dynamic(() => import("@/components/meono/MeoTable"), {
  ssr: false,
  loading: () => <p className="animate-pulse pt-32 text-center text-orange-100/70">Đang tải bàn chơi…</p>,
});

/** The games layout (GamesShell) only renders this once the player has a name. */
export default function MeoNoRoomPage({ params }: { params: { room: string } }) {
  const code = decodeURIComponent(params.room).toUpperCase();
  const watch = useSearchParams().get("watch") === "1";
  // Frozen for this table: renaming in the top bar must not re-join the room mid-game.
  const [name] = useState(getSavedName);
  return <MeoTable code={code} name={name} watch={watch} />;
}
```

### 1.2. Frontend nói chuyện với be_game thế nào

Toàn bộ phần kết nối nằm trong `src/components/games/gameClient.ts`.

**Server URL.** `serverBase()` lấy `process.env.NEXT_PUBLIC_TIENLEN_SERVER_URL`; nếu không đặt thì dùng `http://localhost:4000`. Dấu `/` cuối bị bỏ. URL WebSocket là URL đó với `http` đổi thành `ws`, rồi nối thêm path. Biến này là `NEXT_PUBLIC_`, nên giá trị được gắn vào bundle lúc build. Đổi biến thì phải build lại. Xem `.env.example`.

**REST.** `fetchApi<T>(path)` gửi `GET serverBase()+path` với `cache: "no-store"`. Hai nơi dùng nó:
- `GameLobby` lấy `/api${apiPrefix}/rooms` (5 giây một lần) và `/api${apiPrefix}/leaderboard?limit=20`.
- `AllRoomsPanel` lấy `roomsPath` của mọi game (10 giây một lần).

**Tạo phòng.** `createGameRoom(wsPath)` mở một kết nối ngắn, gửi `{type:"create"}`, nhận `ack.code`, rồi đóng kết nối. `GameLobby` sau đó `router.push(`${basePath}/${code}`)`.

**Vào bàn.** Hook chính là `useGameRoom<V>(wsPath, code, name, mode = "play" | "watch", localize?)`. Nó trả về `{ view, status, error, call }`:

| Trả về | Ý nghĩa |
|---|---|
| `view: V \| null` | View mới nhất server gửi (`{type:"state", view}`), đã qua `localize`. Server là nguồn sự thật, client không giữ state game riêng. |
| `status` | `"connecting" \| "joined" \| "reconnecting" \| "error"` |
| `error` | Lỗi từ ack của `join`/`watch` (ví dụ "Không tìm thấy phòng", phòng đã đủ người…). Khi lỗi chứa chữ "đủ", các bàn hiện link "Vào xem 👀" sang `?watch=1`. |
| `call(msg)` | Gửi `{...msg, id}` rồi trả về `Promise<Ack>`, với `Ack = {ok:true, code?} \| {ok:false, error}`. Promise **không bao giờ reject**: hết 10 giây thì trả `"Máy chủ không phản hồi"`, mất kết nối thì trả `"Mất kết nối máy chủ"`. |

Cách hook hoạt động:
- **Chỉ kết nối khi `name` khác rỗng.** Effect phụ thuộc `[wsPath, code, name, mode]`. Vì vậy trang bàn đóng băng tên lúc mount (xem §9).
- **Join.** Mở socket, chờ `open` (tối đa 10 giây), rồi gửi `{type: mode === "watch" ? "watch" : "join", code, name, token}`.
- **Token ghế.** Lấy từ `getToken()`, lưu ở **`sessionStorage["tienlen:token"]`** chứ không phải localStorage. Nhờ vậy reload vẫn giữ ghế, còn mỗi tab là một người chơi khác nhau. Nếu storage bị chặn, token chỉ nằm trong bộ nhớ.
- **Ping.** Gửi `{type:"ping"}` mỗi 10 giây (`PING_INTERVAL_MS`). Ping cũng là heartbeat báo người chơi còn online; server trả `pong`.
- **Reconnect.** Khi socket đóng, `status` thành `"reconnecting"` và hook thử lại với backoff `min(500·2^n, 8000)` ms. Tab được focus lại (`visibilitychange`) hoặc mạng có lại (`online`) thì nó thử ngay.
- **Chuyển kết nối theo kế hoạch.** Server gửi `{type:"reconnect"}` trước khi Vercel function hết thời gian. Hook mở kênh mới và join xong rồi mới đóng kênh cũ, nên người chơi không thấy mất kết nối.
- **Unmount.** Gửi `{type:"leave"}` (timeout 1,5 giây), rồi đóng socket.
- **`localize(view)`.** Tham số tùy chọn để dời các deadline từ giờ server sang giờ máy client. Hàm được giữ trong ref, nên truyền hàm mới mỗi render cũng không kết nối lại. Mẫu chung trong các bàn:
  ```ts
  // splendor/SplendorTable.tsx (Cá Ngựa, Ô Ăn Quan giống hệt)
  function localize(view: SPRoomView): SPRoomView {
    const g = view.current;
    if (!g?.deadline) return view;
    const skew = Date.now() - view.serverTime;
    return { ...view, current: { ...g, deadline: g.deadline + skew } };
  }
  ```
  Mỗi game dời những trường khác nhau:
  - Tỷ Phú: `deadline`, `endsAt`, `trade.deadline`
  - Mèo Nổ: `turnDeadline`, `pending.deadline`, `choice.deadline`
  - Bang dùng `makeLocalize()`. Hàm này giữ skew cố định và chỉ đo lại khi lệch quá 1500 ms, để `promptKey` không dao động làm mất lựa chọn đang chọn.

**Tên người chơi.** Mọi game dùng chung một tên, lưu ở `localStorage["games:playerName"]` (`PLAYER_NAME_KEY`). Key cũ `tienlen:name` được chuyển sang key mới ở lần đọc đầu.

| API | Dùng để |
|---|---|
| `getSavedName()` | Đọc đồng bộ, có cache |
| `saveName(name)` | Lưu và báo cho mọi listener |
| `usePlayerName()` | Đọc tên qua `useSyncExternalStore`. Trả `null` khi đang SSR hoặc chưa đọc, `""` khi chưa có tên. Có lắng nghe sự kiện `storage`, nên đổi tên ở tab khác cũng cập nhật. |

`MAX_NAME_LENGTH = 16` lấy từ `@/lib/tienlen`.

**Lệnh dùng chung cho mọi game.** Các lệnh `chat {text}` và `emoji {emoji}` do hub be_game xử lý chung, có cooldown. `kick {playerId}`, `settings {...}` và `start` có ở hầu hết game. Các lệnh riêng của từng game nằm trong mục 4 và trong `be_game/docs/games/<id>.md`.

### 1.3. Chạy local

Cấu hình preview nằm trong `D:\WorkSpace\.claude\launch.json` (ở thư mục cha, không phải trong repo):

| Config | Lệnh | Cổng |
|---|---|---|
| (chưa có config riêng) | `npm run dev` trong thư mục repo zonenop-game | 3000 |
| `"be_game"` | `npm --prefix D:/WorkSpace/be_game run dev` (`tsx watch src/local.ts`) | 4000 |

- be_game chạy local **không cần Redis**. Không có `REDIS_URL` thì nó dùng store trong bộ nhớ, và log báo `rooms: memory`.
- Portfolio mặc định kết nối `http://localhost:4000`.
- Để test trên điện thoại cùng mạng Wi-Fi, đặt `NEXT_PUBLIC_TIENLEN_SERVER_URL=http://<ip-máy>:4000` rồi khởi động lại `npm run dev`. be_game nghe ở `0.0.0.0`.

---

## 2. Khung games (shell)

### 2.1. `gamesRegistry.ts`

`src/components/games/gamesRegistry.ts` là nơi khai báo danh sách game cho khung games.

```ts
interface OnlineGame {
  id: "tienlen" | "meono" | "typhu" | "splendor" | "bang" | "cangua" | "oanquan";
  title: string;      // tên đầy đủ (title của tab)
  short: string;      // nhãn ngắn cho tab và dòng bàn
  emoji: string;
  href: string;       // route lobby; bàn ở `${href}/${code}`
  roomsPath: string;  // endpoint danh sách bàn trên be_game
  maxPlayers: number;
}
export const ONLINE_GAMES: readonly OnlineGame[]; // thứ tự = thứ tự tab
```

Các helper:

| Export | Ý nghĩa |
|---|---|
| `GAMES_ROUTE_PREFIXES` | `["/", ...ONLINE_GAMES.map(g => g.href)]` |
| `isGamesRoute(pathname)` | Trang có nằm trong khung games không. Khớp `prefix` hoặc `prefix/...`. |
| `gameOfPath(pathname)` | `OnlineGame` của trang, hoặc `null` (hub) |
| `gamesPageKind(pathname)` | `"hub"` (`/`), `"lobby"` (đúng `href`) hoặc `"table"` (`href/<code>`) |

### 2.2. `GamesShell.tsx`

`GamesShell({ children })` được mount trong `layout.tsx` của mỗi route game và trong `src/app/page.tsx` (hub `/`).

**Thanh trên (`GamesTopBar`)**, theo thứ tự trái sang phải:
1. Logo 🎮 "Games", link tới `/` (hub).
2. Các tab game lấy từ `ONLINE_GAMES`.
   - Ở trang bàn (`compact`), tab chỉ có icon và chỉ hiện từ `lg`.
   - Ở hub và lobby, tab của game hiện tại có nhãn từ `sm`; mọi tab có nhãn từ `xl`.
3. **Ô portal** `<div id="games-header-slot">` (`GAME_HEADER_SLOT_ID`), **chỉ có ở trang bàn**. `GameHeader` của bàn được đưa vào đây.
4. `FullscreenButton`.
5. Nút người chơi: `PlayerAvatar` (icon + màu đã chọn, hoặc chữ cái đầu) và tên, bấm vào để đổi tên / biểu tượng. Ở trang bàn, chữ tên chỉ hiện từ `xl`.
6. Link "↩ Trang chính".

Ở trang bàn, thanh trên là `relative`, cao `h-9`, và cao `h-11` trên điện thoại (`max-sm:` và `short:`). Ở hub và lobby, nó `sticky top-0 h-12`.

**Cổng chọn tên.**
- Khi `usePlayerName()` còn là `null` (SSR hoặc first paint): trang bàn chưa render gì; hub và lobby render `children` trong `invisible` để giữ markup SSR.
- Khi tên là `""`: hiện `NameGate`, một form "Chào mừng tới Games!" có ô tên và `ProfilePicker` (icon + màu), gọi `saveProfile` rồi `saveName`.
- **Bàn chơi chỉ được render khi đã có tên**, nên `getSavedName()` trong `[room]/page.tsx` luôn trả về tên hợp lệ.

**Hub và lobby.**
- Bố cục grid `xl:grid-cols-[minmax(0,1fr)_21rem]`.
- Cột phải là `<AllRoomsPanel currentGame={game?.id} />`, sticky từ `xl`. Dưới `xl` panel nằm dưới nội dung.
- Có `GamesFooter`.

**Trang bàn.**
- Không có footer và không có `AllRoomsPanel`.
- Khối bọc ngoài có class `games-shell-table`. Khối body có class `games-table` và đặt lại `--games-bar-h` khi thanh trên cao hơn: `max-sm:[--games-bar-h:calc(2.75rem_+_1px)] short:[--games-bar-h:calc(2.75rem_+_1px)]`.

**Đổi tên và biểu tượng.**
- `RenameDialog` ("Đổi tên & biểu tượng") hỗ trợ Esc, bấm nền để đóng, và hai nút Huỷ / Lưu; nó có cả `ProfilePicker`. Nút Lưu bật khi tên **hoặc** icon / màu đổi.
- Ở trang bàn, dialog ghi chú rằng bàn hiện tại vẫn giữ tên cũ, **nhưng icon và màu đổi ngay** (xem §3.11).
- Component con mở dialog qua `useGamesShell().openRename()`. `GameLobby` dùng cách này.

### 2.3. CSS trong `src/app/globals.css`

```css
@custom-variant short (@media (orientation: landscape) and (max-height: 500px));

.game-shell {                 /* class gốc trong mỗi layout.tsx của game */
  touch-action: manipulation;           /* không zoom khi chạm đúp */
  -webkit-tap-highlight-color: transparent;
  padding-left: env(safe-area-inset-left);   /* tai thỏ khi xoay ngang (viewportFit: "cover" ở root layout) */
  padding-right: env(safe-area-inset-right);
}
.games-shell-table { --games-bar-h: calc(2.25rem + 1px); }   /* thanh h-9 + 1px viền */
.games-table > :first-child { min-height: calc(100dvh - var(--games-bar-h)); }
@supports (-webkit-touch-callout: none) {   /* iOS: input 16px để không tự zoom */
  .game-shell input, .game-shell select, .game-shell textarea { font-size: max(16px, 1em); }
}
```

- Rule `.games-table > :first-child` nằm ngoài layer của Tailwind, nên nó thắng `min-h-[100dvh]` ở phần tử gốc của bàn. Nhờ vậy bàn cao đúng một màn hình trừ thanh trên.
- Bàn nào muốn **cao đúng** một màn hình thì tự dùng biến này. Ví dụ Mèo Nổ: `h-[calc(100dvh-var(--games-bar-h,0px))] overflow-hidden`.

### 2.4. Theme luôn tối

- Mọi route đều là game: wrapper của từng route (`layout.tsx` mỗi game, `src/app/page.tsx` cho hub) đặt nền tối và `text-white` cứng, nên giao diện game không phụ thuộc theme sáng/tối của `next-themes` ở root layout.
- **Không thêm class `dark:`/`light:`** trong cây component của game.

### 3.1. `GameHeader` (`games/GameHeader.tsx`)

Header riêng của một bàn: "← Sảnh", mã phòng, nút mời, bảng điểm, luật… Header **không** chiếm một hàng riêng. Nó được `createPortal` vào ô `#games-header-slot` trên thanh của `GamesShell`. Nếu trang không có ô đó (bàn render ngoài shell), header render tại chỗ.

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `primary` | `ReactNode` | Luôn hiện, thường là link "← Sảnh" và mã phòng |
| `extra?` | `ReactNode` | Hiện inline từ `sm`. Dưới `sm`, gom vào menu "⋯" (`MoreMenu`, đóng khi bấm ra ngoài hoặc bấm một mục). |
| `status?` | `ReactNode` | Đẩy sang phải (`ml-auto`): 👀 số khán giả, "Đang kết nối lại…", đồng hồ… |

Các export đi kèm:
- **`headerBtn`**: chuỗi class chuẩn cho nút hoặc link trong header. Trên điện thoại (`max-sm:` và `short:`) nút có `min-h-9 min-w-9`.
- **`HeaderLabel`**: chữ của một nút trong `extra`. Chữ hiện trong menu "⋯" trên điện thoại và từ `lg`; ở khoảng `sm`–`lg` chỉ còn icon. Vì vậy nhớ đặt `title` cho nút.
- **`FullscreenButton({className?})`**: tự ẩn khi trình duyệt không hỗ trợ (iPhone Safari). `GamesShell` đã gắn sẵn nút này.
- **`GAME_HEADER_SLOT_ID`** = `"games-header-slot"`.
- `MoreMenu` là component nội bộ, không export.

```tsx
<GameHeader
  primary={
    <>
      <Link href="/splendor" className={headerBtn}>← Sảnh</Link>
      <span className="font-mono font-bold tracking-[0.2em] text-amber-300">{view.code}</span>
    </>
  }
  extra={
    <>
      <button onClick={copyInvite} className={headerBtn} title="Chép link mời">🔗 <HeaderLabel>Mời</HeaderLabel></button>
      <button onClick={() => setShowScores(true)} className={headerBtn} title="Bảng điểm">🏆 <HeaderLabel>Bảng điểm</HeaderLabel></button>
    </>
  }
  status={reconnecting && <span className="animate-pulse">Đang kết nối lại…</span>}
/>
```

### 3.2. `ChatBox` (`games/ChatBox.tsx`)

Chat nổi ở góc dưới phải (`fixed`, `z-40`, tính cả safe-area) cho cả người chơi và khán giả. Có:
- huy hiệu số tin chưa đọc;
- bong bóng xem trước tin mới trong 3,5 giây khi chat đang đóng.

Cửa sổ chat cao `min(26rem, 65dvh)`, và cao `100dvh - 4.5rem` khi `short:`.

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `messages?` | `ChatMessage[]` | `view.chat`. Mặc định `[]`. |
| `meId` | `string` | `view.meId`. Khán giả có `meId` rỗng. |
| `myName?` | `string` | Dùng để nhận ra tin của chính khán giả (họ không có `playerId`) |
| `onSend` | `(text) => Promise<boolean>` | Trả `true` thì ô nhập được xoá. Độ dài tối đa là `CHAT_MAX_LENGTH` (200). |
| `onEmoji?` | `(emoji) => void` | Có prop này thì hiện nút 😀 với bảng `EMOJIS` (từ `@/lib/tienlen`) |
| `row?` | `boolean` | Đặt nút 😀 **bên trái** nút 💬 thay vì bên trên, để cặp nút chỉ cao bằng một nút |

```tsx
<ChatBox
  messages={view.chat}
  meId={view.meId}
  myName={name}
  onSend={(text) => act({ type: "chat", text })}
  onEmoji={(emoji) => void act({ type: "emoji", emoji })}
  row
/>
```

`ChatBox` được render **ngoài** `Table`, làm anh em với nó. Bố cục bàn phải chừa chỗ cho cụm nút này (§5.4).

### 3.3. `TurnIndicator.tsx`

| Export | Props | Ghi chú |
|---|---|---|
| `TurnRing` | `active: boolean`, `className?` | Viền hồng-cam nhấp nháy (`motion-safe:animate-pulse`), `absolute -inset-1.5`. Phần tử cha phải `relative`. Truyền `className="inset-0"` để viền khít, hoặc đổi bo góc, ví dụ `rounded-[2rem]`. |
| `MyTurnBadge` | `className?`, `children = "Lượt của bạn"` | Nhãn có `role="status"` |
| `TurnTimerBorder` | `deadline: number \| null`, `totalMs`, `now`, `radius = 16` | Đường đếm ngược chạy quanh viền phần tử cha (SVG, đo kích thước bằng `ResizeObserver`). Số giây hiện ở góc trên phải, chuyển đỏ khi còn ≤ 5 giây. Cha phải `relative`. `now` lấy từ một hook `useNow` trong bàn. |

```tsx
<div className="relative rounded-2xl p-3">
  <TurnTimerBorder deadline={g.deadline} totalMs={turnSeconds * 1000} now={now} />
  <TurnRing active={myTurn} className="inset-0" />
  {myTurn && <MyTurnBadge />}
  …
</div>
```

### 3.4. `SettingsTabs` (`games/SettingsTabs.tsx`)

Hộp có tab cho phần cài đặt ở phòng chờ, mỗi lúc chỉ hiện một nhóm.

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `tabs` | `{ id: string; label: string; content: ReactNode }[]` | Tab đầu tiên được mở mặc định |
| `className?` | `string` | |
| `light?` | `boolean` | Bảng màu cho nền sáng (emerald). Chỉ Tỷ Phú dùng, vì giữa bàn cờ nền sáng. |

```tsx
<SettingsTabs
  className="mb-3"
  tabs={[
    { id: "rules", label: "🐴 Luật", content: <Toggle … /> },
    { id: "time", label: "⏱️ Lượt", content: <select … /> },
    { id: "points", label: "🏆 Điểm", content: <RankPointsPicker … /> },
  ]}
/>
```

### 3.5. `RankPointsPicker` (`games/RankPointsPicker.tsx`)

Chủ bàn chọn điểm cho hạng Nhất và Nhì. Các hạng còn lại được tính đối xứng để tổng điểm bằng 0, bằng `mirroredRankPoints` từ `@/lib/tienlen`. Điểm tối đa là `MAX_RANK_POINTS` (20).

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `first`, `second` | `number` | Giá trị hiện tại |
| `players` | `number` | Số người đang ngồi, để hiện dòng xem trước. Tối thiểu là 2. |
| `editable` | `boolean` | Thường là `me.isHost && view.role === "player"` |
| `onChange` | `(v: {first?, second?}) => void` | Thường là `(v) => act({ type: "settings", ...v })`. Khi đổi `first`, `second` bị kẹp lại cho ≤ `first`. |
| `className?` | `string` | Ví dụ Tỷ Phú: `"[&_select]:bg-white [&_select]:text-emerald-950"` |

### 3.6. `DraggableHand.tsx`: `useHandOrder` và `DraggableRow`

Cho người chơi tự xếp bài trên tay. Thứ tự **chỉ lưu ở `sessionStorage`** của trình duyệt, server không biết gì về nó.

**`useHandOrder<K>(defaultOrder: K[], storageKey: string | null)`** trả về `{ ordered, isCustom, move(from,to), setOrder(next), reset() }`.
- Khi chưa kéo thẻ nào, `ordered` theo `defaultOrder`.
- Sau khi đã kéo: thẻ mới được thêm vào cuối, thẻ đã rời tay bị bỏ khỏi danh sách.
- Key mẫu: `` `meono:order:${code}:${meId}` ``. Truyền `null` cho khán giả, để không lưu.

**`DraggableRow<K>`** là một hàng thẻ kéo ngang để đổi chỗ. Chạm nhanh vẫn tới `onClick` của thẻ (để chọn thẻ); chỉ khi kéo ngang quá 8 px mới tính là kéo. Vuốt dọc vẫn cuộn trang.

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `items` | `K[]` | Thường là `ordered` |
| `onMove` | `(from, to) => void` | Thường là `handOrder.move` |
| `renderItem` | `(key, index) => ReactNode` | |
| `itemStyle?` | `(index) => CSSProperties` | Ví dụ margin âm cho bài chồng lên nhau |
| `disabled?`, `className?` | | |

```tsx
const handOrder = useHandOrder(sortedHand, !spectator && meId ? `tienlen:order:${code}:${meId}` : null);
<DraggableRow
  items={handOrder.ordered}
  onMove={handOrder.move}
  className="[--overlap:-0.42] sm:[--overlap:-0.3]"
  itemStyle={(i) => (i ? { marginLeft: "calc(var(--cw) * var(--overlap))" } : undefined)}
  renderItem={(c) => <PlayingCard card={c} selected={sel.has(c)} onClick={() => toggle(c)} />}
/>
```

### 3.7. `GameLobby` (`games/GameLobby.tsx`)

Sảnh dùng chung cho mọi game. Gồm:
- dòng "Bạn chơi với tên …" kèm nút ✎ Đổi tên;
- nút Tạo bàn mới;
- ô nhập mã bàn (5 ký tự);
- `extra`;
- mục `<details>` "Luật chơi & cách tính điểm";
- danh sách "Bàn đang mở" (5 giây làm mới một lần, có nút Vào chơi / Xem);
- "🏆 Bảng xếp hạng" (top 20).

Bố cục: một cột, rồi `lg:` (và `short:`) chia hai cột `[1fr_1.2fr]`.

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `title`, `tagline`, `icons` | `string` | Phần đầu trang |
| `basePath` | `string` | Route game, ví dụ `"/meo-no"` |
| `wsPath` | `string` | Dùng cho `createGameRoom` |
| `apiPrefix` | `string` | `""` cho Tiến Lên, `"/meono"`, `"/typhu"`… để gọi `/api${apiPrefix}/rooms` và `/leaderboard` |
| `maxPlayers` | `number` | Để biết bàn đã đủ người chưa |
| `rules` | `ReactNode` | Thường là component luật export từ file bàn: `<TyPhuRules/>`, `<SplendorRules/>`, `<BangRules/>`, `<MeoRules/>`, `<CaNguaRules/>`, `<OAnQuanRules/>`. Tiến Lên viết `<ul>` ngay trong page. |
| `extra?` | `ReactNode` | Nội dung dưới form. Mèo Nổ và Bang đặt nút mở hướng dẫn lá bài ở đây. |
| `roomBadges?` | `(room) => ReactNode` | Huy hiệu trên mỗi dòng bàn. Mèo Nổ hiện emoji của `room.expansions`; Bang hiện emoji của `room.packs`. |

```tsx
<GameLobby
  title="Đá Quý" tagline="Lấy đá, mua mỏ…" icons="💎 🪙 👑 🃏"
  basePath="/splendor" wsPath={SPLENDOR_WS_PATH} apiPrefix="/splendor"
  maxPlayers={4} rules={<SplendorRules />}
/>
```

### 3.8. `AllRoomsPanel` (`games/AllRoomsPanel.tsx`)

Danh sách bàn đang mở của **mọi** game, được `GamesShell` gắn ở hub và lobby.
- Lấy `roomsPath` của từng game trong `ONLINE_GAMES` bằng `Promise.allSettled`, 10 giây một lần, và chỉ khi tab đang hiện.
- Game nào lỗi thì giữ danh sách cũ, và ghi "Chưa tải được: …".
- Có chip lọc theo game.
- Thứ tự: bàn của game hiện tại trước, rồi bàn đang chờ trước bàn đang chơi.

Props: `currentGame?: OnlineGame["id"] | null`, `className?`. Danh sách game lấy hoàn toàn từ `ONLINE_GAMES`.

### 3.9. Dùng lại từ `src/components/tienlen/`

**`Effects.tsx`**

Phần reactions (emoji thả lên ghế), mọi game đều dùng:
- `useLiveReactions(view.reactions): Reaction[]` trả về các reaction cần hiện lúc này. Mỗi cái hiện 3000 ms và chỉ một lần. Reaction đã có sẵn khi mới vào bàn bị bỏ qua.
- `SeatBubble({reactions})` là emoji bay lên trên một ghế. Cha phải `relative`. Truyền những reaction có `playerId` của ghế đó.
- `SpectatorReactions({reactions})` là cột các nhãn "👀 tên emoji" ở `absolute right-3 top-16`. Thường truyền reaction không có `playerId` (của khán giả). Nếu bàn không vẽ ghế (phòng chờ), truyền tất cả.

```tsx
const live = useLiveReactions(view.reactions);
<SpectatorReactions reactions={live.filter((r) => !r.playerId)} />
// trong ghế:
<div className="relative"><SeatBubble reactions={live.filter((r) => r.playerId === p.id)} />…</div>
```

Các export chỉ Tiến Lên dùng: `useChopEffect` + `ChopOverlay` + `Shake` (hiệu ứng chặt heo, rung màn hình) và `useBurnEffect` + `BurnOverlay` (chết cháy). `EmojiBar` vẫn được export nhưng **không còn nơi nào dùng**; bảng emoji giờ nằm trong `ChatBox`.

**`Scoreboard.tsx`**
- `ScoreboardModal({ view, onClose, note?, className? })`: bảng điểm của phòng, dựng trên `Sheet`.
  - `view` phải khớp `ScoreboardData` = `{code, meId, seats: ({id,name,points,games,wins}|null)[], history: GameRecord[]}`. RoomView của mọi game đều khớp.
  - `note` mặc định là ghi chú của Tiến Lên. Mỗi game truyền `SCORE_NOTE` của mình.
  - `className` mặc định là bảng màu emerald. Mèo Nổ truyền `"border-orange-200/15 bg-[#1c0f0a] text-orange-50"`; các game khác giữ màu emerald.
- `DeltaBadge({delta})`: nhãn điểm +/−, có cả trong `GameLobby`.
- `signed(n)`, `rankTitle(i, total)`.

**`Sheet.tsx`**: dialog chuẩn, xem §3.10. Tiến Lên (`ScoreboardModal`, `MoveHistory`) và Mèo Nổ (`CardGuide`, `DiscardViewer`) dùng nó.

| Prop | Kiểu | Ý nghĩa |
|---|---|---|
| `title` | `ReactNode` | Đặt trong header cố định, cạnh nút ✕ |
| `label?` | `string` | Tên cho trình đọc màn hình khi `title` không phải chuỗi |
| `onClose` | `() => void` | |
| `className?` | `string` | Màu và độ rộng panel. Mặc định là `max-w-md`. |
| `bodyClassName?` | `string` | Thân dialog mặc định tự cuộn. Truyền class này để tự dàn trang, ví dụ `flex flex-col overflow-hidden` để có phần trên cố định và một danh sách cuộn riêng. |
| `bodyRef?` | `Ref<HTMLDivElement>` | Ví dụ để cuộn xuống cuối, như `MoveHistory` |

`PlayingCard`, `MoveHistory` và `useTienLen` chỉ Tiến Lên dùng.

Ngoài ra, `src/components/games/` còn phụ thuộc `@/lib/tienlen` cho một số hằng: `ChatBox` (`EMOJIS`, `CHAT_MAX_LENGTH`, `ChatMessage`), `GamesShell` (`MAX_NAME_LENGTH`) và `RankPointsPicker` (`MAX_RANK_POINTS`, `mirroredRankPoints`).

### 3.10. Mẫu dialog

Mọi dialog trong game theo cùng một hành vi:
- **Điện thoại:** bottom sheet: `items-end`, `rounded-t-2xl`, `w-full`, `max-h` khoảng 82–88dvh.
- **Từ `sm`:** hộp giữa màn hình: `sm:items-center sm:rounded-2xl sm:p-4`.
- **Nút ✕ cố định** (`size-9`, `aria-label="Đóng"`) nằm **ngoài** vùng cuộn, nên không trôi theo nội dung. Phần thân thêm `[&>h2:first-child]:pr-10` để tiêu đề không bị nút ✕ che.
- **Thanh "Đóng"** rộng hết chiều ngang ở đáy, `sm:hidden`, với `pb-[max(0.75rem,env(safe-area-inset-bottom))]`, để bấm bằng ngón cái.
- **Đóng bằng** Esc (listener `keydown` trên `window`) hoặc bấm nền. Panel gọi `stopPropagation` để bấm bên trong không đóng.
- `role="dialog" aria-modal`. **Chưa có** focus trap và chưa khoá cuộn trang phía sau.

Mỗi game cài đặt riêng mẫu này:

| Game | Component | Vị trí | Ghi chú |
|---|---|---|---|
| Tiến Lên, Mèo Nổ | `Sheet` | `tienlen/Sheet.tsx` | Có header cố định với `title`. Bảng điểm của **mọi** game dùng component này qua `ScoreboardModal`. |
| Tỷ Phú | `Modal({children,onClose,dark?})` | cuối `typhu/TyPhuTable.tsx` | `dark` cho nền `#0c2233`, mặc định là nền giấy sáng `#f4efe1`. `SquareModal` dùng nền sáng. |
| Đá Quý | `Modal({children,onClose})` | cuối `splendor/SplendorTable.tsx` | Thêm `short:max-h-[94dvh] short:max-w-2xl` |
| Đấu Súng | `Sheet({children,onClose,title?,tabs?})` | cuối `bang/Pieces.tsx` | Khác `tienlen/Sheet`: có `tabs` và mặc định `max-w-2xl` |
| Cá Ngựa | `Modal` | cuối `cangua/CaNguaTable.tsx` | Chỉ dùng cho luật |
| Ô Ăn Quan | `Modal` | cuối `oanquan/OAnQuanTable.tsx` | Chỉ dùng cho luật. Có `short:max-w-2xl`. |

Dialog mới thì nên dùng `tienlen/Sheet` hoặc chép `Modal` của game gần nhất, đừng viết từ đầu.

### 3.11. Hồ sơ người chơi: icon và màu (`PlayerAvatar.tsx`, `gameClient.ts`)

Mỗi người chọn một icon (16 lựa chọn, hoặc chữ cái đầu của tên) và một màu (10 màu) ở cổng tên hoặc hộp "Đổi tên & biểu tượng". Mọi người cùng bàn thấy nhau.

**Phía client (`gameClient.ts`)**
- `PlayerProfile = {icon, color}`, `PROFILE_ICONS` (14 biểu tượng mèo ở đầu danh sách: 🐱 🐈 🐈‍⬛ 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🐆 🦁), `PROFILE_COLORS`, `DEFAULT_PROFILE`.
- `getSavedProfile()` / `saveProfile()` / `usePlayerProfile()`: lưu ở `localStorage["games:playerProfile"]`, có đồng bộ giữa các tab (sự kiện `storage`) và kiểm tra giá trị (`validProfile`).
- `useGameRoom` gửi `look: getSavedProfile()` trong `join` / `watch`, và **khi hồ sơ đổi giữa chừng** gửi `{type:"look", look}` qua kết nối đang mở — nên đổi icon / màu có hiệu lực ngay tại bàn, không cần vào lại. Tên thì vẫn đóng băng khi mount.
- Mỗi state view có thể kèm `looks: { [tên]: {icon, color} }` (be_game gắn ở hub, xem `be_game/docs/GUIDE.md`). `useGameRoom` đẩy nó vào một kho module (`setRoomLooks`); đọc bằng `useLookOf(name)` (một người) hoặc `useRoomLooks()` (cả bàn).

**Component (`PlayerAvatar.tsx`)**
- `PlayerAvatar({name, profile, className})`: chip tròn icon trên nền màu (dùng ở thanh trên và bộ chọn).
- **`SeatAvatar({name, className, fallbackClassName, out?})`**: chip ở ghế của một game. Có `look` thì dùng icon + màu của người đó; chưa có (server cũ, hoặc `out`) thì giữ nguyên kiểu cũ của game qua `fallbackClassName`. Game mới nên dùng nó cho mọi chip avatar ở ghế.
- `ProfilePicker({name, value, onChange})`: lưới icon + hàng màu, dùng ở `NameGate` và `RenameDialog`.

Đã gắn `SeatAvatar` ở: Tiến Lên, Mèo Nổ, Ô Ăn Quan, Đá Quý (ghế và danh sách), Đấu Súng và Ô Ăn Quan (danh sách ghế chờ), Cờ Tỷ Phú và Cờ Cá Ngựa (cạnh tên; quân cờ của hai game này là thứ nhận ra người chơi trên bàn nên giữ nguyên). **Cờ Tỷ Phú có riêng** quân cờ + màu nhà chọn trong bàn (`pick`, không được trùng nhau, xem §4.3).

### 3.11b. Hiệu ứng chiến thắng (`WinCelebration.tsx`)

`<WinCelebration show playing won title? />`: lớp phủ `fixed inset-0 z-40 pointer-events-none` (dưới modal), pháo giấy canvas + banner "🏆 Bạn thắng!" cho người thắng; người thua/khán giả chỉ thấy banner nhỏ `title` ("🏆 <tên> thắng"). Chạy ~4 giây rồi mờ dần. `prefers-reduced-motion`: chỉ banner, không canvas. `show` = ván đã kết thúc, `playing` = đang có ván chưa kết thúc; hiệu ứng **chỉ chạy khi component đang mount thấy `playing` chuyển sang `show`**, nên tải lại / vào lại phòng đã có ván kết thúc không chạy lại. Đặt nó trong `Table` của mỗi game (đã gắn ở cả 7 game). Người thắng: Tiến Lên `instantWin.playerId ?? finished[0]`, Mèo Nổ / Cờ Tỷ Phú / Đá Quý / Cờ Cá Ngựa `finished[0]`, Đấu Súng `winners.includes(meId)`, Ô Ăn Quan `rank === 0` và có `winner` (hoà thì chỉ banner "Hoà").

### 3.12. Phím tắt trên máy tính (`useHotkeys.ts`)

`useHotkeys(bindings, enabled = true, allowInDialog = [])` gắn **một** listener `keydown` trên `window`. `bindings` là `{ [key]: handler | undefined }` với `key` là `KeyboardEvent.key` (chữ thường: `"r"`, `" "`, `"Enter"`, `"Escape"`, `"1"`…). Handler lấy bản mới nhất ở mỗi lần bấm (lưu trong ref), nên có thể đóng trên state hiện tại.

Hook **bỏ qua** phím khi:
- đang gõ trong `input`/`textarea`/`select`/`contenteditable` (chat, ô nhập);
- giữ Ctrl / Alt / Meta, hoặc phím lặp (`e.repeat`);
- Space / Enter mà tiêu điểm đang ở một nút / link (trình duyệt đã tự "bấm", nếu xử lý nữa sẽ chạy hai lần);
- có `[role="dialog"]` đang mở — trừ `Escape` và các phím trong `allowInDialog`.

**Quy ước khi thêm phím tắt cho một nút**
1. Handler lặp lại **đúng điều kiện** của nút (lượt mình, đúng phase, không `busy`, nút không `disabled`). Không bao giờ để phím kích hoạt thứ mà nút không cho làm.
2. Phím không thể huỷ (mua, kết thúc lượt, phá sản…) chỉ nên gắn khi nó cũng là nút chính đang hiện.
3. Ghi phím lên nút bằng `<kbd>` với class `hidden … lg:inline [@media(pointer:coarse)]:hidden` (chỉ máy tính, không hiện trên cảm ứng) và thêm một dòng "Phím tắt: …" cùng điều kiện hiển thị.
4. Trước khi thêm, `grep` các listener `keydown` có sẵn trong file (Esc của dialog thường đã có) để không chạy đôi.

Bảng phím của từng game nằm ở mục "Phím tắt" trong §4.

---

## 4. Từng game

Mọi file bàn có chung một khung:
1. Default export `XxxTable({ code, name, watch })` gọi `useGameRoom(..., localize)`. Nó lo toast lỗi (khoảng 2,5 giây), màn hình lỗi và màn hình đang kết nối, rồi render `<Table/>` cùng `<ChatBox/>`.
2. Hàm `act = async (msg) => { const r = await call(msg); if (!r.ok) setToast(r.error); return r.ok; }`.
3. `Table` dựng `GameHeader`, bàn chơi, cột bên (nhật ký "Diễn biến"), các overlay và dialog.
4. Hook `useNow(active, every)` cho đồng hồ đếm ngược.
5. Các thành phần cài đặt luật (`Waiting` / `TableSettings`), component luật và `Modal` ở cuối file.

Nhật ký "Diễn biến" luôn **mới nhất ở trên**: `log.slice().reverse()` render trong một `ul.flex.flex-col` có `overflow-y-auto`.

### 4.1. Tiến Lên Miền Nam

Luật và protocol: `be_game/docs/games/tienlen.md`.

**File map**

| File | Vai trò / component chính |
|---|---|
| `tienlen/TienLenTable.tsx` | Default `TienLenTable`. `Table` là toàn bộ bàn. `sortHand` sắp theo `"rank"` hoặc `"suit"`. `useCountdown(deadline)` tick 250 ms. Các phần còn lại: `ActionButton` (`primary`/`big`); **`TurnRing({deadline})` nội bộ** (vòng conic đếm ngược quanh avatar, khác với `TurnRing` dùng chung, vốn được import với tên `MyTurnRing`); `Avatar`; `StatusTags` (👑, hạng, 🔥 Cháy, Bỏ lượt, Kích…); `Opponent` (ghế đối thủ, có biến thể `vertical`); `SeatBadge` (ghế của mình); `WaitingPanel`; `SettingsPanel`; `scoreNote(settings)`. |
| `tienlen/PlayingCard.tsx` | `PlayingCard({card, selected?, onClick?, size?: "sm"\|"md", className?, style?})` và `CardBack`. Độ rộng lấy từ CSS var `--cw`, `--cw-sm`, `--cw-back`. Thẻ được chọn nhô lên `-translate-y-[28%]`. |
| `tienlen/MoveHistory.tsx` | `MoveHistory({moves,nameOf,meId,onClose})`: một `Sheet` "📜 Lịch sử ván này", gom nước đi theo vòng, tự cuộn xuống cuối. Nút 📜 hiện khi server gửi `game.moves` (be_game ghi ở `GameState.moves`). |
| `tienlen/useTienLen.ts` | `useTienLenRoom(code, name, mode)` bọc `useGameRoom(WS_PATH, …, localizeView)` và trả về các hàm `play`, `pass`, `start`, `sendEmoji`, `kick`, `sendChat`, `setSettings`. Cũng có `inviteLink(code)`. Các re-export `createRoom`, `fetchApi`… trong file không còn ai dùng. |
| `tienlen/Effects.tsx`, `Scoreboard.tsx`, `Sheet.tsx` | Xem §3.9 |

**Bố cục**
- Phần tử gốc: `max-w-5xl`. Kích thước bài **co theo cả chiều rộng lẫn chiều cao viewport** qua CSS var, không theo breakpoint:
  - `--cw: clamp(44px, min(9.5vw, 13dvh), 96px)`
  - `--cw-sm: clamp(30px, min(6vw, 9dvh), 64px)`
  - `--cw-back: clamp(14px, min(3.2vw, 5dvh), 32px)`
- File chỉ dùng `sm:`, `max-sm:`, `short:` và `pointer-coarse:`. Không có `md:`, `lg:`, `xl:`.
- **Mặt bàn** là grid `grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr]`. Ghế xếp ngược chiều kim đồng hồ tính từ mình: `at(2)` ở trên, `at(3)` bên trái (dọc), `at(1)` bên phải (dọc). Ô giữa hiện nước vừa đánh (bài `size="sm"`) hoặc `WaitingPanel`.
- **Điện thoại dọc:** khu của mình (ghế, nút hành động, bài trên tay, nút "Xếp:") xếp thành cột dưới mặt bàn. Bài chồng nhau với `--overlap: -0.42`, từ `sm` là `-0.3`. `WaitingPanel` nổi `absolute` phủ cả mặt bàn và tự liệt kê người chơi (`sm:hidden`), vì nó che mất ghế bên.
- **`short:`:** khu của mình là grid 2 cột, bài trên tay ở `short:order-last short:col-span-2`. Ghế đối thủ xoay ngang và avatar thu nhỏ. `WaitingPanel` thành 2 cột với `max-h-[50dvh]`.
- **Từ `sm`:** `WaitingPanel` là một thẻ `max-w-xs` ở ô giữa, và `ActionButton big` to hơn.
- Bài còn lại sau ván có `max-sm:pr-[6.5rem]` để tránh nút chat, và ẩn khi `short:`.
- Toast cố định ở trên, ngay dưới `--games-bar-h`.

**Hiệu ứng.** `ChopOverlay` + `Shake` khi chặt (1,4 giây, hoặc 2,2 giây khi chặt heo). `BurnOverlay` khi chết cháy (2,6 giây). Reactions. Vòng đếm ngược conic quanh avatar chuyển đỏ khi còn dưới 8 giây (`TURN_SECONDS = 30`).

**Bản sao lib** (`src/lib/tienlen/`, import qua `@/lib/tienlen` từ `index.ts`):
- `cards.ts`: lá bài là số nguyên 0..51, `rank*4+suit`.
- `combos.ts`: `detectCombo`, `canBeat`, `isChop`, `comboName`.
- `rules.ts`: `INSTANT_WIN_NAMES`, `detectInstantWin`.
- `protocol.ts`: view types, `WS_PATH`, `EMOJIS`, `CHAT_MAX_LENGTH`, `MAX_NAME_LENGTH`, `MAX_RANK_POINTS`, `mirroredRankPoints`.

Client dùng `detectCombo` / `canBeat` để bật hoặc tắt nút Đánh trước khi gửi lệnh, nên các file này phải khớp be_game `src/game/`. Lưu ý thêm: shared shell (`ChatBox`, `GamesShell`, `RankPointsPicker`) cũng phụ thuộc `protocol.ts` này.

**Cài đặt.** `SettingsPanel` nằm trong `WaitingPanel`, chỉ hiện giữa các ván, và chỉ chủ bàn sửa được. Có ba mục: `autoPass` (checkbox), `first` và `second` (hai select tự viết, **không** dùng `RankPointsPicker`), cùng một dòng xem trước tính bằng `tienlenRankPoints`.

**Giới hạn đã biết**
- Kích người dùng `ConfirmButton` dùng chung (bấm 2 lần).
- Nút chép link mời có fallback bằng textarea + `execCommand("copy")` cho trang http, rồi tới `window.prompt`.
- Union `ClientMessage` trong `protocol.ts` thiếu `chat` và `settings`.

**Phím tắt** (`useHotkeys`, bật khi đang chơi và có bài trên tay; mỗi phím lặp lại điều kiện `canPlay` / `canPass` của nút):

| Phím | Việc |
|---|---|
| `D` hoặc `Enter` | ĐÁNH / CHẶT (`Enter` không chạy khi tiêu điểm đang ở một lá bài hoặc nút — dùng `D`) |
| `P` | Bỏ lượt |
| `B` hoặc `Esc` | Bỏ chọn (`Esc` chỉ khi bảng điểm và lịch sử đều đóng, để khỏi chạy cùng listener `Esc` của `Sheet`) |
| `S` | Đổi cách xếp bài (`cycleSort`, rút ra từ nút "Xếp") |
| `Enter` (ở `WaitingPanel`) | Bắt đầu / Ván mới, chỉ chủ bàn và có ≥2 người |

`ActionButton` có prop `hotkey` hiện `<kbd>`; dòng "Phím tắt:" nằm cạnh nút xếp bài.

### 4.2. Mèo Nổ

Luật và protocol: `be_game/docs/games/meono.md`.

**File map**

| File | Vai trò / component chính |
|---|---|
| `meono/MeoTable.tsx` (khoảng 1700 dòng) | Default `MeoTable`, gọi `useGameRoom` trực tiếp. Các hàm phụ: `localize`; `useNow(…, 200)`; `classify(types)` (bản sao luật chọn bài của server: một lá hành động, đôi, bộ ba `named:"hand"`, năm lá khác nhau `named:"discard"`); `groupIdentical`; `COMPACT_KEY = "meono:compactHand"` (localStorage, chế độ gộp lá). **`Board`** là bàn chính. Các component con: `DockBtn({tone})`; `DiscardViewer` (một `Sheet` hai tab "🗂️ Chồng bài" và "🃏 Ai đánh gì"); `Seat` (ghế, vòng thời gian, các tag, chọn làm mục tiêu); `PendingBar` (cửa sổ "Không!" với thanh thời gian co lại); `ChoicePanel` (favor/give, offer, dig, bury, alter, defuse/implode → `insert`); `Waiting` (phòng chờ, kết quả, cài đặt); `BoomOverlay` ("💥 BÙM!", "🧯 PHÙ!", "🚫 KHÔNG!"). |
| `meono/MeoCard.tsx` | `MeoCard({type, selected?, onClick?, size?: "sm"\|"md"\|"lg", faceDown?, className?, tooltip = true})`. Mỗi lá thuộc **một vai trò** (`type CardRole = "bomb"\|"save"\|"attack"\|"info"\|"cat"`) với nhãn và màu trong `ROLES`: Bom 💣 đỏ, Né/cứu 🛡️ xanh lá, Tấn công 🔪 cam, Xem/xếp 🔮 xanh trời, Mèo ghép bộ 🐱 vàng. `ROLE_OF` gán vai trò cho từng loại lá; `roleOf(t)` mặc định trả `"info"`. Mặt lá gồm dải tên màu theo vai trò, rồi art (hoặc emoji lớn), rồi huy hiệu gói mở rộng. `artSrc` dùng `MEO_ART` (§6). |
| `meono/PlayHistory.tsx` | `PlayHistory({plays,nameOf,meId,className?})`: mọi lá đã đánh, mới nhất trước. `EventFeed({log,plays,…})`: timeline "Diễn biến", ghép log với lượt đánh bằng `mergeFeed`. Nội bộ có `CardChip`, `FocusInfo` (bấm vào lá để xem "Khi nào" và tác dụng) và `PlayItem`. |
| `meono/CardGuide.tsx` | `MeoRules()` là luật rút gọn, cũng dùng ở lobby. `CardGuide({enabled?, onClose})` là một `Sheet` `max-w-3xl` "📖 Hướng dẫn Mèo Nổ": chú giải màu vai trò và lá bài theo gói. Gói không dùng ở bàn hiện tại bị làm mờ. Lobby mở nó không có `enabled`, nên mọi gói đều sáng. |

**Bố cục**
- Phần tử gốc **cao đúng một màn hình**: `h-[calc(100dvh-var(--games-bar-h,0px))] overflow-hidden`, `max-w-6xl lg:max-w-[112rem]`. Khu bài trên tay (dock) luôn trong tầm nhìn; phần giữa tự cuộn.
- **Điện thoại dọc:** một cột cuộn. Thứ tự: hàng đối thủ (wrap, căn giữa), vùng giữa (chồng rút có số lá, chồng bỏ, chỉ hướng, `PendingBar` / `ChoicePanel`), rồi feed "Diễn biến" (`h-72`).
  - Bài trên tay **thu gọn được**: một dải lá `!w-11` chồng nhau, nút 🚫 KHÔNG!, nút "▲ Mở bài". Dải tự mở khi tới lượt hoặc khi phải chọn lá.
  - Khi mở, các lá có `max-sm:w-[min(4.1rem,calc((100vw_-_108px)/5))]`, tức 5 lá một hàng và chừa lề phải cho 😀/💬.
- **`short:`:** grid 2 cột `[minmax(0,1fr)_14rem]`, mỗi cột cuộn riêng; cột phải là feed. Bài trên tay cũng thu gọn được, vùng tay cao tối đa `7.5rem`. Nút "🗂️ Gộp lá" và "▼ Thu gọn" chuyển vào hàng nút.
- **`lg:`:** 2 cột `[minmax(0,1fr)_17rem]`. Ghế của mình chuyển từ bàn xuống dock (`hidden … lg:flex`). Dock là grid 3 cột: thông tin | nút | Bỏ chọn. Bài trên tay là một hàng cuộn ngang, lá `lg:w-24`.
- **`2xl:`:** chồng bài, lá trên tay (`2xl:w-28`) và avatar to hơn. `xl:` chỉ được dùng để ẩn tên gói trong header (`sm:max-xl:hidden`).
- Khi không có bài trên tay (khán giả, phòng chờ), có `max-lg:pb-28 lg:pr-16 short:pr-14` để chừa chỗ cho cụm chat.

**Hiệu ứng**
- `BoomOverlay` (framer-motion) chạy khi log mới có tone `boom`, `defuse` hoặc `nope`. Nó tự ẩn bằng timer riêng: 2,4 giây cho boom, 1,5 giây cho các loại khác.
- `PendingBar` co lại theo deadline.
- `TurnTimerBorder` + `TurnRing` + `MyTurnBadge` quanh dock khi tới lượt mình. Vòng thời gian của đối thủ được vẽ inline trong `Seat`, chuyển đỏ khi còn dưới 27% thời gian lượt.
- Ghế đang được chọn làm mục tiêu có `animate-pulse`.

**Bản sao lib** (`src/lib/meono/`)
- `cards.ts`: `CARDS`, `PACKS`, `EXPANSIONS`, `SELECTABLE_PACKS`, `PRESETS`, `PRESET_GROUPS`, `CAT_TYPES`, `TARGETED_TYPES`… Tên lá và màu vai trò đọc từ đây. **Key của `CARDS` cũng là danh sách lá cho script art.**
- `protocol.ts`: `MEONO_WS_PATH`, `DEFAULT_MEO_SETTINGS`, `TURN_SECONDS_OPTIONS`, `NOPE_SECONDS_OPTIONS`, `insertRange` (giống be_game) và các view types.
- `art.ts`: file sinh tự động (§6).

Phải khớp với be_game `src/meono/cards.ts` và `protocol.ts`. `classify()` trong `MeoTable` cũng là bản sao luật của server.

**Cài đặt.** Nằm trong `Waiting`, dùng `SettingsTabs` với ba tab:
- "🎮 Chế độ": nhóm preset (`PRESET_GROUPS`) gửi `settings {preset}`; chế độ Tuỳ chỉnh có checkbox `SELECTABLE_PACKS` gửi `settings {expansions}`.
- "⏱️ Thời gian": `turnSeconds`, `nopeSeconds`.
- "🏆 Điểm": `RankPointsPicker`.

Khi số người nằm ngoài khoảng `minPlayers`–`maxPlayers` của chế độ đang chọn, có cảnh báo.

**Giới hạn đã biết**
- Header không dùng `HeaderLabel`, nên chữ vẫn hiện ở khoảng `sm`–`lg`.
- Chép link mời không có fallback cho trang http.
- Kích dùng `ConfirmButton` dùng chung (bấm 2 lần).
- `MeoCommand` trong `protocol.ts` thiếu `see`, `dig`, `chat` và `settings.preset`.
- `MeoRules` dùng màu chữ emerald của Tiến Lên.

**Phím tắt** (`useHotkeys`, chỉ khi còn sống; nút có `DockBtn hotkey` hiện phím):

| Phím | Việc |
|---|---|
| `D` | Đánh lá / bộ đang chọn (cùng điều kiện `canPlay`) |
| `R` | Rút bài (nút xanh RÚT BÀI, `canDraw`) |
| `N` | "Không!" (`canNope`, không `busy`) |
| `B` hoặc `Esc` | Bỏ chọn bài, mục tiêu và lá gọi tên (`Esc` chỉ khi hướng dẫn, bảng điểm, chồng bỏ đều đóng) |

Các lời nhắc của `ChoicePanel` (xem bài, cho bài, đào, nhét, đổi) **không** có phím vì chưa có thao tác một phím nào rõ ràng và an toàn. Dòng gợi ý phím nằm cuối dòng hướng dẫn dưới dock (`short:hidden`).

### 4.3. Cờ Tỷ Phú

Luật và protocol: `be_game/docs/games/typhu.md`.

**File map.** Tất cả nằm trong một file: `typhu/TyPhuTable.tsx` (khoảng 2500 dòng).

| Component / hàm | Vai trò |
|---|---|
| `TyPhuTable` (default), `Table`, `TableBody` | `Table` chỉ bọc `NowProvider` quanh `TableBody` (gốc bàn). State của `TableBody`: `openSquare`, `picking`, `showLog`, `showTrade`, `showScores`, `showRules`, `showAssets`, `busy`, `cardFx`, `buildFx`, `bankruptFx`. `run()` bọc `act` và bật `busy` trong lúc chờ. Đầu hàm đặt biến module `BOARD = boardOf(g?.map ?? settings.map)` (xem "Bản đồ" bên dưới). |
| **`NowProvider`** + `NowContext`, `useSecondsLeft()`, `NowClock` | Đồng hồ 500 ms nằm trong **context**, không phải state của `TableBody`: chỉ các chỗ hiện đếm ngược (`Centre`, `AssetPanel`, `TradeCard`, đồng hồ ván) render lại mỗi nhịp; cả bàn (ô cờ, dòng người chơi…) không còn render lại 2 lần/giây. Provider render `children` là prop nên React bỏ qua cây con khi chỉ giá trị context đổi. Cần đếm ngược ở chỗ mới → `useSecondsLeft()(deadline)`. |
| `TOKENS` (export), `pieceOfSeat(seat)`, `money(n)` (export), `SQUARE_ICON` | 6 quân khởi đầu (🛵 🐃 🚲 🚤 🐉 🎩). `pieceOfSeat` = `seat.piece` do server gửi, thiếu (server cũ) thì rơi về `TOKENS[seat.color]` — **đừng đọc `seat.piece` trực tiếp**, nó từng làm bàn crash trên server cũ. `money` định dạng `"1.500tr"`. |
| `useWalkingTokens(g)`, `walkPath(...)` | Quân đi từng ô. Mỗi bước `max(60, min(220, 2600/len))` ms. Đi lùi khi bị lùi ≤ 3 ô. Vào tù thì đi tới ô Vào tù (tìm theo `kind === "gotojail"` trên bản đồ hiện tại) rồi nhảy. |
| `cellOf(i, side)` | Chỉ số ô → hàng/cột 1-based trên grid `(side+1)²` với `side` = ô mỗi cạnh (10 / 12 / 14). Ô Khởi hành ở góc dưới phải. |
| **`Cell`** (`memo`), `Building`, `Buildings` | Một ô bàn cờ: dải màu, màu chủ sở hữu, giá, nhãn THẾ CHẤP, quỹ đỗ xe, các quân. Nhà mới có hiệu ứng nảy lên. `Cell` chỉ nhận **dữ liệu nó vẽ** (`CellProps`: `index`, `edge`, `sq`, `deed`, `pot`, `owner`, `here: CellToken[]`, `highlight`, `onOpen`) và `memo` với `sameCell` so từng trường — không so identity vì mỗi state từ server là object mới. Quân đứng trên mỗi ô (kể cả đang đi) do `TableBody` gom vào `hereByPos`. **Mọi thứ ảnh hưởng tới cách vẽ phải nằm trong props** (xem bẫy §9: `edge`). |
| `Die`, `PIPS` | Xúc xắc |
| **`Centre`** | Giữa bàn: tiêu đề, xúc xắc, dòng lượt, `TurnRing`/`MyTurnBadge`, các nút theo từng phase (dùng `CBtn`), 1–2 dòng log cuối (chỉ trên điện thoại), gợi ý khi ở tù hoặc phá sản. Nó mở `BuildPanel` và chứa `DebtControls`. |
| `BuyHint` | Dòng dưới nút Mua: tiền thuê, số ô cùng nhóm mình đã có |
| **`BuildPanel`** | `Modal dark`: mọi nhóm màu và ô xây được, nút "+ Nhà n / Khách sạn", mục "Còn thiếu để xây". Dùng `buildableGroups` và `buildRuleText`. |
| `CBtn` | Nút ở giữa bàn, biến thể `primary` / `danger` / `build` |
| **`ConfirmButton`** | Bấm hai lần để xác nhận, tự huỷ sau 3,5 giây. Thay cho `window.confirm`, vốn bị chặn trong một số trình duyệt in-app. Giờ nằm ở `src/components/games/ConfirmButton.tsx` (có `as="span"` cho chỗ nằm trong một `<button>`), mọi nút Kích dùng chung. |
| **`DebtControls`** | Trong `Centre` khi đang nợ: dòng nợ, Trả nợ, nút "💰 Bán / thế chấp ↓" (`lg:hidden short:hidden`, cuộn tới `AssetPanel`) và Phá sản (qua `ConfirmButton`) |
| **`AssetPanel`** | `<section>` trong cột bên, **không phải modal**. Liệt kê các ô mình sở hữu theo nhóm, rồi "Sân bay & công ty", với các nút Bán nhà / Thế chấp / Chuộc / Bán đất. Khi đang nợ, panel có thêm Trả nợ, Phá sản, đồng hồ, và không có nút ✕. Panel mở khi `mine && myTurn && (showAssets \|\| inDebt)`. `mortgageBlocker()` cho biết vì sao một ô chưa thế chấp được. |
| `BankruptOverlay` | "PHÁ SẢN!" toàn màn hình, `createPortal` vào `document.body`, tiền bay xuống (`MONEY_BITS`) |
| `BuildOverlay`, `CardOverlay` | Banner khi xây nhà (log bắt đầu bằng "🏠"). Lá Cơ hội / Khí vận lật ra, bấm để đóng, `pointerEvents:"none"` khi đang thoát. |
| `PlayerRow` | Dòng người chơi: quân, 👑, tiền, tổng tài sản, tù, thẻ ra tù, điểm, nút Kích, các chip giấy tờ đất (bấm để mở `SquareModal`), `SeatBubble` |
| **`SquareModal`** + `OwnableInfo` + `SQUARE_TEXT` | `Modal` nền sáng: thông tin ô (bảng tiền thuê và giá xây), và các nút quản lý khi tới lượt mình |
| **`PiecePicker`** | Hộp "Quân cờ & màu nhà": 12 quân + 8 màu, mục đã có người dùng bị làm mờ; bấm → `act({type:"pick", emoji, color})`. Mở khi bấm quân tròn của chính mình ở `PlayerRow` (`onPick`). Đổi được cả giữa ván. |
| `LogList`, **`LogModal`** | Danh sách log (mới nhất ở trên, tô màu theo `tone`) dùng ở panel "Diễn biến" và hộp "Toàn bộ diễn biến" (nút 📜 trên thanh trên, phím `L`). Server giữ 150 dòng. |
| `LoanCard`, `LoanModal` | Vay tiền: thẻ xin vay ở giữa bàn (Cho vay / Từ chối / Rút), modal soạn (người cho vay, số tiền, lãi 10 / 20 %, dòng "sau 5 lượt phải trả …"), cột "🏦 Khoản vay" ở panel bên liệt kê các khoản đang nợ |
| `rentDue()` + `SquareModal` | Bấm vào ô đã có chủ: khung lớn **in đậm số tiền phải trả** khi dừng ở đó (đất trống ×2 nếu đủ nhóm, nhà, sân bay, công ty = tổng xúc xắc × k, 0 nếu thế chấp) và tô đậm đúng hàng trong bảng thuê |
| `TradeCard`, `TradeModal`, `CashInput` | Giao dịch: thẻ **ở giữa bàn cờ**, trong `Centre` (Đồng ý / Từ chối / Rút lời mời — điện thoại thấy ngay không phải cuộn xuống), nút 🤝 cũng ở `Centre`, và modal soạn đề nghị (có `Picker` lồng bên trong) |
| `Waiting` | Giữa bàn trước ván (số người/6) hoặc sau ván (kết quả với `DeltaBadge`), nút Bắt đầu / Ván mới |
| **`TableSettings`**, `RULE_PRESETS`, `SettingSelect`, `Toggle`, `SELECT` | Luật bàn trong `SettingsTabs light`, với hàng nút **"Luật nhanh"** phía trên (xem Cài đặt) |
| `TyPhuRules` (export), `RulesModal` | Luật, cũng dùng ở lobby |
| **`Modal({children,onClose,dark?})`** | Dialog của file (§3.10) |

**Bố cục**
- Bàn cờ là grid vuông, `gridTemplateColumns/Rows: 1.6fr repeat(side−1, 1fr) 1.6fr` với `side = BOARD.length / 4` (11×11, 13×13 hoặc 15×15). `Centre` chiếm `2 / side+1` và tự cuộn (`overflow-y-auto`, `justify-center-safe`).
- **Điện thoại dọc:** một cột. Bàn cờ rộng hết màn hình nhưng không cao quá màn hình (`max-w-[min(100%,calc(100dvh-7rem))]`). Dưới đó là `aside`, với `max-lg:pb-14` để chừa chỗ cho chat.
  - Danh sách người chơi 2 cột.
  - Tiêu đề "CỜ TỶ PHÚ" và giá các ô bị ẩn.
  - `Centre` hiện log rút gọn.
  - Giữa các ván, thẻ "⚙️ Luật bàn" chuyển xuống `aside` (`hidden max-sm:block short:block`), còn `Waiting` ghi "Luật bàn ở bên dưới ↓".
- **`short:`:** grid `[auto_minmax(0,1fr)]`. Bàn cờ bên trái, vuông `calc(100dvh-3.75rem)`. `aside` bên phải tự cuộn. Chữ trong ô `short:text-[6px]`/`[8px]`, xúc xắc `short:h-8`.
- **`lg:`:** grid `[minmax(0,calc(100dvh-5rem))_20rem]` căn giữa. `AssetPanel` cuộn với `lg:max-h-[calc(100dvh-16rem)]`.
- **`xl:`:** cột bên `22rem`, bỏ `max-w`, tên ô `xl:text-[10px]`.
- Thứ tự trong `aside`: `AssetPanel` (khi mở), thẻ luật (điện thoại / `short:`), "Người chơi", "Diễn biến" (`max-h-64`).

**Hiệu ứng** (framer-motion, không có keyframes riêng)
- Quân đi từng ô (`motion.span layoutId`, tween 0,16 giây).
- Xúc xắc xoay vào, key theo id của dòng log "🎲".
- Nhà nảy lên khi được xây.
- Huy hiệu chủ sở hữu thu nhỏ vào ô.
- `CardOverlay` (3,5 giây), `BuildOverlay` (2,2 giây), `BankruptOverlay` (3,2 giây).
- Các ref `initialCount`, `initialOwner`, `lastCardAt` đảm bảo hiệu ứng không chạy lại cho những gì đã có khi mới mở bàn.

**Bản sao lib** (`src/lib/typhu/`)
- `board.ts`: `BOARD`, `GROUP_COLORS`, `houseCost`, `mortgageValue`, `unmortgageCost`, `landSaleValue`, các `*_OPTIONS` của cài đặt…
- `protocol.ts`: `TYPHU_WS_PATH`, `STEP_SECONDS_OPTIONS` và các view types.

Phải khớp be_game `src/typhu/board.ts` và `protocol.ts`. `board.ts` là **bản chép nguyên văn** (chép lại mỗi khi be_game đổi): ngoài `BOARD` chuẩn còn có `MapSize`, `MAP_SIZES`, `MAP_LABEL`, `boardOf(map)`, `jailPos`, `CHANCE`/`CHEST`. `protocol.ts` có thêm `TPPiece`, `PIECE_EMOJIS`, `PIECE_COLORS`, `settings.map`, `current.map`.

**Bản đồ.** Có 3 cỡ (40 / 48 / 56 ô, `MapSize`). `BOARD` trong `TyPhuTable.tsx` là **biến module** (`let BOARD: Square[] = STD_BOARD`, và `groupPositions` bọc theo nó) được `TableBody` gán lại ở đầu mỗi lần render theo bản đồ của ván — để các hàm ngoài component (`mortgageBlocker`, `buildableGroups`, `walkPath`…) không phải truyền bản đồ. Hệ quả: chỉ có **một** bàn Tỷ Phú trên trang, và component nào phụ thuộc kích thước bản đồ nhưng được `memo` thì phải nhận nó qua props.

**Cài đặt.** `TableSettings` (`SettingsTabs light`, mỗi thay đổi gửi `act({type:"settings", …})`) có năm tab (💰, 🗺️, ⏱️, 🏠, 🏆):
- **Luật nhanh** (`RULE_PRESETS`, hàng nút phía trên các tab, chỉ chủ bàn bấm được): gửi **một** message `settings` gộp nhiều trường. "⚡ Luật 2 người" = `doubleGo: true`, `timeLimit: 0` (đến khi còn 1 người), `stepSeconds: 45`. "⚡ Luật 3+ người" = như trên + `timeLimit: 45`, `buildRule: "chain"`, `needGroup: false`. Nút hợp với số người đang ngồi được tô đậm và ghi "(hợp với N người)".
- 💰 Tiền: `startCash`, `goSalary`, `doubleGo`, `parkingPot`, `unmortgageFee`, `landSalePct`
- 🗺️ Bản đồ: `map` (`MAP_SIZES`, nhãn `MAP_LABEL`)
- ⏱️ Lượt: `timeLimit`, `stepSeconds`, `doubleRoll`, `jailRent`
- 🏠 Luật nhà: `buildRule` (`"even"`/`"chain"`), `needGroup` (tắt thì chưa đủ nhóm chỉ xây tối đa 3 nhà), `risingCost`, `sellLand` (đất đang thế chấp cũng bán được, chỉ nhận phần chênh), `bankruptTo`
- 🏆 Điểm: `RankPointsPicker`

**Phím tắt** (`useHotkeys`, lượt của mình; `Centre`):

| Phím | Việc |
|---|---|
| `Space` | Hành động chính lúc đó: tung xúc xắc (phase `roll`), mua đất (`buy`), kết thúc lượt (`end`) |
| `R` / `B` / `S` / `E` | Tung xúc xắc / Mua / Bỏ qua / Kết thúc lượt |
| `X` | Mở hộp Xây nhà |
| `A` | Mở Thế chấp / Bán (`AssetPanel`) |
| `J` / `K` | Nộp phạt ra tù / Dùng thẻ ra tù |
| `L` | Mở / đóng "Toàn bộ diễn biến" (cả khi chưa tới lượt; nằm ở `TableBody`, `allowInDialog: ["l"]`) |
| `Esc` | Đóng hộp Xây nhà |

`CBtn` có prop `hotkey` (hiện `<kbd>`). Không bật khi `busy`. Dòng "Phím tắt: …" nằm dưới bàn (`lg:` và không cảm ứng).

**Giới hạn đã biết**
- Chưa có đấu giá, chưa có hiệu ứng khi tiền thay đổi.
- Hộp xây nhà ghi "Đất trống · thuê Xtr" theo `rent[0]`, nhưng khi chủ sở hữu cả nhóm thì tiền thu thực tế gấp đôi.
- Kích dùng `ConfirmButton` (bấm 2 lần).
- Nhiều chữ viết cứng, không theo cài đặt: "30 giây" trong luật và trong `TradeModal`, "nộp 50tr" trong `SQUARE_TEXT`.
- `SquareModal` so sánh chuỗi lỗi của server (`m.sellLand !== "Luật bàn không cho bán đất"`) để ẩn nút Bán đất.
- `TPCommand.settings` trong `protocol.ts` thiếu nhiều trường mà UI vẫn gửi.


### 4.4. Đá Quý (Splendor)

Luật và protocol: `be_game/docs/games/splendor.md`.

**File map**

| File | Vai trò / component chính |
|---|---|
| `splendor/SplendorTable.tsx` | Default `SplendorTable`. `paymentPlan(cardId, p)` tính số phải trả từ bonus, rồi đá, rồi vàng (bản sao `paymentFor` của be_game). **`Table`** gồm market, cột người chơi, toast và các modal. `PlayerPanel` hiện avatar, uy tín, `BonusPip`, đá, thẻ đang giữ (kéo để xếp được bằng `DraggableRow` + `useHandOrder`, key `` `splendor:order:${code}:${meId}` ``), quý tộc và nút Kích. `CardModal` có nút Mua / Giữ và `CostCompare` (bảng giá so với "Bạn có"). `DiscardPanel` dùng khi phải trả bớt đá xuống 10. `Waiting` là phòng chờ, kết quả và luật bàn. `SplendorRules` được export. `Modal` ở cuối file. |
| `splendor/Pieces.tsx` | `GemIcon`, `GemCount`, `TokenChip` (`sm`/`md`/`lg`, `selected`, `dimmed`, `count`), `DevCardView` (`sm`/`md`/`lg`/`fluid`, `affordable` cho viền xanh, `highlight` cho viền vàng), `CardBack` (chồng theo tier; `sm`/`md`/`fluid`), `NobleTile`, `BonusPip`, `GEM_STYLE`. `MD_CARD_W` là chuỗi class responsive cho độ rộng lá; `MD_SLOT` là cùng độ rộng nhưng cho phép co lại (`min-w-0 shrink grow-0`), dùng bọc từng lá `size="fluid"` trong hàng chợ. |

**Art.** Ảnh WebP có sẵn trong repo ở `public/games/splendor/`, **không** đi qua script art. URL được dựng trong `Pieces.tsx`, không có query version:

| Thư mục | Tên file | Hàm dựng URL |
|---|---|---|
| `cards/` | `<bonus>-<tier>-<1..3>.webp` | `cardArt(id)`. `VARIANT` xoay vòng 1→3 giữa các lá cùng `bonus-tier`. |
| `gems/` | `<token>.webp` | `gemSrc(t)` |
| `nobles/` | `n<id>.webp` | `nobleSrc(id)` |

Mặt sau của chồng bài dùng lại art của lá (`BACKS`), làm mờ với `opacity-40 blur-[1px] sepia`.

**Bố cục**
- **Điện thoại dọc:** một cột.
  - Hàng quý tộc ở trên (`lg:hidden short:hidden`), rồi 3 hàng tier (chồng bài + 4 lá). **Hàng chợ không cuộn ngang**: mỗi lá nằm trong một ô `MD_SLOT` (rộng đúng `MD_CARD_W`, nhưng được co lại khi cột hẹp hơn 5 lá) và `DevCardView`/`CardBack` dùng `size="fluid"` (`w-full`) — chiều cao theo `aspect-[5/7]`. Độ rộng của ô phải là `width` xác định (không phải `basis`) để cột lấy được kích thước tự nhiên; dùng `basis` làm cột co về 0. `MD_CARD_W` = `w-[min(4.8rem,calc((100vw-4.75rem)/5))]`, vừa 5 lá một hàng trên điện thoại.
  - Ngân hàng đá wrap: `TokenChip lg` cao `h-11`, `min-[400px]:h-14`, `sm:h-16`.
  - Cột người chơi nằm dưới market, panel của mình lên đầu (`max-lg:order-first`).
  - Phần tử gốc có `pb-24` để chừa chỗ cho chat.
- **`sm:`:** cột người chơi 2 cột, lá `sm:w-[6.5rem]` (từ `md:` là `7.5rem`).
- **`short:`:** grid `[minmax(0,1fr)_16rem]`. Quý tộc thành cột riêng. Ngân hàng đá là `short:grid-cols-2` ở bên phải, nút hành động xếp dọc. Độ rộng lá tính theo chiều cao: `short:w-[min(4.4rem,calc((100dvh-7.5rem)*5/21))]`. `CardModal` chuyển `short:flex-row`.
- **`lg:`:** grid `[minmax(0,1fr)_19rem]`. Quý tộc là cột cạnh các hàng lá. Độ rộng lá `lg:w-[clamp(6.5rem,calc((100dvh-15rem)*5/21),11.5rem)]`, để 3 hàng vừa khít chiều cao màn hình.
- **`xl:`:** `max-w-[100rem]`, chữ và icon trên lá to hơn.

**Hiệu ứng**
- Lá mới chia lật vào (`rotateY: 90 → 0`).
- Toast trượt lên.
- Panel của mình nhấp nháy viền khi tới lượt, kèm nhãn "Lượt của bạn". Phần này **tự vẽ**, không dùng `TurnIndicator`.
- Lá mua được có viền xanh; lá vừa có thay đổi (`g.last.card`) có viền vàng.
- Đếm ngược chuyển đỏ khi còn ≤ 8 giây. Có nhãn "Vòng cuối!".
- `DiscardPanel` tự cuộn vào giữa màn hình.

**Bản sao lib** (`src/lib/splendor/`)
- `cards.ts`: `CARDS`, `CARD_BY_ID`, `NOBLE_BY_ID`, `GEMS`, `TOKENS`, `MAX_TOKENS = 10`, `MAX_RESERVED = 3`, `TARGET_OPTIONS`, `TURN_SECONDS_OPTIONS`…
- `protocol.ts`: `SPLENDOR_WS_PATH` và các view types.

Phải khớp be_game `src/splendor/cards.ts` và `protocol.ts`, và `paymentPlan` phải khớp `paymentFor` của be_game.

**Cài đặt.** Nằm trong `Waiting`, hộp "Luật bàn", **không** dùng `SettingsTabs`. Gồm `target`, `turnSeconds` và `RankPointsPicker`.

**Giới hạn đã biết**
- Không có nút cho lệnh `pass`.
- Chữ viết cứng: "/4 người", "Đá …/10", tối thiểu 2 người.
- Art không có cache-busting.
- Kích dùng `ConfirmButton` dùng chung (bấm 2 lần).

**Phím tắt** (`useHotkeys`; nút có `<kbd>`, `TokenChip` có prop `hotkey`):

| Chỗ | Phím | Việc |
|---|---|---|
| Kho đá, lượt mình | `W` `U` `G` `R` `K` | Chọn đá trắng / xanh dương / xanh lá / đỏ / đen như bấm vào viên đá; bấm lần hai cùng phím = lấy 2 viên |
| | `Enter` hoặc `Space` | "Lấy đá". Khi cảnh báo quá 10 viên: `Enter` = "OK, lấy đá", `Esc` = "Chọn lại" |
| | `Esc` | Bỏ chọn (chỉ khi không có dialog) |
| Modal một thẻ | `B` / `G` | Mua / Giữ (`Esc` đóng modal như cũ) |
| Panel bỏ bớt đá | `W` `U` `G` `R` `K` `V` | Trả lại 1 viên màu đó (`V` = vàng) |
| | `Enter` / `Esc` | "Trả lại" / "Chọn lại" |

Lưu ý `G` nghĩa là xanh lá ở kho đá nhưng là "Giữ" trong modal thẻ.

### 4.5. Đấu Súng (Bang!)

Luật và protocol: `be_game/docs/games/bang.md`.

**File map**

| File | Vai trò / component chính |
|---|---|
| `bang/BangTable.tsx` (khoảng 1600 dòng) | Default `BangTable`, với `useState(makeLocalize)` (§1.2). `Table` render một trong `Waiting`, `PickPhase` (chọn 1 trong 2 nhân vật) hoặc **`Board`**, cùng `ScoreboardModal` và `BangGuide`. **`Board`** chứa máy trạng thái chọn lá: state `mode`, `sel`, `target`, `target2`, `pick`, `asBang`, `opt`, `info`, `showLog`. Nó dùng các hàm `playNeeds`, `inPlayNeeds`, `abilityNeeds`, `buyNeeds`, `withMode` (trả về `Needs`: mục tiêu, lá cần chọn, chế độ…), cùng `playable()` (kiểm tra sơ bộ phía client) và `usable()`. Các component khác: `TurnGlow` (viền nhấp nháy riêng); `LogList`; `PlayerTile` (người chơi khác, bấm để chọn mục tiêu); `ActionPanel` (chọn panel phù hợp); `ModeForm` (hành động đang chọn: Xác nhận / Mua / Bỏ lá); `PromptPanel` (trả lời các prompt `react`, `save`, `store`, `pick`, `keep`, `discard`, `copy`, `draw`); `DrawPanel`. |
| `bang/Pieces.tsx` | `CardFace` (`xs`/`sm`/`md`/`lg`, `selected`, `dim`, `badge`; vùng bấm đứng yên khi mặt lá nhô lên), `CardBack`, `PlayChip` (lá đặt trước mặt; `compact` chỉ hiện emoji trên điện thoại), `Hearts`, `RoleBadge`, `CharAvatar`, `CharCard`, `EventArt`, `EventBanner`, `GearChip`, `BangRules`, `BangGuide({packs,onClose})` (các tab: lá bài / nhân vật / sự kiện / trang bị / luật), **`Sheet`** (dialog của game). `artSrc(name)` trả URL art hoặc `null`. |

**Bố cục**
- Phần tử gốc `max-w-6xl 2xl:max-w-7xl`. `Board` là grid `lg:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_21rem] short:grid-cols-1`.
- **Điện thoại dọc:** một cột, thứ tự:
  1. `EventBanner`
  2. Người chơi khác (`grid-cols-2`, `sm:` 3, `xl:` 4)
  3. Giữa bàn (chồng rút, chồng bỏ, chữ về lượt hoặc prompt, nút 📜 mở `LogList`, cửa hàng Gold Rush)
  4. Ô "Bạn"
  5. `ActionPanel`, **sticky** ở đáy, với `pr-14` để chừa nút chat
  6. Bài trên tay (wrap)
  
  Lá `md` rộng `w-[3.9rem]`, từ `sm:` là `4.6rem`.
- **`short:`:** cột chính thành `short:grid-cols-2`. Hai wrapper bình thường là `contents` chuyển thành `short:flex short:flex-col`: nửa trái là sự kiện, người chơi và giữa bàn; nửa phải là "Bạn", hành động và bài. `ActionPanel` thành `short:static`. Cột log bị ẩn.
- **`lg:`:** cột phải có `LogList` đầy đủ (`max-h-[calc(100dvh-8rem)]`). `ActionPanel` không còn sticky. Sau ván, `Waiting` chia `[2fr_3fr]`.
- **`xl:` / `2xl:`:** lá `xl:w-[5.2rem]`, `2xl:w-[5.8rem]`.

**Hiệu ứng.** **Không dùng framer-motion.** Chỉ có transition CSS: lá được chọn nhô lên `-translate-y-2` với viền vàng; lá không dùng được thì `grayscale`; `TurnGlow` nhấp nháy; `PlayerTile` có viền theo trạng thái (đang chờ, đã chọn 🎯, chọn được, chết). Đếm ngược chuyển đỏ khi còn ≤ 10 giây (lượt) hoặc ≤ 5 giây (prompt). `g.last` có trong protocol nhưng chưa được dùng.

**Bản sao lib** (`src/lib/bang/`)
- `cards.ts`: `CARD_TYPES`, `CHARACTERS`, `EVENTS`, `GEAR`, `EXPANSIONS` (7 gói), `PACKS`, `ROLE_INFO`, `MIN_PLAYERS = 3`, `MAX_PLAYERS = 8`, các `*_SECONDS_OPTIONS`… Key của `CARD_TYPES`, `CHARACTERS` và `EVENTS` là danh sách tên art cho script.
- `protocol.ts`: `BANG_WS_PATH`, `PromptView`, `DrawMode`, `PickSpec` và các view types.
- `art.ts`: file sinh tự động.

Phải khớp be_game `src/bang/cards.ts` và `protocol.ts`.

**Cài đặt.** Nằm trong `Waiting`, dùng `SettingsTabs` với ba tab:
- 🧩 Mở rộng: checkbox cho mỗi gói, `togglePack` gửi `settings {packs}`.
- ⏱️ Thời gian: `turnSeconds`, `respondSeconds`.
- 🏆 Điểm: chỉ có `first`, chọn từ danh sách viết cứng `[1,2,3,4,5,10]`, không dùng `RankPointsPicker`.

**Giới hạn đã biết**
- Không có nút Kích, dù protocol có lệnh `kick`.
- `second` không chỉnh được.
- Chưa có hiệu ứng đánh lá, trúng đạn hay chết.
- Toast là một div tĩnh ở `bottom-20`.
- Nhân vật hoặc lá chưa có art thì hiện emoji. Hiện còn thiếu art cho một vài lá, nhân vật và sự kiện; script in ra danh sách khi chạy.

**Phím tắt** (`useHotkeys`):

| Chỗ | Phím | Việc |
|---|---|---|
| Lượt mình | `E` | Kết thúc lượt |
| Form hành động | `Enter` / `Esc` | Xác nhận / Mua / "Bỏ N lá & qua lượt" · Huỷ |
| Giai đoạn rút | `D` (hoặc `Enter` khi không có kiểu rút đặc biệt) | "Rút bình thường" |
| Lời nhắc phản ứng | `Enter` | Đỡ / Né / Cứu / Giữ / Úp / "Bỏ N lá" |
| | `P` | "Bỏ qua" (chỉ với né và cứu) |

**Cố ý không có phím:** "Chịu máu" / "Mất máu", các lựa chọn một lá (cửa hàng, nhặt, chép), chọn nhân vật, và các kiểu rút đặc biệt — những thứ không thể hoàn tác hoặc cần nhìn kỹ.

### 4.6. Cờ Cá Ngựa

Luật và protocol: `be_game/docs/games/cangua.md`.

**File map**

| File | Vai trò / component chính |
|---|---|
| `cangua/Board.tsx` | `HORSE_COLORS` (export; 0 Đỏ, 1 Xanh dương, 2 Vàng, 3 Xanh lá). `targetProgress(from, die, ladder)` (export) tính ô đến để vẽ dấu. `STEP_MS = 170`. **`useWalkingHorses(players, last)`** (nội bộ) trả về `{pos, flying, boom}`. **`CaNguaBoard({players,last,turn,legal,die,ladder,onPick,meId})`** là bàn 15×15. **`RollingDie({value,seq,color?,size?: "md"\|"lg"})`**. `HorseChip`. Lưu ý: `HOME_STEP` là code chết. |
| `cangua/CaNguaTable.tsx` | Default `CaNguaTable`, `Table`. `TurnPanel` gồm xúc xắc, chữ lượt, nút Gieo (phím Space/Enter cũng gieo, trừ khi đang gõ chữ), `TurnTimerBorder`, `TurnRing` và `MyTurnBadge`. `PlayerRow` hiện số 🏠/🐎/⛺ và nút Kích. Còn có `Toggle`, `Waiting`, `CaNguaRules({settings?})` (chữ thay đổi theo cài đặt; lobby không truyền gì nên hiện "(tuỳ chọn)") và `Modal`. |

**Bố cục**
- Bàn cờ là `aspect-square w-full [container-type:inline-size]`, grid `repeat(GRID, 1fr)`. Mọi kích thước bên trong dùng **đơn vị `cqw`** (`text-[2.6cqw]`, 💥 `text-[7cqw]`…), nên co giãn theo độ rộng bàn.
- Quân và dấu đích nằm trong một lớp `absolute inset-[1.5%]`, vị trí tính bằng `pct()`. Quân rộng `6.2%`, hoặc `5%` khi chồng lên nhau.
- Khung bàn: `max-w-[calc(100dvh-5.5rem)]`, để không bao giờ cao quá màn hình.
- **Điện thoại dọc:** một cột. Bàn cờ ở trên; `aside` ở dưới gồm `TurnPanel`, người chơi (`sm:grid-cols-2`, dòng của mình lên đầu) và log (`max-h-48`). Phần tử gốc có `pb-24` cho chat.
- **`short:`:** grid `[auto_minmax(0,1fr)]`. Bàn cờ rộng `calc(100dvh-3.4rem)`. `aside` tự cuộn, log `short:max-h-32`.
- **`lg:`:** grid `[minmax(0,1fr)_20rem]`. Người chơi 1 cột. Không dùng `xl:` hay `2xl:`.
- Khi ván kết thúc, bàn cờ được thay bằng `Waiting` (kết quả).

**Hiệu ứng: `useWalkingHorses`**
- State ban đầu là vị trí hiện tại, nên mở bàn hay reconnect đều **không** có cảnh đi lại.
- Effect key theo một chuỗi tạo từ id người chơi và vị trí ngựa, nên các broadcast không làm ngựa di chuyển thì không chạy lại.
- Với mỗi ngựa đổi vị trí:
  - **Đi tới:** đi từng ô, mỗi bước `max(70, min(170, 1800/len))` ms, nên cả quãng tối đa khoảng 1,8 giây.
  - **Ra chuồng:** nhảy thẳng tới ô.
  - **Bị đá:** khi `last.kicked` khớp ngựa đó, sau khi ngựa kia đi xong thì hiện 💥 tại ô đó (framer-motion spring), ngựa bị đá bay về chuồng (CSS `cubic-bezier`, xoay vòng).
  - **Còn lại** (ván mới, bỏ cuộc): nhảy thẳng.
- `flying` và `boom` hết hạn bằng timer riêng (850 ms và 1100 ms).

Các hiệu ứng khác:
- `RollingDie` chỉ lăn khi `seq` đổi. Ref `first` chặn lăn lúc mount. Mặt xúc xắc đổi ngẫu nhiên mỗi 70 ms, dừng ở `value` sau 550 ms.
- Ngựa đi được có quầng `animate-ping`. Vùng bấm vô hình `min-h-11 min-w-11` giúp bấm được dù quân chỉ khoảng 22 px trên điện thoại.
- Ô đích là vòng nét đứt nhấp nháy.

**Bản sao lib** (`src/lib/cangua/`)
- `board.ts`: `GRID = 15`, `TRACK`, `HOME_CELLS`, `STABLE_ORIGIN`, `STABLE = -1`, `GATE = 55`, `FINAL = 61`, `cellOf`, `startIndex`, `TURN_SECONDS_OPTIONS`…
- `protocol.ts`: `CANGUA_WS_PATH`, `CNSettings`, `CNMove`, `CNGameView`…

Phải khớp be_game `src/cangua/board.ts` và `protocol.ts`. Cách mã hoá vị trí: −1 là chuồng, 0 là ô xuất phát, 55 là ô trước cửa chuồng, 56..61 là các bậc chuồng.

**Cài đặt.** Nằm trong `Waiting`, dùng `SettingsTabs` với ba tab:
- 🐴 Luật: `exitOn1`, `noJump`, `ladder`, `threeSixes`, `rankAll`
- ⏱️ Lượt: `turnSeconds`
- 🏆 Điểm: `RankPointsPicker`

**Giới hạn đã biết**
- Reconnect sau khi lỡ nhiều nước: ngựa bị đá trước đó chỉ nhảy về, không có 💥.
- Transition CSS cố định 150 ms, dù bước có thể ngắn tới 70 ms.
- Chỉ có viền đếm ngược, không có số giây.
- `ScoreboardModal` dùng màu emerald mặc định, lệch tông nâu của bàn.
- Kích dùng `ConfirmButton` dùng chung (bấm 2 lần).

**Phím tắt** (`useHotkeys`; thay listener Space/Enter cũ, nên không còn chạy khi dialog mở hoặc tiêu điểm ở nút):

| Phím | Việc |
|---|---|
| `Space`, `Enter` hoặc `R` | Tung xúc xắc (lượt mình, phase `roll`, không `busy`) |
| `1`–`4` | Đi con ngựa đang sáng thứ N, theo thứ tự `g.legal`; số hiện trên quân (huy hiệu `<kbd>`, chỉ máy tính) |
| `Space` / `Enter` | Đi luôn khi chỉ có đúng một nước hợp lệ |
| `Esc` | Đóng `Modal` (listener có sẵn của `Modal` được giữ) |

Nút tung có huy hiệu `Space`; câu hướng dẫn nước đi ghi "(phím 1–N)".

### 4.7. Ô Ăn Quan

Luật và protocol: `be_game/docs/games/oanquan.md`.

**File map**

| File | Vai trò / component chính |
|---|---|
| `oanquan/Board.tsx` | `SowFrame` (export): `{seq, dan[], quan[], cell, hand, captured[], pending, player}`. Các hằng `STEP_MS = 180`, `MAX_REPLAY_MS = 6500`, `MAX_QUEUE = 2`. **`useSowReplay(g)`** (export) trả `SowFrame \| null`. Hàm nội bộ `replay(...)`. `layoutFor(bottomSide, players)` (export) cho các ô theo thứ tự trên màn hình (bàn 2 người). `SIDE_COLORS` (export): 4 màu theo chỗ ngồi. **`OQBoard({dan,quan,bottomSide,selectable,selected,onSelect,onSow,frame,lastCell,players})`**: 2 người vẽ bàn 2 hàng; 3–4 người vẽ `RingBoard`. `Pebbles` xếp sỏi theo xoắn ốc góc vàng, cố định cho mỗi số sỏi. Còn có `CountBadge`, `HandBadge` ("✋n"), `Cup` (ô dân; khi được chọn hiện lớp ◀/▶) và `QuanCup` (ô quan nửa tròn, bàn 2 người). `RingBoard` / `QuanDisc` (ô quan tròn) cho 3–4 người. |
| `oanquan/OAnQuanTable.tsx` | Default `OAnQuanTable`, `Table`. `PlayerStrip` là dải người chơi trên/dưới bàn (biến thể `compact` cho đối thủ khi có 3–4 người), với điểm đếm dần theo replay. Còn có `END_REASON`, `Waiting`, `OAnQuanRules()` (export, không nhận props) và `Modal`. |

**Bố cục**
- Bàn là grid 7 cột × 2 hàng: `grid-cols-[1.35fr_repeat(5,minmax(0,1fr))_1.35fr]`. Mỗi `Cup` là `aspect-square`; `QuanCup` là `row-span-2`. Mọi thứ bên trong tính theo %, cỡ chữ đếm dùng `clamp(10px,2.6vw,15px)`.
- Bàn 2 người là một dải rộng nên tự thấp. Không cần giới hạn theo `dvh`.
- **3–4 người (`RingBoard`)**: vòng khép kín vẽ bằng định vị tuyệt đối trên khung `aspect-ratio 100/h` (tam giác `h = 90`, hình vuông `h = 100`). Mỗi đoạn là một cạnh, ô quan (`QuanDisc`) ở góc đầu cạnh, 5 `Cup` chia đều trên cạnh (kích thước tính theo % bề rộng). Đoạn của mình luôn là cạnh dưới (`pos = (side − bottomSide + n) % n`), chạy trái → phải, vòng đi ngược chiều kim đồng hồ trên màn hình. Mỗi cạnh có dải màu `SIDE_COLORS[side]` (đậm hơn khi đến lượt, mờ khi bị loại) và thẻ tên ở giữa bàn. Khung bàn được giới hạn `max-width: min(100%, max(16rem, (100dvh − 16rem) × tỉ lệ))` để vừa màn hình PC. Chỉ ô của mình mới chọn được nên ◀/▶ luôn khớp trái/phải trên màn hình.
- Đối thủ khi 3–4 người: lưới `compact` `PlayerStrip` phía trên bàn (`grid-cols-2` / `grid-cols-3`), viền trên theo màu chỗ ngồi; ở `short:` chuyển sang cột bên.
- Hàng của mình luôn ở dưới (`bottomSide = mine?.side ?? 0`). Khán giả thấy phía 0 ở dưới.
- **Điện thoại dọc:** một cột. Thứ tự: dải người chơi trên, bàn, thanh hành động (`min-h-11`; có "⬅️ Rải trái", "Bỏ chọn", "Rải phải ➡️"), dải người chơi dưới, thẻ kết quả, rồi `aside` log (`max-h-60`). Phần tử gốc có `pb-24`.
- **`short:`:** grid `[minmax(0,1fr)_15rem]`. Hai dải người chơi chuyển vào cột phải (`hidden short:flex`). Thẻ kết quả nằm dưới bàn. Log `short:max-h-[34dvh]`.
- **`lg:`:** cột bên `20rem`. Kết quả và log (`lg:max-h-[60vh]`) nằm trong `aside`.
- **`2xl:`:** `max-w-7xl`, cột bên `22rem`. Không dùng `xl:`. Có thêm các breakpoint tuỳ biến `min-[420px]` và `max-[380px]`.

**Hiệu ứng: `useSowReplay(g)`**
- Phát lại từng `g.lastMove` mới, bắt đầu từ `lastMove.before`, mỗi viên sỏi khoảng 180 ms (`pick`, rồi `sow`, rồi `capture`), và giữ khung cuối 350 ms.
- Tốc độ mỗi viên: `max(55, min(STEP_MS, MAX_REPLAY_MS / steps.length))`, nên một lượt dài cũng không phát quá 6,5 giây.
- Effect chỉ key theo `seq`. Ref `initial` giữ `seq` có lúc mở bàn, và **nước đó không được phát lại**. Reconnect giữ `Table` mounted, nên không phát lại.
- Nước đến khi đang phát thì xếp hàng đợi. Nếu hàng đợi vượt `MAX_QUEUE` (2), chỉ giữ nước mới nhất.
- Người dùng bật `prefers-reduced-motion` thì bỏ hẳn replay.

Bàn dùng `frame` như sau:
- Hiện `frame.dan/quan` thay cho `g.dan/quan`.
- `canMove = myTurn && !frame`. Trong lúc phát, `TurnTimerBorder` và `TurnRing` bị ẩn, và thanh hành động ghi "{tên} đang rải — trên tay N dân".
- Thẻ kết quả chỉ hiện sau khi phát xong, rồi tự `scrollIntoView`.
- Điểm trong `PlayerStrip` trừ phần `pending`, nên điểm tăng dần theo từng lần ăn.

Thông báo "Rải quân" lấy từ `lastReseed.seq`, hiện 3,2 giây.

**Bản sao lib** (`src/lib/oanquan/`)
- `board.ts`: `SEGMENT`, `rowOf`, `quanIndex`, `QUAN_VALUE_OPTIONS`, `QUAN_NON_MIN`, `TURN_SECONDS_OPTIONS`, `nextCell`…
- `protocol.ts`: `OANQUAN_WS_PATH`, `OQMove`, `OQStep`, `OQGameView`…

Phải khớp be_game `src/oanquan/board.ts` và `protocol.ts`. **Replay phụ thuộc vào cấu trúc `lastMove.steps`**: nếu be_game đổi `OQStep`, phải sửa `replay()`.

**Cài đặt.** Nằm trong `Waiting`, dùng `SettingsTabs` với ba tab:
- 🪨 Luật: `quanValue`, `quanNon`
- ⏱️ Lượt: `turnSeconds`
- 🏆 Điểm: `RankPointsPicker players={số người trong ván / đang ngồi}`

Sảnh chờ hiện `đang ngồi/4`, nút bắt đầu cần ít nhất 2 người. `OAnQuanRules` mô tả luật 2–4 người (vay nhiều người, bị loại, chung hạng).

**Giới hạn đã biết**
- Nước bị bỏ khi hàng đợi tràn làm bàn "nhảy".
- Phần `pending` không tính nước đến giữa chừng.
- Replay ăn vào thời gian của người đi tiếp, vì deadline phía server vẫn chạy.
- `OAnQuanRules` không đọc cài đặt.
- Kích dùng `ConfirmButton` dùng chung (bấm 2 lần).

**Phím tắt** (`useHotkeys`):

| Phím | Việc |
|---|---|
| `1`–`5` | Chọn ô trên hàng của mình, đếm từ trái sang phải; bấm lại ô đang chọn = bỏ chọn. Huy hiệu số hiện trên các ô chọn được |
| `←` / `A` | Rải trái (hướng −1) |
| `→` / `D` | Rải phải (hướng +1) |
| `Esc` | Bỏ chọn (chỉ khi có ô đang chọn và không có bảng điểm / luật; `Modal` vẫn tự đóng bằng `Esc`) |

Điều kiện: lượt mình, không đang animation (`canMove`), không `busy`. Nút Rải trái / Rải phải / Bỏ chọn có huy hiệu `←`, `→`, `Esc`. Dòng "Phím tắt:" hiện khi chưa chọn ô. Với 3–4 người (bàn vòng), `1`–`5` vẫn chạy từ trái sang phải dọc **cạnh của mình**.

---

## 5. Quy ước responsive

### 5.1. Breakpoint

| Variant | Điều kiện | Dùng cho |
|---|---|---|
| (mặc định) / `max-sm:` | < 640px | Điện thoại dọc |
| `sm:` | ≥ 640px | Tablet nhỏ; dialog chuyển sang hộp giữa màn hình; `GameHeader.extra` hiện inline |
| `md:` | ≥ 768px | Ít dùng: lá Đá Quý, emoji gói trong header Bang |
| `lg:` | ≥ 1024px | Máy tính / tablet ngang: chia 2 cột (bàn + cột bên), log đầy đủ, tab game trên thanh của trang bàn |
| `xl:` | ≥ 1280px | Hub/lobby có `AllRoomsPanel` sticky bên phải; tên người chơi trên thanh của trang bàn; cột bên rộng hơn |
| `2xl:` | ≥ 1536px | Bang, Mèo Nổ, Ô Ăn Quan: lá và cột to hơn |
| **`short:`** | `@media (orientation: landscape) and (max-height: 500px)` | **Điện thoại xoay ngang.** Định nghĩa trong `src/app/globals.css` bằng `@custom-variant short (...)`. |
| `pointer-coarse:` | màn hình cảm ứng (có sẵn trong Tailwind v4) | Tiến Lên, Mèo Nổ: vùng bấm lớn hơn |

`short:` **không loại trừ** `sm:`/`lg:`. Một điện thoại 844×390 vừa `sm:` vừa `short:`. Các class `short:` đứng sau nên thường thắng, nhưng nếu một bố cục `lg:` lỡ khớp, phải tắt nó bằng `short:` tương ứng (ví dụ `short:grid-cols-1` trong Bang).

### 5.2. Vùng bấm ≥ 36px trên điện thoại

- Mọi nút trên điện thoại cần ít nhất `min-h-9 min-w-9` (36px). Mẫu: `max-sm:min-h-9 max-sm:min-w-9 short:min-h-9 short:min-w-9`, chính là chuỗi `headerBtn`.
- Select và input dùng `max-sm:min-h-9` hoặc `max-sm:min-h-10`.
- Quân hoặc chip quá nhỏ (ngựa khoảng 22px) thì thêm một vùng bấm vô hình lớn hơn (`min-h-11 min-w-11`) thay vì phóng to hình.
- Thanh games trên trang bàn tự cao lên `h-11` trên điện thoại. `--games-bar-h` đã được tính lại cho chiều cao này.

### 5.3. Bàn vừa một màn hình

Mục tiêu: **trang bàn không cuộn cả trang**. Chỉ các vùng con (log, cột bên, bài trên tay) được cuộn.
- Chiều cao có sẵn = `100dvh - var(--games-bar-h)`. Rule `.games-table > :first-child` đặt `min-height` này cho phần tử gốc. Nếu muốn khoá cứng, dùng `h-[calc(100dvh-var(--games-bar-h,0px))] overflow-hidden` như Mèo Nổ.
- **Bàn vuông** (Tỷ Phú, Cá Ngựa): giới hạn độ rộng theo chiều cao, ví dụ `max-w-[calc(100dvh-5.5rem)]`. Khi `short:`, đặt `w-[calc(100dvh-3.4rem)]` để bàn ở cột trái và cột phải `overflow-y-auto` với `max-h-[calc(100dvh-…)]`.
- **Lá bài:** tính độ rộng theo cả `vw` lẫn `dvh`, bằng `clamp()`/`min()` (Tiến Lên dùng `--cw`; Đá Quý dùng `calc((100dvh-15rem)*5/21)`), hoặc dùng `cqw` trong container (Cá Ngựa).
- Dùng `dvh` chứ không dùng `vh`, để thanh địa chỉ của trình duyệt điện thoại không làm tràn màn hình.
- Luôn tính `env(safe-area-inset-*)` cho đáy và hai bên (tai thỏ khi xoay ngang). `viewportFit: "cover"` được đặt trong `src/app/layout.tsx`.

### 5.4. Lề cho cụm chat và emoji

`ChatBox` nổi `fixed` ở góc dưới phải. Nút 💬 cao 44–48px; với `row`, nút 😀 nằm bên trái nó. Bố cục bàn phải chừa chỗ:
- **Đáy:** `pb-24` ở phần tử gốc trên điện thoại (Cá Ngựa, Ô Ăn Quan, Đá Quý), `max-lg:pb-14` ở `aside` (Tỷ Phú), `max-lg:pb-28` (Mèo Nổ khi không có bài).
- **Phải:** `pr-12 sm:pr-16` ở dock bài (Mèo Nổ), `pr-14` cho `ActionPanel` sticky (Bang), `max-sm:pr-[6.5rem]` ở hàng bài sau ván (Tiến Lên).
- Thanh hoặc panel `sticky bottom-…` phải chừa `pr-14` để không nằm dưới nút chat.
- Truyền `row` cho `ChatBox` khi muốn cụm nút chỉ cao bằng một nút. Mọi game trừ Mèo Nổ đều làm vậy.

---

## 6. Ảnh lá bài (card art pipeline)

Mèo Nổ và Đấu Súng có art **tùy chọn cho từng lá**: lá chưa có art vẫn hiện mặt vẽ bằng emoji. Đá Quý dùng ảnh có sẵn (§4.4), không qua pipeline này. Bộ prompt vẽ tranh: [`MEONO_ART_PROMPTS.md`](MEONO_ART_PROMPTS.md), [`BANG_ART_PROMPTS.md`](BANG_ART_PROMPTS.md).

```bash
npm run art:meono      # = node scripts/card-art.mjs meono   (đọc art/meono/*)
npm run art:bang       # = node scripts/card-art.mjs bang    (đọc art/bang/*)
node scripts/card-art.mjs <meono|bang> [thư-mục-ảnh]
```

**Đầu vào.** Thư mục `art/<game>/` nằm trong `.gitignore`, vì ảnh gốc nặng. Nhận các đuôi `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`. Có hai loại file:
- **Sheet** `sheet1.png`, `sheet2.png`…: một ảnh lưới **4 cột × 3 hàng** chứa 12 lá. Thứ tự lá đọc từ trái qua phải, hàng trên xuống, theo `GAMES[<game>].sheets[N]` trong `scripts/card-art.mjs` (`null` là ô trống).
  - Script tìm khe giữa các ô bằng màu ở góc ảnh (dòng có hơn 97% pixel giống màu nền), nên khe lệch hoặc ô trống ở cuối vẫn cắt đúng. Không có khe thì chia đều.
  - Mỗi ô bị gọt thêm 2% ở mép cho an toàn.
- **Ảnh lẻ** `<tên>.png` (ví dụ `defuse.png`, `card-bang.png`, `back.png`): một lá. Ảnh lẻ được xử lý **sau** sheet, nên đè lên lá cùng tên trong sheet. Muốn làm lại một lá hỏng thì chỉ cần thêm ảnh lẻ.

**Tên hợp lệ** được đọc trực tiếp từ code, nên không bao giờ lệch:
- **Mèo Nổ:** key của `CARDS` trong `src/lib/meono/cards.ts`, cộng `"back"`.
- **Bang:** `card-<key>` (từ `CARD_TYPES`), `char-<key>` (từ `CHARACTERS`), `event-<key>` (từ `EVENTS`) trong `src/lib/bang/cards.ts`, cộng `"back"`.

Tên trong `sheets` mà không có thật thì script báo lỗi. File có tên lạ thì bị bỏ qua và in ra.

**Cắt về khung** (hàm `save`):
- Kích thước mặc định là 400×560 (tỉ lệ 5:7). Hàm **`sizeOf(name)`** đổi kích thước theo loại: Bang có `card-*` 400×440 (vừa ô art trên mặt lá), `event-*` 480×480, còn lại 400×560. Mèo Nổ không có `sizeOf`.
- **`CROP_TOLERANCE = 0.12`**: nếu tỉ lệ ô lệch khung đích không quá 12%, ảnh được cắt `cover` với `sharp.strategy.attention` (giữ vùng nổi bật).
- Nếu lệch nhiều hơn, ảnh **được giữ nguyên**: chỉ gọt bớt một chút ở cạnh dài, thu vào khung, rồi kéo dài pixel mép (`extendWith: "copy"`) cho đủ tỉ lệ.
- **`alwaysCrop`**: danh sách lá luôn cắt `cover` dù lệch tỉ lệ. Mèo Nổ đặt `["back"]`, vì thiết kế có khung viền mà bị độn thêm thì trông sai.
- Đầu ra là WebP chất lượng 82.

**Đầu ra**
- `public/games/<game>/cards/<tên>.webp`
- **`src/lib/<game>/art.ts`** được ghi lại toàn bộ. Đầu file là `// Generated by scripts/card-art.mjs — do not edit by hand.`
  - Mèo Nổ: `export const MEO_ART: readonly (CardType | "back")[]` và `MEO_ART_VERSION`.
  - Bang: `type BangArt`, `export const BANG_ART` và `BANG_ART_VERSION`.
  
  Danh sách liệt kê **mọi** file webp hợp lệ trong thư mục đầu ra, không chỉ các file của lần chạy này. `*_VERSION` là sha1 rút gọn của các ảnh. UI gắn nó vào URL dưới dạng `?v=...` để trình duyệt không giữ ảnh cũ.
- Cuối cùng script in "Có ảnh: x/y. Còn thiếu: …".

**Cách UI dùng art**
- Mèo Nổ: `artSrc` trong `meono/MeoCard.tsx` trả `/games/meono/cards/<type>.webp?v=MEO_ART_VERSION` nếu `type` có trong `MEO_ART`.
- Bang: `artSrc(name)` trong `bang/Pieces.tsx` (dùng `HAS_ART = new Set(BANG_ART)`) trả URL hoặc `null`. `CardFace`, `CardBack`, `CharAvatar`, `EventArt` và `EventBanner` hiện emoji khi nhận `null`.

Sau khi chạy script, commit `public/games/<game>/cards/*.webp` và `src/lib/<game>/art.ts`. Khi thêm một lá mới vào `cards.ts`, chạy lại script để kiểm tra; nhớ thêm lá vào `sheets` nếu nó nằm trong một sheet.

---

## 7. Kiểm thử UI

Repo không có test runner. Test luật nằm ở be_game (`npx vitest run`).

```bash
npx tsc --noEmit -p .    # type check
npm run lint             # eslint .
npm run build            # build đầy đủ (bắt cả lỗi của next)
```

Lưu ý: nhiều bàn gửi lệnh qua `act(msg: Record<string, unknown>)`, nên type check **không** bắt được lệnh sai tên hoặc thiếu trường. Phải chạy thử với server thật.

### 7.0. Chạy bàn cục bộ

Repo không có database: chỉ cần `.env` với `NEXT_PUBLIC_TIENLEN_SERVER_URL=http://localhost:4000`, chạy be_game (`npm run dev` trong repo be_game) ở cổng 4000, rồi `npm run dev` ở đây và dùng bot (§7.1).

### 7.1. Bot qua WebSocket

Để có đủ người cho một bàn, chạy vài bot nói đúng protocol JSON của be_game. Node ≥ 22 có sẵn `WebSocket` toàn cục.

Các message cần biết:

| Chiều | Message |
|---|---|
| client → server | `{type:"create", id}`, `{type:"join"\|"watch", id, code, name, token}`, `{type:"ping"}`, `{type:"leave", id}`, rồi các lệnh của game: `{type:"start", id}`, `{type:"settings", id, …}`… |
| server → client | `{type:"ack", id, ok:true, code?}` hoặc `{type:"ack", id, ok:false, error}`, `{type:"state", view}` (gửi lại sau mỗi thay đổi), `{type:"pong"}`, `{type:"reconnect"}` |

`token` là chuỗi bí mật bất kỳ: cùng token thì vào lại cùng ghế. Lệnh nào cũng cần `id` để nhận ack. View của từng game và các lệnh để chơi tự động: xem `be_game/docs/games/<id>.md`.

```js
// bots.mjs — node bots.mjs <wsPath> <CODE> [số bot]
// ví dụ: node bots.mjs /api/splendor/ws ABCDE 2   (Tiến Lên: /api/ws)
const [wsPath = "/api/meono/ws", code, n = "2"] = process.argv.slice(2);
const BASE = (process.env.GAME_SERVER ?? "http://localhost:4000").replace(/^http/, "ws");

function bot(name) {
  const ws = new WebSocket(BASE + wsPath);
  let nextId = 1;
  const pending = new Map();
  const send = (msg) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ ...msg, id }));
    });

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "ack") {
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    } else if (msg.type === "state") {
      const view = msg.view;
      // Quyết định nước đi ở đây, dựa trên view (xem be_game/docs/games/<id>.md)
      // (tên trường khác nhau giữa các game: view.current, view.game…)
    }
  };
  ws.onopen = async () => {
    const ack = await send({ type: "join", code, name, token: `bot-${name}` });
    console.log(name, ack.ok ? "joined" : ack.error);
    setInterval(() => ws.send(JSON.stringify({ type: "ping" })), 10_000); // heartbeat: không ping thì bị coi là mất kết nối
  };
  return { ws, send };
}

const bots = Array.from({ length: Number(n) }, (_, i) => bot(`Bot${i + 1}`));
process.on("SIGINT", () => (bots.forEach((b) => b.ws.close()), process.exit()));
```

Để bot tạo bàn: gửi `{type:"create", id}` trên một kết nối, lấy `ack.code`, rồi join như trên. Bot vào bàn đầu tiên sẽ là chủ bàn và có thể gửi `{type:"start"}`.

### 7.2. Chụp màn hình bằng Playwright (headless)

Repo **không** cài Playwright. Cài `playwright-core` ở một thư mục tạm, rồi dùng Edge có sẵn trên Windows (`channel: "msedge"`), không cần tải Chromium:

```bash
mkdir %TEMP%\shots && cd %TEMP%\shots && npm init -y && npm i playwright-core
```

```js
// shots.mjs — node shots.mjs /meo-no/ABCDE   (cần web :3000 và be_game :4000 đang chạy)
import { chromium } from "playwright-core";

const path = process.argv[2] ?? "/";
const BASE = process.env.WEB ?? "http://localhost:3000";
const VIEWPORTS = [
  { name: "phone-375x812", width: 375, height: 812, mobile: true },
  { name: "phone-390x844", width: 390, height: 844, mobile: true },
  { name: "phone-landscape-844x390", width: 844, height: 390, mobile: true }, // khớp `short:`
  { name: "tablet-768x1024", width: 768, height: 1024, mobile: true },
  { name: "laptop-1366x768", width: 1366, height: 768, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, mobile: false },
];

const browser = await chromium.launch({ channel: "msedge" }); // headless mặc định
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  // Bỏ qua cổng chọn tên: đặt tên trước khi trang chạy.
  await ctx.addInitScript(() => localStorage.setItem("games:playerName", "Tester"));
  const page = await ctx.newPage();
  page.on("pageerror", (err) => console.error(vp.name, "pageerror:", err.message));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // chờ WebSocket nhận `state` đầu tiên
  await page.screenshot({ path: `${vp.name}.png` });
  await ctx.close();
}
await browser.close();
```

Mỗi `newContext` có `sessionStorage` riêng, tức một token và một người chơi mới. Muốn xem bàn mà không chiếm ghế thì thêm `?watch=1`.

---

## 8. Thêm một game mới (frontend checklist)

Giả sử game có id `xyz` và route `/xyz`.

1. **Backend trước.** Thêm game ở be_game (`api/[game]`, `src/xyz/`), rồi kiểm tra `/api/xyz/rooms` chạy được. Xem `be_game/docs/GUIDE.md`.
2. **Bản sao lib.** Chép `be_game/src/xyz/{protocol,board|cards}.ts` sang `src/lib/xyz/`. Giữ comment đầu file "Client-side copy … keep in sync". Export `XYZ_WS_PATH = "/api/xyz/ws"`.
3. **Registry.** Thêm một dòng vào `ONLINE_GAMES` trong `src/components/games/gamesRegistry.ts`: `id`, `title`, `short`, `emoji`, `href`, `roomsPath`, `maxPlayers`. Union của `OnlineGame["id"]` cũng phải có id mới. Tab, `AllRoomsPanel` và `isGamesRoute` tự cập nhật theo danh sách này.
4. **Theme tối.** Đặt nền tối + `text-white` trong `layout.tsx` của route game mới (chép từ một game có sẵn), xem §2.4.
5. **Route.** Tạo ba file theo §1.1:
   - `src/app/xyz/layout.tsx`: `metadata`, `div.game-shell` với gradient riêng, `<GamesShell>`.
   - `src/app/xyz/page.tsx`: `<GameLobby …/>`.
   - `src/app/xyz/[room]/page.tsx`: `dynamic(..., { ssr: false })`, `const [name] = useState(getSavedName)`, `?watch=1`.
6. **Bàn.** Tạo `src/components/xyz/XyzTable.tsx`, chép khung của game gần giống nhất (Cá Ngựa hoặc Ô Ăn Quan là gọn nhất):
   - `useGameRoom` + `localize` + `act`/toast, cùng màn hình lỗi và màn hình đang kết nối.
   - `GameHeader` (`primary`: ← Sảnh + mã; `extra`: mời / bảng điểm / luật với `headerBtn` + `HeaderLabel`; `status`: 👀 + reconnecting).
   - `ChatBox row` render ngoài `Table`.
   - `useLiveReactions` + `SeatBubble` + `SpectatorReactions`.
   - `ScoreboardModal note={SCORE_NOTE}`.
   - `TurnRing` / `MyTurnBadge` / `TurnTimerBorder`.
   - `Waiting` với `SettingsTabs` + `RankPointsPicker`, chỉ chủ bàn sửa được.
   - Dialog theo §3.10.
   - Export `XyzRules` cho lobby.
7. **Responsive.** Thử đủ các kích thước ở §7.2. Bàn phải vừa một màn hình, nút ≥ 36px, chừa lề cho cụm chat, có bố cục `short:`.
8. **Hub.** Thêm thẻ game vào `GAMES` trong `src/app/page.tsx`. Cập nhật emoji của `NameGate` trong `GamesShell.tsx` nếu muốn.
9. **Art (nếu có).** Thêm game vào `GAMES` trong `scripts/card-art.mjs` (`names`, `type`, `typeImport`, `exportName`, `about`, `sheets`, và `sizeOf`/`alwaysCrop` nếu cần), một script `art:xyz` trong `package.json`, và một file `docs/XYZ_ART_PROMPTS.md`.
10. **Tài liệu.** Cập nhật `CLAUDE.md` (Route Structure, danh sách excluded routes), `docs/ARCHITECTURE.md` §3.8, và tài liệu này (§1.1, bảng §3, §4).
11. **Kiểm tra.** `npx tsc --noEmit -p .`, `npm run lint`, rồi chạy một ván thật với bot.

---

## 9. Bẫy thường gặp

- **Effect trả về Promise.** Arrow function một dòng như `useEffect(() => ref.current?.scrollIntoView({ behavior: "smooth" }), [])` **trả về** giá trị của `scrollIntoView`. Trình duyệt mới trả về một Promise, và React coi đó là hàm cleanup không hợp lệ. Hãy dùng ngoặc nhọn: `useEffect(() => { ref.current?.scrollIntoView(...); }, [])`. Xem `DiscardPanel` của Đá Quý. Tương tự, `document.exitFullscreen()` và `requestFullscreen()` cần `void …catch(() => {})`.
- **Hydration và `ssr: false`.** Bàn chơi đọc `sessionStorage`, `localStorage`, `window`, `Date.now()` ngay khi render, nên luôn nạp bằng `dynamic(..., { ssr: false })`. `usePlayerName()` trả `null` khi SSR. Đừng render nội dung khác nhau giữa server và client ở hub/lobby; `GamesShell` đã giữ markup trong `invisible` cho trường hợp này. `useHandOrder` đọc storage trong hàm khởi tạo của `useState` (có kiểm tra `typeof window`), nên chỉ an toàn trong cây đã tắt SSR.
- **Tên đóng băng khi mount.** `useGameRoom` kết nối lại khi `name` đổi. Vì vậy trang bàn dùng `const [name] = useState(getSavedName)`, **không** dùng `usePlayerName()`. Nếu đổi sang hook live, đổi tên trên thanh games sẽ rời ghế rồi join lại giữa ván. `RenameDialog` đã báo trước điều này cho người chơi.
- **Log mới nhất ở trên.** Dùng `log.slice().reverse()` (đừng `.reverse()` thẳng trên mảng của view, vì nó sửa state) và render trong `flex flex-col` + `overflow-y-auto`. Không dùng `flex-col-reverse`: nó đảo vị trí bắt đầu cuộn và thứ tự đọc của trình đọc màn hình.
- **`window.confirm` bị chặn trong trình duyệt in-app** (Messenger, Zalo, Facebook…): hàm trả `false` ngay mà không hiện hộp thoại. Với hành động quan trọng, dùng **`ConfirmButton`** dùng chung (`src/components/games/ConfirmButton.tsx`, bấm hai lần, tự huỷ sau 3,5 giây) — mọi nút Kích, Phá sản, Bán đất đều dùng nó. `window.prompt` (fallback khi chép link) cũng có thể bị chặn.
- **Portal.**
  - `GameHeader` portal vào `#games-header-slot`. Ô này chỉ có khi `GamesShell` ở chế độ bàn, và chỉ tìm được sau khi mount (`useEffect`). Ở lần render đầu, header render tại chỗ rồi nhảy lên thanh. Đừng đặt state quan trọng trong header: nội dung bị mount lại khi chuyển chỗ.
  - Overlay toàn màn hình nằm trong phần tử có `transform` hoặc `backdrop-filter` sẽ bị kẹt trong phần tử đó (`fixed` tính theo phần tử cha). Khi đó dùng `createPortal(…, document.body)`, như `BankruptOverlay`.
- **Overlay chặn bấm.** Overlay của framer-motion vẫn nhận click trong lúc `exit`. Thêm `exit={{ …, pointerEvents: "none" }}` (như `ChatBox`, `CardOverlay`) hoặc `pointer-events-none` cho overlay chỉ để trang trí.
- **Timer bị reset bởi broadcast.** Server gửi `state` rất thường xuyên. Đừng đặt timer hết hạn của hiệu ứng trong một effect phụ thuộc `view`, vì nó bị huỷ và đặt lại liên tục. Hãy để hiệu ứng tự hết hạn bằng clock riêng (`useLiveReactions`, `BoomOverlay`, `flying`/`boom` của Cá Ngựa). Đồng thời đừng phát lại những gì đã có khi mới mở bàn (dùng ref `first`/`initial`).
- **Deadline phải qua `localize`.** So `deadline` của server trực tiếp với `Date.now()` của client thì sai khi đồng hồ hai máy lệch nhau. Luôn dời deadline trong `localize`, và khi thêm trường deadline mới, nhớ thêm nó vào đó.
- **Bản sao lib bị lệch.** Đổi luật hoặc protocol ở be_game mà quên chép sang `src/lib/<game>/` thì UI vẫn compile nhưng hiển thị hoặc cho phép sai. Danh sách lá của script art cũng đọc từ `src/lib/<game>/cards.ts`.
- **iOS tự zoom khi focus input.** Font của input phải ≥ 16px. Rule `.game-shell input` đã lo việc này; input đặt ngoài `.game-shell` (ví dụ trong portal ra `document.body`) sẽ không được hưởng.
- **Biến module và `memo`.** `TyPhuTable` giữ `BOARD` (bản đồ hiện tại) ở biến module. Một component `memo` mà cách vẽ phụ thuộc vào nó (vị trí lưới của `Cell`) nhưng không nhận nó qua props sẽ **không vẽ lại khi đổi bản đồ** (từng làm các ô đứng sai chỗ khi đổi 40 → 56 ô). Mọi thứ ảnh hưởng tới hiển thị phải nằm trong props và trong hàm so sánh của `memo`.
- **Đồng hồ trong state của gốc bàn.** Đừng `setState` mỗi 500 ms ở component gốc của một bàn lớn: nó vẽ lại toàn bộ cây. Dùng context như `NowProvider` của Tỷ Phú.
- **Đọc trường mới của server không phòng thủ.** Frontend và be_game deploy tách rời; client mới có thể nói chuyện với server cũ (và ngược lại). Trường thêm sau (`seat.piece`, `looks`, `current.map`) có thể thiếu: luôn có giá trị dự phòng (`pieceOfSeat`, `?? "std"`), đừng `seat.piece.emoji` trực tiếp.
- **Phím tắt chạy đôi.** Space / Enter trên nút đang focus đã được trình duyệt xử lý; `useHotkeys` bỏ qua trường hợp này. Nếu file đã có listener `keydown` riêng (Esc của dialog…), đừng thêm một binding trùng — kiểm tra `grep keydown` trước.
- **`short:` và `lg:` cùng khớp.** Xem §5.1: tablet hoặc điện thoại ngang có thể vừa `sm:`/`md:` vừa `short:`, nên phải kiểm tra cả hai.

- **Tỷ Phú: `Modal` phải render qua portal.** Giữa bàn cờ có lớp có `overflow` / `backdrop-filter`; một phần tử `fixed` nằm trong đó bị kẹt trong khung đó (hộp thoại "Xây nhà" từng chỉ hiện trong khu trung tâm và không đóng được trên tablet / điện thoại). `Modal` trong `TyPhuTable.tsx` dùng `createPortal(…, document.body)`, nên mở từ đâu cũng nằm trên cùng. Khung xanh ở giữa bàn chỉ vừa nội dung (`max-w-md`, nền mờ 85 %) để ảnh nền `public/games/typhu/center.webp` lộ ra xung quanh.
- **Tỷ Phú: hiệu ứng xây.** `BuildBurst` (trong `Cell`) nổ ngay trên ô khi số nhà tăng — chớp sáng, vòng sóng lan ra và tia lửa (khách sạn: vàng, to hơn). Nhà / khách sạn trên bản đồ có viền trắng mỏng (`drop-shadow` 4 hướng) để nổi trên dải màu. Banner giữa bàn (`BuildOverlay`) vẫn giữ.
- **Thư viện dùng chung cho game** (đã thêm vào `package.json`): `@number-flow/react` (số tiền nhảy mượt — `PlayerRow` của Tỷ Phú), `@formkit/auto-animate` (`useAutoAnimate` cho danh sách log / người chơi / khoản vay), `sonner` (một `<Toaster>` trong `GamesShell`; lỗi lệnh và lời mời đổi / vay gửi cho mình hiện bằng `toast()`), `canvas-confetti` (nạp động trong `WinCelebration`, pháo từ hai góc + pháo hoa) và `@use-gesture/react` (`PinchZoom.tsx`: pinch-zoom 1×–2,6× và kéo để di chuyển bàn Tỷ Phú dưới `lg`, nút "🔍 Thu nhỏ"; ở 1× một ngón vẫn cuộn trang, chạm vào ô vẫn mở được). Bàn game khác cần zoom thì bọc bằng `PinchZoom`.
- **Font tiêu đề game**: `gameFont.ts` (Baloo 2, có tiếng Việt) qua `next/font`, đặt biến `--font-game` ở wrapper của `GamesShell`; mọi `h1`/`h2`/`h3` trong các trang game dùng font này, chỗ khác dùng `[font-family:var(--font-game)]`. Chỉ nạp cùng layout games, các trang còn lại của site không bị ảnh hưởng.
- **Tỷ Phú: tự động chơi (tính năng ẩn).** `Ctrl+Shift+Y` gửi `{ type: "auto", on }` lên be_game; **server** chơi thay như với người mất kết nối (mỗi bước `ABSENT_MS` = 2,5 s, xử lý cả tù và nợ — bán tài sản / trả nợ / phá sản), vẫn chạy khi tab bị ẩn và giữ nguyên sau khi tải lại. Khác người mất kết nối: mua ô nếu giá `< AUTO_BUY_BELOW` (300) **và** tiền sau khi mua `> AUTO_KEEP_CASH` (150), cuối lượt tự xây nhà ở chỗ `buildBlocker` cho phép (đủ nhóm màu, xây đều / chuỗi, không thế chấp) — ô ít nhà nhất rồi rẻ nhất — vẫn giữ > 150tr. Đổi đất, vay, trả lời lời mời vẫn thủ công (lời mời gửi tới mình vẫn chờ tới hạn). Huy hiệu "🤖 Tự động chơi" lấy từ `view.auto` (chỉ có trong view của chính mình). Client chỉ có phím tắt trong `Centre` (`TyPhuTable.tsx`); luật nằm ở be_game `src/typhu/game.ts` (`autoStep`, `autoBuild`).
- **Tỷ Phú: nền toàn màn hình** — ảnh `public/games/typhu/center.webp` làm mờ (`blur-2xl`), phóng `scale-110` và `bg-cover` để phủ kín màn hình theo cạnh dài nhất, phủ thêm lớp đen 55 %. Nằm ở đầu root của `TableBody` (`fixed inset-0 -z-10`, root có `isolate`).
