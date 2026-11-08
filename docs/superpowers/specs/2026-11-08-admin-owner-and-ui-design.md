# Bảo vệ admin gốc và nâng cấp trang quản trị — thiết kế

Ngày: 2026-11-08 · Trạng thái: chờ duyệt · Phạm vi: 3 PR, 2 repo

## 1. Bối cảnh và mục tiêu

Admin gốc cần được bảo vệ tại backend khỏi thao tác của admin khác. Trang `/admin` cần dễ quản lý tài khoản trên điện thoại, xác nhận thao tác nhạy cảm, và chặn mật khẩu mới chưa đạt chính sách ngay khi nhập. Đăng xuất chủ động phải hỏi lại. Báo cáo đặt được mật khẩu một ký tự là một lỗi **chưa biết nguyên nhân**, không được suy diễn rằng thiếu validation ở service.

Chỉ viết spec và plan trong lượt này; không triển khai, không chạy chương trình/test, không thay đổi be_game. Các lệnh kiểm tra trong plan dành cho người triển khai sau khi thiết kế được duyệt.

### Nguồn đã đối chiếu

Đường dẫn be_game dưới đây tính từ `D:/WorkSpace/be_game`, mốc được cung cấp là `main@59e2403`. Git read-only `rev-parse` bị chặn bởi dubious ownership; không sửa Git config để vượt qua. Frontend đang ở `feature/admin-owner-and-ui`; có `.claude/` chưa được theo dõi, không đụng tới.

| Nguồn | Nội dung thực tế và hệ quả |
|---|---|
| `CLAUDE.md:68–90`, `:117–131`, `:160–208`; `AGENTS.md` | SCSS Modules colocated cho code mới; alias `@/`, `@components/`, `@lib/`, `@styles/`; chuyển động dùng `m` từ `motion/react` vì `LazyMotion strict`. Quy trình từng task, duyệt plan trước code; bốn checks frontend trước commit. Đọc hướng dẫn Next cục bộ trong `node_modules/next/dist/docs/` trước khi sửa code Next. |
| `docs/superpowers/plans/2026-10-14-game-ui-foundation-pr1.md`, `docs/superpowers/specs/2026-10-14-game-ui-foundation-design.md` | Giữ định dạng Goal/Architecture/Tech Stack/Spec, Global Constraints, Review Focus, task Files/Interfaces và checkbox; spec đánh số mục, có phạm vi và tiêu chí nghiệm thu. |
| `src/app/admin/page.tsx`, `src/components/admin/AdminDashboard.tsx:43–65,75–94,179` | Route có `robots` noindex; dùng `GameThemeScope`. Dashboard xử lý 401/403, gọi stats theo 7/30/90 ngày; `StatCards` hiện nằm trong tab Thống kê, không ở đầu cả trang. |
| `src/components/admin/types.ts:14–38`, `StatCards.tsx` | Stats có `totals: { users, newUsers, views, devices, games, players, playDevices }`, `daily`, bảng xếp hạng. Đã có bảy thẻ; không cần sáng tạo metric mới. Users response có `users,total,page,pageSize`. |
| `src/components/admin/UsersTable.tsx:15,20,98,161` và `UsersSection()` | Tìm kiếm đã debounce 300 ms, gửi `q,page`; bảng `min-w-[52rem]` cuộn ngang. Khoá/hạ quyền hiện dùng `GameButton.confirm` hai lần bấm; mở khoá gọi PATCH ngay. Promote mở `ResetPasswordDialog` gửi role và password cùng request. PATCH thành công thay row trong state và toast. |
| `UsersTable.tsx`, `ResetPasswordDialog()` | Hiện có `const ready = password !== ""`; `problem` chỉ hiển thị khi `tried`. `submit()` vẫn kiểm tra `passwordProblem` trước `onPatch`. Đây là điểm UX cần sửa, **không chứng minh** nguyên nhân backend nhận mật khẩu ngắn. |
| `src/components/auth/password.ts:8–27`, `password.test.ts` | `PASSWORD_MIN=8`, `ADMIN_PASSWORD_MIN=12`, `PASSWORD_MAX=72`; `passwordLength` đếm `[...p.normalize("NFC")].length`. Có test biên, emoji và NFD. |
| `src/components/auth/AccountMenu.tsx:24–31,53`, `session.ts:140–173`, `signOut.test.ts` | Nút Đăng xuất duy nhất gọi `signOut()` ngay; hàm POST logout rồi xoá local session, đóng menu, redirect, kể cả lỗi mạng. HTTP 401 tự clear session. Test signOut hiện kiểm tra lý do revoked/replaced và storage bị chặn, không phải component test. |
| `src/components/game-ui/GameDialog.tsx:7–24`, `GameDialogCentred.tsx`, `GameDialogDrawer.tsx`, `dialogShared.ts`, `GameButton.tsx:38–41` | GameDialog lazy-load Base UI/vaul, portal, title/description/footer, drawer dưới 768 px. Tái sử dụng modal/focus trap của primitive; `confirm` hai lần bấm của GameButton không đáp ứng yêu cầu popup mới. `docs/GAMES_GUIDE.md` §3.13 mô tả cùng bộ kit. |
| `src/components/admin/Charts.tsx`, `RankTables.tsx`, `format.ts`, `format.test.ts`, `Forbidden.tsx` | Giữ lazy chunk Recharts, các bảng thống kê và formatter hiện có; `formatDateTime` dùng UTC+7, null hiện gạch ngang; `pageCount` ít nhất 1. Không mass-convert Tailwind các phần này. |
| `vitest.config.mts:8–10` | `environment: "node"`, include `src/**/*.test.ts` và `scripts/**/*.test.mjs`; không có môi trường component/DOM. Logic mới tách `.ts`, giao diện kiểm bằng browser. |
| be_game `src/accounts/service.ts:100–110,143–146,277–301` | `ADMIN_USERNAMES` chỉ giữ chỗ qua `reservedKeys()`, không cấp quyền. `adminUser()` và GET list đang serialize riêng. `adminUpdate()` chỉ load target trong nhánh password/promote; `validatePassword(patch.password, patch.role ?? target.role)` ở dòng 292. Phải load target cho mọi mutation để guard owner. |
| be_game `src/accounts/username.ts:5–10,14–26`, `src/server/store.ts:99` | `normalizeUsername()` trả key bằng `nameKey`; `nameKey` NFC → trim → gộp whitespace → lowercase. Password mới user 8–72/admin 12–72 code point NFC; login cũ không áp minimum. |
| be_game `src/server/authRoutes.ts:117–175,178–207` | Register/login, rooms, logout, GET/PATCH me, GET/PATCH prefs đã có. **Có tự đổi mật khẩu** tại `PATCH /api/auth/me` (`password,oldPassword`), không cần route mới. GET stats; GET users gọi `svc.store.listUsers(q,page,50)` và trả `pageSize:50`; PATCH đọc JSON rồi chuyển `b.password` vào `adminUpdate`. |
| be_game `src/accounts/store.ts:27,208–213`, `src/accounts/pg.ts:210–227` | Cả RAM và Postgres tìm trước, phân trang sau, mặc định tạo mới nhất rồi id; Postgres hiện đếm games chỉ cho trang đã chọn. Muốn sort games toàn cục phải đếm trước LIMIT/OFFSET. |
| be_game `src/tools/bootstrap-admin.ts:19–30,40–52`, `test/bootstrap-admin.test.ts` | `grantAdmin(store,uid,apply,password?)`: dry-run, từ chối disabled/unknown, mật khẩu admin mới qua stdin, bump session; tài khoản đã admin thì không đổi. Không sửa bootstrap thành cơ chế tự cấp quyền theo env. |
| be_game `test/accounts-admin.test.ts`, `test/accounts-routes.test.ts`, `test/accounts-store.test.ts` | Service test đã kiểm policy theo vai trò cuối cùng và promote thiếu password; route harness có `call()`, `registerAdmin()` dùng bootstrap và HTTP server thật. Store test chạy chung RAM/pg-mem, đã test phân trang và ký tự `%`; `_` có giới hạn pg-mem được ghi chú trong pg.ts. |
| `README.md:83,152,184,206`, `.env.example:11,18`, `docs/GAMES_GUIDE.md:1445,1448`, `CLAUDE.md:9–13` | Hướng dẫn admin đầu tiên bằng ADMIN_USERNAMES đã lỗi thời; ví dụ fallback dễ bị hiểu đang bật. Sửa mô tả hiện tại, không đổi env live trong frontend. |
| be_game `README.md:171`, `.env.example:28–31`, `docs/GUIDE.md:245–277,312`, `docs/SELF_HOSTING.md:50,154–168`, `docs/DEPLOYMENT.md:61,78–81` | Backend đã mô tả reservation/bootstrap; bổ sung OWNER_USERNAME và phân biệt rõ ba khái niệm. Hai file triển khai thực tế nằm trong `docs/`, không nằm ở repo root. |
| `docs/CHANGELOG.md:12` trở đi; be_game `package.json:12–19` | Changelog có tiêu đề riêng, Date/branch, bullet quyết định và trạng thái. Chỉ thêm entry mới. Backend scripts: lint, format:check, typecheck, test; không tự thêm build gate không tồn tại. |

## 2. Phạm vi và lộ trình

1. **P1 — be_game**, nhánh mới từ `main`, PR vào `main`: tái hiện/điều tra mật khẩu trước; owner guard/flag; chuẩn bị API lọc/sort toàn danh sách cho P3; tests và docs/env backend. Đưa API P3 vào P1 là quyết định thiết kế để giữ đúng ba PR và backend luôn đi trước frontend.
2. **P2 — zonenop-game**, `feature/admin-owner-and-ui` từ `develop`, PR vào `develop`: badge/rules owner, live password validation, logout confirm, sửa tài liệu admin/fallback, entry CHANGELOG. Chấp nhận backend cũ thiếu flag.
3. **P3 — zonenop-game**, nhánh mới từ `develop` sau P2, PR vào `develop`: bộ lọc/sort dùng API P1, cards mobile, popup mutation, tổng quan ở đầu trang. Không thay đổi API ngoài phần đã chuẩn bị ở P1.

Ngoài phạm vi: Cloudflare Web Analytics, CSP enforcement, các hạng mục hardening khác, bật fallback, đổi policy login cũ, thêm metric, đổi schema owner/role, thay thư viện dialog, chuyển toàn bộ Tailwind sang SCSS.

## 3. Owner: nguồn sự thật và hành vi

### 3.1. Cấu hình

Env **chỉ backend** `OWNER_USERNAME`; giá trị vận hành do maintainer đặt đồng nhất trên Vercel và server `.env`. Không ghi username thật trong code, docs hay fixture; `.env.example` dùng `OWNER_USERNAME=<owner-username>`, ghi rõ phải thay placeholder hoặc để trống ở dev. Không có auto-promote: tài khoản owner phải được cấp admin theo id qua bootstrap hoặc admin sẵn có.

Owner là tài khoản có `nameKey(user.username) === nameKey(OWNER_USERNAME)` khi env sau trim không rỗng. Không cần role mới, không migration DB, không thêm owner vào PublicUser/session. Helper backend `isOwnerUsername(username: string, ownerUsername: string | undefined): boolean` gọi đúng `nameKey`, không tự viết normalizer khác.

**Quyết định khi unset:** server vẫn chạy; không tài khoản nào có `isOwner=true`, không có owner protection. `warnIfOwnerUnconfigured(env: NodeJS.ProcessEnv = process.env): void` cảnh báo một lần mỗi process từ `createGameServer()` cạnh `warnIfAccountsUnconfigured()`: `[be_game] OWNER_USERNAME is not set; owner protection is disabled.` Không log giá trị env. Chọn cách này để không gây outage toàn bộ game khi rollout cấu hình mới; release checklist bắt buộc kiểm flag trên cả hai backend. Một cold-start Vercel là một process mới, không hứa chỉ một log cho toàn deployment.

Đưa key của `OWNER_USERNAME` vào cùng `reservedKeys()` với `ADMIN_USERNAMES` (`service.ts:104–110`), qua cơ chế chuẩn hoá tên hiện có. `register()` (`:157`) từ chối đăng ký tên owner bằng `RESERVED_NAME`; `updateMe()` (`:229`) từ chối người không phải admin đổi sang tên owner bằng cùng lỗi. Giữ nguyên hành vi `ADMIN_USERNAMES`, không cấp role qua env.

### 3.2. Server guard

`adminUpdate(admin,id,patch)` giữ validation shape/self guard hiện có; đọc target bằng `store.userById(id)` trước hash hoặc write cho **mọi** PATCH; không có target → 404 như cũ. Admin khác (`admin.id !== target.id`) gặp owner thì:

| Patch | Kết quả |
|---|---|
| Có `role`, kể cả cùng giá trị | 403 `Không thể đổi quyền của chủ sở hữu` |
| `disabled: true` | 403 `Không thể khoá chủ sở hữu` |
| Có `password`, kể cả rỗng/ngắn | 403 `Không thể đặt mật khẩu cho chủ sở hữu` |
| Chỉ `disabled: false` | Cho phép mở khoá; yêu cầu đã chốt bảo vệ thao tác khoá, không thêm cấm khôi phục tài khoản |
| Patch trộn trường bị cấm với trường khác | Từ chối toàn request, không đổi role/hash/sessionVersion hoặc cache |

Ưu tiên lỗi role → khoá → password khi trộn trường. Owner vẫn không tự hạ quyền/tự khoá do self guard cũ; tự đặt password qua admin PATCH vẫn theo policy và thu hồi phiên như hiện tại. Đường khuyến nghị tự đổi là `PATCH /api/auth/me` có oldPassword, trả session mới; không bị owner guard chặn.

Logic thuần trong `src/accounts/owner.ts`: `ownerUpdateProblem(actorId: string, target: { id: string; username: string }, patch: { role?: Role; disabled?: boolean; password?: string }, ownerUsername: string | undefined): string | null`. Không thay thế authorization của route; route vẫn đòi admin.

### 3.3. Contract và UI

Backend `AdminUser` thêm `isOwner: boolean`; cả GET `/api/admin/users` và `adminUser()` của PATCH dùng cùng helper. Không lộ hash, sessionVersion, usernameKey, env. Frontend `AdminUser` dùng `isOwner?: boolean` để đọc backend cũ; missing tương đương false cho **hiển thị**, không suy luận owner từ username hoặc từ self.

Frontend `getUserActionRules(user: AdminUser, selfId: string | null): { canChangeRole: boolean; canLock: boolean; canUnlock: boolean; canResetPassword: boolean }` trong `userActions.ts`. Self: không role/lock; owner khác: không role/lock/password; unlock vẫn cho phép. Badge `Chủ sở hữu` chỉ khi `isOwner === true`; ẩn các action bị cấm trên row/card owner khác, vẫn có mô tả `Tài khoản chủ sở hữu được bảo vệ`. Busy tiếp tục vô hiệu nút; backend 403 hiển thị qua toast, không toast thành công.

**Giới hạn có chủ đích:** đây là nhận diện theo tên hiện tại. `updateMe()` đang cho admin đổi tên; owner tự đổi tên sẽ mất bảo vệ tới khi người vận hành đổi OWNER_USERNAME tương ứng. Giữ chỗ tên owner chặn người dùng thường đăng ký/đổi sang tên đó, kể cả khi owner chưa tồn tại hoặc đã đổi tên. Admin khác vẫn có thể đổi sang tên owner đã bỏ trống và nhận flag nếu env không cập nhật vì họ đã là admin; đây là giới hạn còn lại. Không âm thầm thêm khoá đổi tên hay chuyển sang uid trong change này; runbook bắt buộc phối hợp đổi env cả hai backend khi đổi tên owner. ADMIN_USERNAMES chỉ là reservation đăng ký/rename cho user, admin vẫn có thể rename; không coi đó là owner guard.

## 4. Lỗi mật khẩu: tái hiện trước khi sửa

Policy mới giữ nguyên user 8–72/admin 12–72 NFC code point, theo **vai trò sau patch**; promote bắt buộc password mới cùng request và thông báo `ADMIN_NEEDS_PASSWORD`. Login legacy vẫn chấp nhận mật khẩu cũ ngắn.

Task triển khai đầu tiên thêm route-level regression qua `handleAccountRoute` bằng harness HTTP sẵn có, không mock `adminUpdate`: PATCH `/api/admin/users/<id>` body `{password: "1"}` cho target user và target admin. Mong đợi HTTP 400, `{ok:false,error}` đúng minimum 8/12, hash/role/disabled/sessionVersion không đổi, phiên cũ còn hợp lệ, đăng nhập bằng password bị từ chối không thành công. Kiểm thêm promote với `role:"admin",password:"1"` không đổi quyền.

Các test này **có thể đã xanh** trên 59e2403: ghi đúng kết quả, không làm test fail giả và không tuyên bố đã tái hiện. Nếu xanh, tiếp tục thu thập bằng chứng; bản vá chỉ được gọi là fix root cause khi có case thất bại trước và qua sau. Nếu không tái hiện được, giữ regression, ghi chưa tìm thấy nguyên nhân và để hạng mục fix mở; không sửa policy phỏng đoán.

### Kiểm tra production bởi maintainer/người triển khai

Đây là thao tác trên hệ thống thật: maintainer thực hiện, hoặc agent chỉ thực hiện khi maintainer đồng ý rõ trong chat cho từng lần tạo tài khoản tạm, reset hay khoá. Không có bước nào tự động tạo tài khoản production trong CI/test.

1. Dùng một tài khoản thường tạm, không phải owner/admin hoặc tài khoản người thật; tạo với mật khẩu hợp lệ nhập riêng, không lưu vào báo cáo. Ghi UTC, frontend origin, backend request origin và `/api/health` commit của hai backend; không copy token/credentials.
2. Đăng nhập admin, tìm đúng tài khoản tạm bằng id/tên. Mở Network, tắt preserve log khi kết thúc; ghi method/path, tên trường JSON và kiểu dữ liệu (không xuất HAR chứa token/password).
3. Trên UI đang chạy, thử reset một ký tự bằng fixture tái hiện nêu trên. Ghi UI báo gì, có request không, endpoint nào, status và error trả về. Nếu frontend mới chặn submit, dùng request cùng PATCH/body trong công cụ API cục bộ với Bearer lấy riêng để kiểm server; không dán token vào docs/lệnh shell/history.
4. Trong cửa sổ riêng thử đăng nhập tài khoản tạm bằng giá trị bị từ chối; phải thất bại. Kiểm mật khẩu hợp lệ cũ vẫn hoạt động; không nhầm việc login legacy cho phép password ngắn với việc reset cho phép tạo password ngắn.
5. Nếu server nhận reset ngắn, khôi phục ngay tài khoản tạm bằng mật khẩu hợp lệ mới. Kết thúc thì khoá tài khoản tạm; không thêm chức năng xoá tài khoản. Không thử đặt password ngắn cho admin live; admin target chỉ kiểm trong automated test/local.
6. Lặp lại trên hai frontend build và kiểm từng backend trực tiếp với tài khoản tạm, không bật fallback. Ghi thông tin đã loại bí mật trong PR; không tuyên bố đã làm những bước chưa thực hiện.

Giả thuyết cần kiểm chứng: code path khác; JSON sai field/nested/type; NFC/code point so với UTF-16/bytes; frontend gọi endpoint/base khác; response/toast hoặc account target bị nhầm; phiên bản deploy **tại thời điểm báo lỗi** cũ hơn hiện nay. Đối chiếu commit hiện tại không chứng minh phiên bản từng chạy trước đó. Chỉ sửa file/path được bằng chứng chỉ tới; thêm test thất bại ở tầng đó trước patch tối thiểu.

### Frontend live validation

`ResetPasswordDialog` dùng helper thuần `resetPasswordState(password: string, targetRole: PasswordRole, promote: boolean): { role: PasswordRole; problem: string | null; ready: boolean }` trong `resetPassword.ts`, tái sử dụng `passwordProblem`/`passwordHint`. `ready` chỉ true khi không có problem; promote dùng role admin. Hiện hint `8–72 ký tự.` / `12–72 ký tự.` từ đầu, lỗi minimum xuất hiện khi bắt đầu nhập; không chờ submit, không `role="alert"` mỗi phím. Field `type="password"`, `aria-describedby` liên kết hint/lỗi, `aria-invalid` khi nonempty invalid. Submit còn guard lại helper + busy; Enter không bypass. Khi đổi target/đóng, xoá password và state; server error giữ dialog mở. Không log password.

## 5. Đăng xuất có xác nhận

Chỉ đổi handler nút `Đăng xuất` ở `AccountMenu`. Dùng chính `GameDialog` đang mở, chuyển nội dung sang chế độ confirm để tránh chồng hai focus trap trên mobile. Title `Đăng xuất?`; description `Bạn có chắc muốn đăng xuất khỏi tài khoản này?`; nút `Huỷ` (mặc định focus) và `Đăng xuất` danger. Huỷ/Esc/backdrop/dismiss drawer quay lại nội dung account, không gọi API hoặc clear session; focus về nút Đăng xuất. Đóng menu account vẫn giữ hành vi cũ.

Chỉ confirm mới gọi `signOut()` đúng một lần, disabled/loading trong khi chờ; giữ nguyên POST logout, xử lý lỗi mạng đăng xuất local, onClose và redirect. Session revoked/expired, HTTP 401, `signOutGameSession` không qua popup, không sửa các đường tự động để dùng confirm. Nếu session mất khi confirm đang mở, menu biến mất như hiện tại, không request logout trễ cho tài khoản khác. Trước confirm kiểm session còn đúng token đã mở; đổi tài khoản thì huỷ confirm.

## 6. Nâng cấp `/admin` (P3)

### 6.1. Search/filter/sort toàn cục

**Chọn API params**, vì response hiện chỉ có 50 dòng/trang (`authRoutes.ts:192–194`), không phải toàn user. Không lọc/sort riêng một trang, không tải vét tất cả trang. Giữ search debounce 300 ms, nâng chuẩn hoá NFC và whitespace theo `nameKey`; không bỏ dấu tiếng Việt.

`GET /api/admin/users?q=&page=1&filter=all&sort=createdAt&order=desc`. Filter enum `all | admin | disabled | owner` (một lựa chọn); sort `createdAt | lastLoginAt | games`; order `asc | desc`. Default giữ tương thích `all,createdAt,desc`; pageSize vẫn 50, q giới hạn 50 như cũ; enum sai → 400 `Bộ lọc hoặc sắp xếp không hợp lệ`. Search AND filter, sau đó sort **trước** phân trang; `total` là tổng khớp. Tie-break `id asc`, lastLoginAt null luôn cuối cả hai chiều. Empty owner config + filter owner → không có dòng. Games=0 khi không có result. Backend RAM và Postgres cùng semantics; SQL bind values, ORDER BY chỉ từ allowlist, literal `%`, `_`, backslash trong search không thành wildcard.

Trong backend thêm module thuần `adminUsersQuery.ts` chứa types, parser, normalizer, predicate/comparator cho RAM; Postgres dùng cùng options/allowlist semantics, không load cả DB vào RAM. `AccountStore.listUsers(q,page,pageSize,options?)` giữ ba tham số cũ, options gồm filter/sort/order/ownerKey. Postgres group games toàn bộ candidate trước LIMIT để không sort sai trang; count dùng cùng predicate. Không thêm metrics hay migration.

Frontend `usersQuery.ts` giữ type/URL builder thuần, dùng params đã định nghĩa, không duplicate thuật toán sort server. Nhãn: `Tìm tên đăng nhập`, `Lọc tài khoản`: `Tất cả`, `Quản trị viên`, `Bị khoá`, `Chủ sở hữu`; `Sắp xếp theo`: `Ngày tạo`, `Đăng nhập cuối`, `Số ván`; `Thứ tự`: `Tăng dần`, `Giảm dần`. Đổi q/filter/sort/order về page 1; key request gồm mọi tham số, không để response cũ ghi đè mới. Sau PATCH thành công refetch (không chỉ replace row) để membership/thứ tự/total đúng; nếu trang cuối rỗng sau mutation, về trang hợp lệ rồi tải lại.

P3 yêu cầu cả hai backend có P1 trước release. P2 chỉ yêu cầu optional owner flag; nếu buộc rollback backend sau P3, phải rollback P3 hoặc ẩn các control nâng cao để tránh server cũ im lặng bỏ qua params. Không dùng sự thiếu flag làm bằng chứng API sort được hỗ trợ.

### 6.2. Bảng và cards

Từ 768 px dùng bảng; dưới 768 px dùng list cards, không bắt cuộn ngang bảng rộng. Mỗi card có tên (wrap tên dài), badge role/owner/disabled/self, số ván, ngày tạo, đăng nhập cuối và cùng action component/rules với desktop. Tách `UserActions.tsx` dùng chung; chỉ một dialog host ở UsersTable. Hai layout dùng cùng tập kết quả, CSS `display:none` cho layout ẩn để không có nút trùng trong cây accessibility/tab order. Các nút là native/GameButton với tên rõ, vùng chạm ≥44 px; card không biến thành một div click không dùng bàn phím được.

Style mới trong `UsersTable.module.scss`, `UserActions.module.scss`, `AdminDashboard.module.scss`, `StatCards.module.scss` (chỉ phần sửa). Dùng token từ `@styles/variables`, không style riêng trong globals, không convert Charts/RankTables hoặc kit hiện có.

### 6.3. Confirm mutation

Khoá, mở khoá, hạ quyền mở `GameDialog` thay confirm hai lần bấm/call ngay. Copy: `Khoá tài khoản?` / `Mở khoá tài khoản?` / `Bỏ quyền quản trị?`; description có username, khoá nêu `Mọi phiên đăng nhập của tài khoản này sẽ bị đăng xuất.` Nút `Huỷ` và action `Khoá tài khoản` / `Mở khoá` / `Bỏ quyền`. Promote tiếp tục dialog nhập mật khẩu, submit `Cấp quyền` là xác nhận rõ role + password; không thêm popup thứ hai.

Chưa confirm không PATCH; cancel/dismiss không thay state server; busy chống double submit và không dismiss lúc request đang chạy; lỗi giữ dialog, toast lỗi; thành công mới đóng và refetch. Re-check action rules trên row hiện hành trước confirm; target biến mất/mất quyền thì đóng thay vì gửi patch cũ. Backend luôn quyết định cuối cùng.

### 6.4. Tổng quan đầu trang

Đưa `StatCards` hiện có lên sau header, **trước GameTabs**, cùng bộ chọn 7/30/90 ngày và loading/error/retry cho stats; hiển thị ở cả hai tab, không render trùng trong StatsView. Giữ bảy field và nhãn hiện có (`Lượt xem`, `Số máy`, `Ván đã chơi`, `Người chơi`, `Máy chơi`, `Người dùng mới`, `Tổng người dùng`); tổng user là tất cả thời gian, các chỉ số kỳ giữ ý nghĩa API. Không tính admin/locked/owner totals từ một trang users, không nhầm devices với players. Charts/rankings vẫn tab Thống kê và lazy Recharts. Stats lỗi không cản quản lý users; 401/403 vẫn xử lý quyền như dashboard hiện tại. Không render stats cũ của phiên trước khi đổi tài khoản.

## 7. Tài liệu và rollout

P1 sửa be_game `README.md`, `docs/GUIDE.md`, `docs/SELF_HOSTING.md`, `docs/DEPLOYMENT.md`, `.env.example`: ADMIN_USERNAMES chỉ reservation, bootstrap theo id với `--yes --password-stdin`, OWNER_USERNAME chỉ protection; thêm contract/filter/guard, cảnh báo unset và giới hạn rename. Không sửa entries lịch sử.

P2 sửa frontend `README.md:83`, `docs/GAMES_GUIDE.md` §10.5/10.6 và mô tả password §10.1; `.env.example:11` dẫn sang env backend và bootstrap, không đặt OWNER_USERNAME thành public env. Ví dụ local không tuyên bố ADMIN_USERNAMES tự cấp admin; bootstrap tool đòi DATABASE_URL nên không hứa lệnh đó cấp admin cho memory store chạy ở process khác. Muốn thử admin local dùng Postgres dev cùng DATABASE_URL và bootstrap; memory-only chỉ thử tài khoản thường.

Sửa `CLAUDE.md` đoạn mở đầu, README bảng env/deploy notes và comment `.env.example`: code **hỗ trợ** NEXT_PUBLIC_TIENLEN_FALLBACK_URL nhưng **cả build self-host lẫn Vercel hiện không cấu hình**. Giữ giá trị rỗng và ví dụ deploy rỗng; không bật, không thay runtime/failover. Các đoạn nói điều kiện failover được giữ ở dạng khả năng khi cấu hình, không mô tả trạng thái live đang bật. P2/P3 thêm entry riêng đầu `docs/CHANGELOG.md` theo Date/branch/bullets, không viết lại lịch sử.

Deploy P1: đặt OWNER_USERNAME đúng tài khoản đã xác minh trên Vercel project env (scope chạy backend tương ứng) và server `.env` **trước/khi merge**, `compose.selfhost.yml` phải có `OWNER_USERNAME: ${OWNER_USERNAME:-}` cạnh `ADMIN_USERNAMES` trong `environment` và thêm tên biến vào comment danh sách `.env` dòng 3; chỉ đặt server `.env` chưa truyền env vào container. Restart/redeploy để nhận env. Smoke check trên `play-api.fudio101.com`: GET `/api/admin/users` có `isOwner: true` đúng tài khoản + forbidden PATCH bằng admin khác trả 403 là bằng chứng env đã tới container. Kiểm cả hai `/api/health` đúng commit mới; GET admin users có owner flag đúng, PATCH bị từ chối server-side bằng admin khác. Không commit tên thực tế. Release P2 sau P1; missing flag vẫn render được nếu lệch rollout. P3 sau P2 và API P1 trên cả hai backend. Merge/release cần maintainer quyết định theo quy trình repo; plan không tự cấp quyền merge.

## 8. Kiểm thử và tiêu chí nghiệm thu

- Backend: owner normalization/unset; guard khác admin và self; patch trộn không có partial writes; GET/PATCH flag nhất quán; tự đổi qua me còn chạy; policy boundary/NFC và route password một ký tự; query lọc/sort trước paging trên RAM/pg; bootstrap không auto-promote bằng env.
- Frontend node tests: owner-action rules/missing flag; resetPasswordState biên 8/12/72, promote, NFC; query URL/default/reset page. Giữ `signOut.test.ts` và các test formatter. Không thêm component test `.tsx` rồi coi là vitest đã chạy.
- Browser desktop và **375 px**: mọi filter/sort/paging, tên dài/null login/empty/error/retry; owner actions; reset password khi gõ/Enter; khoá/mở khoá/role cancel/confirm/double click; summary trước tab. Dialog tab/shift-tab trap, focus ban đầu/cancel/focus restore, Esc/backdrop/swipe, nhãn và busy. Logout confirm/cancel và network failure; auto revoked không popup. Kiểm Network bảo đảm huỷ không gửi mutation.
- Cuối P1: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` đều exit 0. Cuối mỗi P2/P3: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều exit 0, browser checks có bằng chứng đã loại bí mật. Không claim PASS trong lượt viết tài liệu này.

## 9. Risks

- Unset/sai env có thể khiến owner không được bảo vệ; một warning không thay thế smoke test hai backend. Đổi tên owner và cấu hình lệch có thể chuyển/mất protection.
- Backend cũ thiếu flag khiến UI P2 không ẩn thao tác; backend guard P1 mới là bảo vệ thực. Rollback P1 mất guard; phải xử lý cấu hình/version trước mở lại quản trị.
- Sort games toàn cục có chi phí aggregate; kiểm query/index hiện có, không đánh đổi đúng dữ liệu bằng sort một trang. Tránh SQL injection qua sort và mismatch RAM/pg, nhất là null/wildcard.
- Logout và password reset ảnh hưởng phiên; không nhầm lỗi mạng với thất bại logout local; không để confirm chậm tác động phiên đăng nhập mới.
- Di chuyển summary có thể trùng request/thẻ hoặc lộ stats phiên cũ; dùng state/auth boundary hiện có. Mobile hai layout có thể gây duplicate tab stops nếu ẩn sai.
- Lỗi password có thể không tái hiện trên commit hiện tại; chỉ regression/UX improvement không đủ để kết luận root cause đã sửa.

## 10. Review Focus

1. Env NFC/hoa thường/whitespace và rename owner: flag/guard dùng cùng nameKey, tài liệu nêu mất bảo vệ khi tự đổi tên (P1 tests và runbook).
2. Mixed PATCH owner, password sai kiểu và promote: không partial write, không bypass minimum theo role cuối (P1 route/service tests).
3. >50 user, null lastLogin, cùng số ván, literal wildcard: sort/filter toàn cục và total đúng, SQL allowlist (P1 store/query tests, P3 browser).
4. Dữ liệu/phiên thay đổi khi dialog hoặc request mở: không gửi mutation cho target/session cũ, không response stale ghi đè (P2/P3 browser và query/rules tests).
5. Drawer 375 px, keyboard và cancel: focus trap/restore, không gọi API khi huỷ, auto sign-out không bị chặn (P2/P3 browser, regression signOut tests).

## 11. Câu hỏi mở

Không còn lựa chọn sản phẩm cần mở lại. **Nguyên nhân lỗi password chưa xác định** là kết quả điều tra bắt buộc của Task 1, không phải giả định thiết kế. Nếu chưa có case tái hiện, báo trạng thái này và không đánh dấu phần fix đã hoàn tất.
