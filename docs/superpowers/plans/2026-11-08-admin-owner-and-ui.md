# Admin owner và UI quản trị — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bảo vệ owner tại backend, điều tra lỗi reset password một ký tự, thêm xác nhận đăng xuất và nâng cấp `/admin` trên desktop/điện thoại qua ba PR.

**Architecture:** be_game giữ authorization, owner policy và query users toàn cục; frontend chỉ dùng owner flag để hiển thị/ràng buộc thao tác. Tái sử dụng GameDialog/GameButton, tách logic thuần `.ts` để chạy vitest node. API vẫn phân trang 50 dòng nên search/filter/sort thực hiện trước phân trang ở backend, không lọc một trang ở client.

**Tech Stack:** be_game Node 22/TypeScript, Postgres/RAM, vitest/pg-mem; zonenop-game Next.js 16/React, SCSS Modules, game-ui (Base UI/vaul), `motion/react` (`m`), vitest node.

**Spec:** `docs/superpowers/specs/2026-11-08-admin-owner-and-ui-design.md` (đọc cùng plan).

## Global Constraints

- Lượt hiện tại chỉ tạo hai file spec/plan; không code, không commit, không chạy node/npm/npx/tests. Tất cả checkbox/lệnh dưới đây là công việc **sau khi plan được duyệt**, không phải kết quả đã chạy.
- P1 ở `D:/WorkSpace/be_game`: nhánh `feature/admin-owner-and-ui` mới từ `main`, PR vào `main`; mốc đầu vào được cung cấp `59e2403`. P2 frontend dùng nhánh `feature/admin-owner-and-ui` từ `develop`, PR vào `develop`; P3 nhánh `feature/admin-ui-enhancements` từ `develop` sau P2, PR vào `develop`. Mỗi phase một PR, kết thúc bằng checks riêng; không tự merge.
- Thực hiện quy trình STEP 1–10 trong frontend `CLAUDE.md:160–208`; kiểm trạng thái/base trước code, không ghi đè thay đổi có sẵn, duyệt plan trước triển khai. Backend đọc rules của repo đó khi bắt đầu triển khai. Không sửa Git config để vượt dubious ownership ở phiên viết plan.
- Owner env `OWNER_USERNAME` **chỉ backend**, không hard-code tên thật, không ghi tên thật/secret/password thật vào docs/examples/tests. `.env.example`: `OWNER_USERNAME=<owner-username>`. Env không cấp role; bootstrap theo uid `--yes --password-stdin`.
- Unset/whitespace-only OWNER_USERNAME: không owner protection, một startup warning mỗi process; server tiếp tục chạy. Cấu hình và xác minh cả hai backend trước/khi merge P1.
- Policy password mới: user **8–72**, admin **12–72**, NFC code points; theo role cuối request. Login legacy không thêm minimum. Promote cần password mới trong cùng request.
- P2 đọc `isOwner?: boolean`, thiếu flag không crash; không đoán owner từ tên/self. P3 chỉ release khi API P1 có ở cả hai backend.
- SCSS Modules colocated cho style mới, alias hiện có; không mass-convert Tailwind untouched. Nếu cần animation dùng `m` từ `motion/react`, CSS tôn trọng reduced-motion. Đọc guide Next trong `node_modules/next/dist/docs/` trước sửa code Next theo AGENTS.md.
- Dùng GameDialog cho confirm, không window.confirm; giữ modal focus trap của primitive, nhãn rõ, vùng chạm ≥44 px; keyboard dùng được với cards. Không thêm test framework DOM: `vitest.config.mts:8–10` là node, nhận `src/**/*.test.ts` (+ script `.mjs`).
- Giữ fallback tắt: không đặt NEXT_PUBLIC_TIENLEN_FALLBACK_URL trên build nào; sửa docs mô tả khả năng code và trạng thái live. Không analytics/CSP enforcement/hardening khác.
- Backend checks: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`. Frontend mỗi PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, browser desktop/375 px và dialog.

## Review Focus

1. Owner env khác hoa/thường/NFD/whitespace hoặc unset: guard/flag nhất quán, không auto-promote; self rename có giới hạn được ghi rõ — Task 2 test owner + Task 4 runbook.
2. PATCH trộn role/disabled/password, password sai kiểu, promote thiếu password: không partial write; validate role cuối — Task 1/2 route và service tests.
3. >50 users, null login, games tie, search `%`/`_`/backslash: lọc/sort trước paging, count đúng và SQL không nhận ORDER BY tuỳ ý — Task 3 tests chung hai store.
4. Response/target/session cũ khi đổi filter hoặc confirm: không stale overwrite, không logout tài khoản mới, không success toast khi bị backend từ chối — Task 5/6/8 browser và pure tests.
5. Drawer 375 px và bàn phím: không double focus trap/tab stops, cancel không PATCH/logout, revoked tự thoát không hỏi — Task 6/8/9 browser; giữ regression `signOut.test.ts`.

---

## Bản đồ file và phụ thuộc

| Phase | Tạo mới | Sửa |
|---|---|---|
| P1 | be_game `src/accounts/owner.ts`, `test/accounts-owner.test.ts`, `src/accounts/adminUsersQuery.ts`, `test/admin-users-query.test.ts` | `src/accounts/service.ts`, `src/accounts/store.ts`, `src/accounts/pg.ts`, `src/server/authRoutes.ts`, `src/server/app.ts`, `test/accounts-admin.test.ts`, `test/accounts-routes.test.ts`, `test/accounts-store.test.ts`, `README.md`, `docs/GUIDE.md`, `docs/SELF_HOSTING.md`, `docs/DEPLOYMENT.md`, `.env.example`, `compose.selfhost.yml` |
| P2 | frontend `src/components/admin/userActions.ts`, `userActions.test.ts`, `resetPassword.ts`, `resetPassword.test.ts`, `ResetPasswordDialog.module.scss`, `src/components/auth/logoutConfirm.ts`, `logoutConfirm.test.ts`, `AccountMenu.module.scss` | `src/components/admin/types.ts`, `UsersTable.tsx`, `src/components/auth/AccountMenu.tsx`, `README.md`, `CLAUDE.md`, `.env.example`, `docs/GAMES_GUIDE.md`, `docs/CHANGELOG.md` |
| P3 | frontend `src/components/admin/usersQuery.ts`, `usersQuery.test.ts`, `UserActions.tsx`, `UserActions.module.scss`, `UsersTable.module.scss`, `AdminDashboard.module.scss`, `StatCards.module.scss`, `UserActionDialog.tsx` | `UsersTable.tsx`, `AdminDashboard.tsx`, `StatCards.tsx`, `docs/GAMES_GUIDE.md`, `docs/CHANGELOG.md` |

`src/app/admin/page.tsx`, `Charts.tsx`, `RankTables.tsx`, `format.ts`, `format.test.ts`, game-ui primitives, auth `session.ts`, `password.ts`, `signOut.test.ts` giữ nguyên nếu không có bằng chứng cần sửa. Task 1 chỉ mở thêm sửa `service.ts`/`username.ts`/`authRoutes.ts` hoặc frontend `UsersTable.tsx`/`session.ts` khi case thất bại chỉ tới đúng file đó; ghi file và nguyên nhân cụ thể trong PR, không refactor lan rộng. Chưa có root cause nên không thể định trước một patch body trung thực.

## P1 — be_game (backend trước)

### Task 1: Tái hiện password một ký tự, xác định nguyên nhân rồi mới fix

**Files:**
- Test: `test/accounts-routes.test.ts`, `test/accounts-admin.test.ts`.
- Read: `src/server/authRoutes.ts:45–61,196–207`, `src/accounts/service.ts:277–301`, `src/accounts/username.ts:20–26`, `src/tools/bootstrap-admin.ts`; frontend `UsersTable.tsx` (`ResetPasswordDialog`, `UsersSection.patch`), `session.ts` (`authRequest`).
- Modify sau khi có bằng chứng: chỉ file trong các đường trên chứa nguyên nhân; ghi chính xác path/test trong PR. Kết quả điều tra vào mô tả PR đã loại bí mật, không tạo file báo cáo riêng không cần thiết.

**Interfaces:**
- Consumes: harness `call(method,path,body?,{token,...})`, `registerAdmin()`, `getAccountService()` và store `userById`; đi HTTP thật → `handleAccountRoute` → `adminUpdate`, không mock validator/service.
- Produces: route regression xác minh `{password:"1"}` bị từ chối cho user/admin và bằng chứng phân biệt bug code với phiên bản deploy/luồng khác; không đổi public API/policy vì phỏng đoán.

- [ ] **Step 1: Viết regression trước khi sửa** — test `PATCH admin reset rejects one character for a user without mutation` và `PATCH admin reset rejects one character for an admin without mutation`. Dùng actor và target khác uid; target admin tạo bằng `registerAdmin`/bootstrap. Snapshot `passwordHash,role,disabled,sessionVersion`; gửi `{password:"1"}`; assert status 400, `json.ok === false`, error lần lượt `Mật khẩu cần ít nhất 8 ký tự` / `Mật khẩu admin cần ít nhất 12 ký tự`; snapshot không đổi, token target vẫn GET me 200. Login với giá trị bị từ chối trả 401, mật khẩu hợp lệ cũ vẫn login được (kiểm token trước login để tránh nhầm bump session).
- [ ] **Step 2: Chạy baseline** — `npm test -- test/accounts-routes.test.ts test/accounts-admin.test.ts`. Expected: ghi kết quả thật; có thể PASS vì dòng 292 đã validate. PASS ở đây chỉ chứng minh chưa tái hiện trên code này. Không sửa test để cố tạo RED giả.
- [ ] **Step 3: Kiểm production có kiểm soát** — đây là thao tác trên hệ thống thật: maintainer thực hiện, hoặc agent chỉ thực hiện khi maintainer đồng ý rõ trong chat cho từng lần tạo tài khoản tạm, reset hay khoá. Không có bước nào tự động tạo tài khoản production trong CI/test. Làm đủ spec §4: ghi UTC/frontend/backend origins + health commits; tạo tài khoản **thường tạm**, password hợp lệ nhập riêng; admin reset một ký tự trên UI, quan sát endpoint/method/field/type/status/error/toast; nếu UI mới chặn, kiểm trực tiếp cùng PATCH trong API client riêng; thử login tài khoản tạm ở cửa sổ riêng, phục hồi password hợp lệ ngay nếu reset lọt, rồi khoá tài khoản tạm. Lặp trên hai build/backend, không bật fallback. Không thử admin live, không xuất HAR/token/body password; chỉ ghi metadata đã loại bí mật trong PR. Expected: xác nhận 400/không đổi hoặc ghi được case reset thật sự được chấp nhận.
- [ ] **Step 4: Khoanh vùng bằng chứng** — đối chiếu path khác, JSON top-level/nested/sai type, NFC/UTF-16/bytes, endpoint/base do `authRequest` chọn, nhầm target/toast, deploy tại thời điểm báo lỗi cũ. So sánh request production đã làm sạch với route harness. Kiểm fixture số/null/array password đều từ chối; missing password không reset hash (no-op patch hiện có không tự biến thành password). Kiểm thêm promote `role:"admin",password:"1"` trả 400 và không nâng role, và role admin thiếu password trả `ADMIN_NEEDS_PASSWORD`.
- [ ] **Step 5: Viết test RED cho nguyên nhân xác nhận** — tên `regression: <điều kiện tái hiện đã chứng minh>` tại tầng gây lỗi (route/service hoặc pure frontend helper nếu body/validation sai). Chạy đúng file bằng `npm test -- <test-path>`; expected FAIL do hành vi lỗi, không do setup/import. Nếu nguyên nhân là deploy cũ: giữ regression xanh hiện tại, ghi commit/triển khai sửa, không tạo patch validator dư thừa. Nếu vẫn chưa tái hiện: giữ mục điều tra/fix chưa hoàn thành và báo maintainer; không claim fix hoặc tự cản các task owner/UX độc lập.
- [ ] **Step 6: Patch tối thiểu rồi chạy lại** — giữ signature `adminUpdate(admin,id,patch)`, `validatePassword(pw: string, role: "user" | "admin" = "user"): string | null`, `authRequest<T>(method,path,body?)` trừ khi bằng chứng bắt buộc; validate trước hash/write và không nới policy. Run `npm test -- test/accounts-routes.test.ts test/accounts-admin.test.ts test/bootstrap-admin.test.ts`; expected các regression PASS, legacy login và promote vẫn đúng. Nếu case frontend sở hữu fix, đưa test/patch cụ thể đó vào P2, P1 không hứa sửa code backend không có lỗi.

### Task 2: Owner helper, guard và flag nhất quán

**Files:**
- Create: `src/accounts/owner.ts`, `test/accounts-owner.test.ts`.
- Modify: `src/accounts/service.ts:10,104–110,143–146,157,229,277–301`, `src/server/authRoutes.ts:193`, `src/server/app.ts:4,49–51`.
- Test: `test/accounts-admin.test.ts`, `test/accounts-routes.test.ts`, `test/accounts-owner.test.ts`.

**Interfaces:**
- `isOwnerUsername(username: string, ownerUsername: string | undefined): boolean`.
- `ownerUpdateProblem(actorId: string, target: { id: string; username: string }, patch: { role?: Role; disabled?: boolean; password?: string }, ownerUsername: string | undefined): string | null`.
- `warnIfOwnerUnconfigured(env: NodeJS.ProcessEnv = process.env): void`; một warning mỗi process.
- Backend `AdminUser` thêm **required** `isOwner: boolean`; AccountService.adminUpdate signature giữ nguyên. GET/PATCH serialize flag bằng cùng helper; frontend sẽ coi optional.

- [ ] **Step 1: Viết test thuần RED** — `owner identity uses nameKey for case NFC and whitespace`: fixture tên giả, uppercase/NFD/multiple spaces cùng key → true; undefined/empty/whitespace env → false; khác tên → false. `other admin cannot change owner role lock or password`: ba message spec §3.2; patch trộn ưu tiên role rồi lock rồi password. `owner may reset own password and another admin may unlock owner`: helper trả null cho self, `disabled:false`, và target thường. `missing owner config warns once without leaking values`: spy console.warn, gọi hai lần → một dòng đúng literal; configured → không warning. Isolate module bằng `vi.resetModules()`/dynamic import giữa test, restore env/spies sau test.
- [ ] **Step 2: Chạy RED** — `npm test -- test/accounts-owner.test.ts`; expected fail vì chưa có module/export.
- [ ] **Step 3: Implement helper thuần** — dùng `nameKey` từ `src/server/store.ts:99`; implement helper và warning theo interfaces. Chạy `npm test -- test/accounts-owner.test.ts`; expected PASS. Chưa nối guard/serializer vào service/route ở bước này.
- [ ] **Step 4: Viết service/route regression RED rồi tích hợp** — `owner mixed patch leaves hash role disabled and session version unchanged`; `owner guard applies to lock-only and role-only patches`; `missing target is 404`; `owner flags match between GET list and PATCH`; `owner changes own password through PATCH me with old password`; `ordinary admin operations retain existing self protection`; `OWNER_USERNAME never grants role at registration or login`; `owner username is reserved for registration` (400 `RESERVED_NAME`, không tạo user); `a non-admin cannot rename to the owner username` (400 `RESERVED_NAME`, tên/key không đổi). Kiểm tên owner chưa tồn tại hoặc đã bị bỏ trống sau rename và biến thể hoa/thường/NFC/whitespace. Admin vẫn có thể rename sang tên owner còn trống; reservation `ADMIN_USERNAMES` giữ hành vi cũ. Case không tự cấp role khi login dùng tài khoản có sẵn, không đăng ký mới bằng tên owner đã giữ chỗ. Với owner false/unset vẫn giữ validation password, không bypass. Service tự reset owner theo policy; HTTP me tự đổi trả session mới và token cũ bị thu hồi. Run `npm test -- test/accounts-admin.test.ts test/accounts-routes.test.ts`; expected test guard/flag mới FAIL (các invariant cũ có thể đã PASS). Sau RED mới nối warning cạnh accounts warning trong `createGameServer()`, không từ mỗi request; adminUpdate load target cho mọi patch, giữ self/shape validation, 404 target không tồn tại, guard trước hash/write, không fetch target lần hai. Trả 403 đúng spec, mixed patch bị từ chối toàn bộ; thêm flag cả `adminUser()` và list serializer, không vào PublicUser. Mở rộng `reservedKeys()` bằng key của `OWNER_USERNAME` qua cơ chế chuẩn hoá hiện có, giữ nguyên xử lý `ADMIN_USERNAMES`; `register()` và nhánh non-admin của `updateMe()` tiếp tục dùng tập chung để trả `RESERVED_NAME`, không thêm cấm rename cho admin.
- [ ] **Step 5: Kiểm GREEN** — `npm test -- test/accounts-owner.test.ts test/accounts-admin.test.ts test/accounts-routes.test.ts test/bootstrap-admin.test.ts`. Expected PASS; forbidden patch không bump session/cache-write, GET/PATCH owner true; bootstrap vẫn dry-run/cấp theo uid, đã admin không đổi. Thử self rename trong service test: flag theo tên hiện tại đổi đúng, ghi giới hạn chứ không thêm cấm rename.

### Task 3: Chuẩn bị search/filter/sort API toàn danh sách cho P3

**Files:**
- Create: `src/accounts/adminUsersQuery.ts`, `test/admin-users-query.test.ts`.
- Modify: `src/accounts/store.ts:27,208–213`, `src/accounts/pg.ts:210–227`, `src/server/authRoutes.ts:188–194`.
- Test: `test/accounts-store.test.ts`, `test/accounts-routes.test.ts`.

**Interfaces:**
- `AdminUsersFilter = "all" | "admin" | "disabled" | "owner"`; `AdminUsersSort = "createdAt" | "lastLoginAt" | "games"`; `SortOrder = "asc" | "desc"`.
- `AdminUsersOptions = { filter: AdminUsersFilter; sort: AdminUsersSort; order: SortOrder; ownerKey: string | null }`.
- `parseAdminUsersOptions(params: URLSearchParams, ownerUsername: string | undefined): { ok: true; options: AdminUsersOptions } | { ok: false; error: string }`.
- `normalizeAdminSearch(q: string): string` (dùng nameKey); `matchesAdminUser(user: UserRow, q: string, options: AdminUsersOptions): boolean`; `compareAdminUsers(a: UserRow & { games: number }, b: UserRow & { games: number }, options: AdminUsersOptions): number` — thuần, không process.env.
- `AccountStore.listUsers(q: string, page: number, pageSize: number, options?: AdminUsersOptions): Promise<{ rows: (UserRow & { games: number })[]; total: number }>`; ba tham số cũ vẫn đúng default. GET response không đổi `{users,total,page,pageSize:50}` ngoài isOwner Task 2.

- [ ] **Step 1: Viết pure tests RED** — `defaults preserve newest first`; `rejects unknown filter sort or order` trả `Bộ lọc hoặc sắp xếp không hợp lệ`; `normalizes NFC case whitespace without removing accents`; `combines search and filter`; `owner filter is empty when unset`; `sorts null logins last in both directions`; `ties use id ascending`; `games zero participates in ordering`. Input test mọi enum/chiều, không mutate input array. Run `npm test -- test/admin-users-query.test.ts`; expected fail module chưa có.
- [ ] **Step 2: Implement module thuần** — signatures trên, default `all/createdAt/desc`; filter độc lập một lựa chọn, không enum SQL tự do. Dùng `nameKey(ownerUsername)` khi không rỗng; không để placeholder live mặc nhiên trở thành một tài khoản được cấp quyền.
- [ ] **Step 3: Viết store/route tests RED** — mở rộng describe.each RAM/pg-mem trong `accounts-store.test.ts`: `filters before pagination and reports matching total`, `sorts games across pages rather than within a page`, `sorts last login nulls last`, `matches NFC searches and literal wildcards`, `keeps default three argument listUsers compatible`. Seed >50 users bằng store trực tiếp (không qua registration rate limit), games trên user ngoài trang 1 mặc định phải lên đầu khi sort games desc; ties deterministic id. Route test `accepts admin list query enums and rejects injection-like sort with 400`; q + filter + page tổng khớp, required isOwner flag, unauth 401/user 403 vẫn đúng. Run `npm test -- test/accounts-store.test.ts test/accounts-routes.test.ts`; expected fail semantics mới chưa có.
- [ ] **Step 4: Implement hai store và route** — RAM tính games trước sort/slice; Postgres aggregate game_results trước LIMIT/OFFSET, count cùng predicates. Bind q/filter/owner key; ORDER BY từ allowlist, nulls last + id asc; escape LIKE `%`, `_`, backslash. Không fetch mọi user về JS. Giữ `page` clamp 1–10000 và q cap 50 tại route; truyền options từ parser; từ chối enum sai 400. Default không đổi cho `adminUser()` cũ và caller ba tham số.
- [ ] **Step 5: Kiểm GREEN và giới hạn adapter** — `npm test -- test/admin-users-query.test.ts test/accounts-store.test.ts test/accounts-routes.test.ts`. Expected PASS cả store. Nếu pg-mem không mô phỏng được LIKE escape/null ordering/aggregate SQL cần dùng, không bỏ regression: spy kiểm bound SQL + chạy case đó trên Postgres dev thật trước release, ghi rõ phần pg-mem không kiểm được; giữ test memory và phần pg-mem có hỗ trợ. Không sửa production SQL sai để chiều adapter. Expected Postgres thật trả cùng id/total, query không sort sau LIMIT.

### Task 4: Docs, env, checks và PR/deploy P1

**Files:** Modify be_game `README.md`, `docs/GUIDE.md`, `docs/SELF_HOSTING.md`, `docs/DEPLOYMENT.md`, `.env.example`, `compose.selfhost.yml`.

**Interfaces:** Tài liệu dùng API/owner helper Task 2/3, không thêm env frontend; bootstrap `tsx src/tools/bootstrap-admin.ts <user-id> --yes --password-stdin` dùng stdin, không password literal/CLI argument.

- [ ] **Step 1: Sửa docs theo code đã kiểm** — README env thêm OWNER_USERNAME; GUIDE API table thêm flag/query enum/403 và policy theo role cuối; SELF_HOSTING cấu hình + bootstrap dry-run/apply + đổi tên owner phải phối hợp env; DEPLOYMENT bảng hai backend và release checklist. ADMIN_USERNAMES giữ reservation, không mô tả auto-role; OWNER_USERNAME không cấp admin. Trong `compose.selfhost.yml`, thêm `OWNER_USERNAME: ${OWNER_USERNAME:-}` cạnh `ADMIN_USERNAMES` trong `environment` và thêm `OWNER_USERNAME` vào comment danh sách `.env` dòng 3. `.env.example` placeholder như spec, ghi unset không bảo vệ + warning. Không rewrite lịch sử; nếu docs có changelog thì chỉ thêm mục mới cho thay đổi này.
- [ ] **Step 2: Rà soát tĩnh** — `rg -n "ADMIN_USERNAMES|OWNER_USERNAME|bootstrap-admin|isOwner|filter|sort" README.md docs/GUIDE.md docs/SELF_HOSTING.md docs/DEPLOYMENT.md .env.example compose.selfhost.yml`. Expected mọi hướng dẫn hiện tại phân biệt reservation/bootstrap/protection, không có tên owner/password thật. Không TDD cho prose; kiểm đối chiếu contract là gate.
- [ ] **Step 3: Chạy checks cuối P1** — lần lượt `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`; expected exit 0 tất cả. Kiểm final diff chỉ scope đã duyệt; nếu formatter chưa opt-in file mới, theo rules `.prettierignore` backend, không format toàn repo. Review security/atomicity/query/auth, không sửa ngoài scope; commit/PR theo quy trình sau checks, PR vào `main`, không tự merge.
- [ ] **Step 4: Deploy checklist trong PR** — maintainer đặt OWNER_USERNAME của tài khoản đã xác minh trong Vercel project env và server `.env` trước/khi merge; xác minh compose có `OWNER_USERNAME: ${OWNER_USERNAME:-}` cạnh `ADMIN_USERNAMES` và tên biến trong comment `.env` dòng 3 (chỉ đặt `.env` chưa truyền env vào container); redeploy/restart, kiểm `/api/health` hai nơi đúng commit, GET flag đúng và forbidden PATCH trả 403 trên cả hai, me tự đổi vẫn được. Riêng `play-api.fudio101.com`, GET `/api/admin/users` có `isOwner: true` đúng tài khoản + forbidden PATCH bằng admin khác trả 403 là bằng chứng env đã tới container. Không bật fallback. Expected owner protection thật sự hoạt động; unset không crash nhưng có một warning/process và không bảo vệ, vì vậy chưa qua release smoke check.
- [ ] **Step 5: Báo trạng thái password trung thực** — dẫn bằng chứng Task 1: reproduced + RED/GREEN + root cause, hoặc chưa tái hiện/khác deploy. Không đóng issue password như fixed khi chỉ có test xanh/UX chặn. Đây là điều kiện nghiệm thu riêng, không làm giả để đánh dấu P1 hoàn tất toàn bộ.

## P2 — zonenop-game: owner, password và logout

### Task 5: Owner-action rules và live validation ResetPasswordDialog

**Files:**
- Create: `src/components/admin/userActions.ts`, `userActions.test.ts`, `resetPassword.ts`, `resetPassword.test.ts`, `ResetPasswordDialog.module.scss`.
- Modify: `src/components/admin/types.ts:23–31`, `src/components/admin/UsersTable.tsx` (`UserRow`, `ResetPasswordDialog`), `src/components/auth/fields.tsx` (`AuthField`: nối hint/error với input).
- Read/regression: `src/components/auth/password.ts`, `password.test.ts`, `fields.tsx`, `src/components/admin/format.test.ts`.

**Interfaces:**
- Frontend `AdminUser` thêm `isOwner?: boolean`.
- `getUserActionRules(user: AdminUser, selfId: string | null): { canChangeRole: boolean; canLock: boolean; canUnlock: boolean; canResetPassword: boolean }`.
- `resetPasswordState(password: string, targetRole: PasswordRole, promote: boolean): { role: PasswordRole; problem: string | null; ready: boolean }`.
- `UserPatch` và `(u: AdminUser, patch: UserPatch) => Promise<boolean>` giữ nguyên; promote body `{role:"admin",password}`.

- [ ] **Step 1: Viết tests RED** — userActions: `hides destructive actions for another owner`, `keeps self role and lock protection`, `allows owner self password reset`, `allows owner unlock`, `missing owner field behaves as legacy user`, `does not infer ownership from username`. resetPassword: `blocks empty and one character for both roles`, `user 7 rejected 8 accepted`, `admin and promote 11 rejected 12 accepted`, `72 accepted 73 rejected`, `counts NFC code points and emoji using shared policy`. Assert ready false + message đúng từ `passwordProblem`, role admin khi promote. Run `npm test -- src/components/admin/userActions.test.ts src/components/admin/resetPassword.test.ts`; expected fail chưa có exports.
- [ ] **Step 2: Implement modules thuần** — gọi passwordProblem hiện có, không viết validator duplicate; empty `problem` giữ message policy nhưng UI chỉ show hint cho field chưa nhập. Owner rules spec §3.3; `isOwner === true`, selfId null không tự nhận self. Run command Step 1; expected PASS.
- [ ] **Step 3: Nối rules vào UserRow** — badge `Chủ sở hữu`, mô tả bảo vệ; owner khác ẩn role/lock/password, unlock vẫn cho phép; busy vẫn disable. Giữ self không đổi role/lock. Không hard-code tên; PATCH 403 đi error toast hiện có. Reset dialog kiểm lại rule tại lúc mở/submit, target mới không dùng password cũ.
- [ ] **Step 4: Nối live validation** — bỏ tried-only UI, `ready = resetPasswordState(...).ready`, submit kiểm ready và busy kể cả Enter. `AuthField` hiện chưa có ARIA cho hint: thêm prop optional `error?: string`, gán id cho hint/error từ useId, input `aria-describedby` trỏ các id đang hiện và `aria-invalid={!!error || undefined}`; render error không role alert mỗi phím. Các caller cũ không truyền error vẫn giữ hành vi. Hint hiện ngay, truyền nonempty invalid `problem` vào error khi gõ. Field `type="password"`; class mới phần error từ `ResetPasswordDialog.module.scss` qua prop optional `errorClassName?: string` của AuthField, không style riêng mới trong globals; không đọc raw password vào log/toast. Target/close xoá password; lỗi server không đóng. Promote giữ description 12–72 và thu hồi phiên, button `Cấp quyền`/`Đặt mật khẩu`.
- [ ] **Step 5: Kiểm tự động và browser** — `npm test -- src/components/admin/userActions.test.ts src/components/admin/resetPassword.test.ts src/components/auth/password.test.ts src/components/admin/format.test.ts`; expected PASS. Browser với fixture old response thiếu isOwner: render được; new response badge/actions đúng. Nhập 1/7/8 user, 11/12 admin/promote, 73, NFD/emoji: hint hiện trong lúc nhập, invalid button disabled, Enter không PATCH. Server 403 giữ dialog/toast lỗi, đổi target xoá field. Expected không có success khi lỗi, không rò password.

### Task 6: Logout confirm trong AccountMenu, không tác động auto sign-out

**Files:** Create `src/components/auth/logoutConfirm.ts`, `logoutConfirm.test.ts`, `AccountMenu.module.scss`; Modify `src/components/auth/AccountMenu.tsx`. Giữ `session.ts`, `signOut.test.ts` và `signOutGameSession` hiện có.

**Interfaces:**
- `type LogoutConfirmState = { session: string } | null` (chỉ state runtime, không persist/log).
- `canConfirmLogout(pending: LogoutConfirmState, currentSession: string | null, busy: boolean): boolean` — pending còn cùng token và không busy.
- `AccountMenu({ onClose }: { onClose: () => void })` và `signOut(): Promise<void>` giữ luồng POST/clear/redirect hiện tại; gọi signOut chỉ trong confirm handler đã guard.

- [ ] **Step 1: Viết test RED** — `confirmation requires the same current session`, `cancelled confirmation cannot sign out`, `busy confirmation cannot run again`, `revoked or replaced session cannot confirm stale logout`; assert helper false cho null/busy/token khác, true cho đúng token. Run `npm test -- src/components/auth/logoutConfirm.test.ts`; expected unresolved module.
- [ ] **Step 2: Implement helper + UI** — click Đăng xuất chỉ lưu pending, chuyển **cùng GameDialog** sang title `Đăng xuất?`, description `Bạn có chắc muốn đăng xuất khỏi tài khoản này?`; hai nút `Huỷ` và `Đăng xuất` danger. Không lồng hai popup. Huỷ/dismiss trở về account, focus nút mở; initial focus Huỷ. Guard canConfirmLogout và busy trước gọi signOut; giữ xử lý offline clear local và toast hiện tại. Khi current null component biến mất; token đổi thì confirm cũ không chạy. Style phần mới SCSS, không convert ProfileSection/PasswordSection.
- [ ] **Step 3: Test GREEN/regression** — `npm test -- src/components/auth/logoutConfirm.test.ts src/components/auth/signOut.test.ts src/components/auth/password.test.ts`; expected PASS. Browser desktop/375 px: click mở chưa có POST; Huỷ/Esc/backdrop/swipe không POST/clear; confirm chỉ một POST dù double click; thành công clear + redirect; lỗi mạng vẫn logout local và có toast hiện tại. Thu hồi session qua HTTP401/socket vẫn tự thoát không popup; đổi session khi confirm mở không logout session mới. Tab/Shift-tab không thoát popup, không có hai focus trap, focus khôi phục đúng.

### Task 7: Sửa docs admin/fallback, checks và PR P2

**Files:** Modify `README.md:83,152,184,206`, `CLAUDE.md:9–13`, `.env.example:11–18`, `docs/GAMES_GUIDE.md` §10.1/10.5/10.6, `docs/CHANGELOG.md` (entry mới).

**Interfaces:** Mô tả bootstrap và OWNER_USERNAME backend của P1; fallback frontend giữ `NEXT_PUBLIC_TIENLEN_FALLBACK_URL=""`.

- [ ] **Step 1: Cập nhật docs** — bỏ chỉ dẫn ADMIN_USERNAMES tự cấp admin; chỉ dẫn xác minh uid, bootstrap dry-run và apply `--yes --password-stdin`, password stdin không literal. Phân biệt reservation, role và owner protection. Ví dụ local admin dùng Postgres dev cùng DB, không bootstrap vào process RAM khác. GAMES_GUIDE nêu live validation riêng ResetPasswordDialog, không nói mọi form đã được đổi. Ghi fallback được code hỗ trợ nhưng cả self-host/Vercel đang không cấu hình; ví dụ deploy để rỗng, không bỏ mô tả conditional failover. Không đặt OWNER_USERNAME/NEXT_PUBLIC_OWNER_USERNAME trong frontend env.
- [ ] **Step 2: Thêm CHANGELOG entry** — tiêu đề owner/password/logout, Date 2026-11-08/nhánh thực tế, phụ thuộc P1 backend, missing flag compatibility, kết quả điều tra password đúng bằng chứng; không rewrite entry cũ về password/CSP.
- [ ] **Step 3: Kiểm tĩnh** — `rg -n "ADMIN_USERNAMES|OWNER_USERNAME|bootstrap-admin|NEXT_PUBLIC_TIENLEN_FALLBACK_URL" CLAUDE.md README.md .env.example docs/GAMES_GUIDE.md`; expected không còn hướng dẫn hiện tại auto-admin, fallback mô tả currently unset, không tên owner/password thật. Tài liệu historical CHANGELOG giữ nguyên. Task prose không có test RED giả.
- [ ] **Step 4: Checks cuối P2** — `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; expected exit 0. Browser `/admin` desktop + 375 px và logout theo Task 5/6, ghi bằng chứng không secret; review final diff và PR vào `develop`, screenshots UI; không tự merge/release. P2 được đánh giá riêng dù API P3 chưa dùng.

## P3 — zonenop-game: quản trị dễ dùng trên điện thoại

### Task 8: Query controls, cards và xác nhận mutation

**Files:**
- Create: `src/components/admin/usersQuery.ts`, `usersQuery.test.ts`, `UserActions.tsx`, `UserActions.module.scss`, `UsersTable.module.scss`, `UserActionDialog.tsx`.
- Modify: `src/components/admin/UsersTable.tsx` (`UsersTable`, `UserRow`, `UsersSection`, `ResetPasswordDialog` gọi từ host).
- Reuse: Task 5 `userActions.ts`, `resetPassword.ts`; game-ui `GameDialog`, `GameButton`, `GameBadge`; `formatDateTime`, `formatNumber`, `pageCount`.

**Interfaces:**
- `UsersQuery = { q: string; page: number; filter: "all" | "admin" | "disabled" | "owner"; sort: "createdAt" | "lastLoginAt" | "games"; order: "asc" | "desc" }`.
- `DEFAULT_USERS_QUERY: UsersQuery` = q rỗng, page 1, all, createdAt, desc.
- `usersQueryPath(query: UsersQuery): string`; `changeUsersQuery(current: UsersQuery, change: Partial<Omit<UsersQuery, "page">>): UsersQuery` (đổi điều kiện → page 1; không đổi giá trị thì giữ page).
- `validUsersPage(total: number, pageSize: number, page: number): number` — clamp tới `[1,pageCount(total,pageSize)]`.
- `UserActions({ user, selfId, busy, onAction }: { user: AdminUser; selfId: string | null; busy: boolean; onAction: (user: AdminUser, action: "lock" | "unlock" | "demote" | "promote" | "resetPassword") => void })`.
- `UserActionDialog({ target, busy, onClose, onConfirm }: { target: { user: AdminUser; action: "lock" | "unlock" | "demote" } | null; busy: boolean; onClose: () => void; onConfirm: () => Promise<void> })`.

- [ ] **Step 1: Tests RED cho query** — `builds an encoded query with all defaults`, `resets page when any condition changes`, `keeps page for an unchanged condition`, `clamps an emptied final page`, `preserves Vietnamese search text without unsafe URL interpolation`. Assert q có `&` được percent encode, default path chứa `filter=all&sort=createdAt&order=desc` (dùng URLSearchParams để assert không dựa thứ tự vô ích); validUsersPage(0,50,3)=1, (51,50,3)=2. Run `npm test -- src/components/admin/usersQuery.test.ts`; expected fail module mới. Không viết client filter/sort trên 50 dòng; logic predicate/comparator đã test ở P1 Task 3.
- [ ] **Step 2: Implement helper và request state** — giữ debounce q 300 ms; control filter/sort/order theo enum và tiếng Việt spec §6.1; page reset dùng helper, URLSearchParams trong URL builder. Request key đủ q/page/filter/sort/order/attempt + session token; bỏ qua response obsolete bằng cleanup/current key như pattern sẵn có. Không render dữ liệu token khác. PATCH thành công refetch thay vì chỉ replace row; clamp/refetch khi page cuối trống, giữ query/filter. Verify `npm test -- src/components/admin/usersQuery.test.ts`; expected PASS.
- [ ] **Step 3: Tách actions và cards** — dùng UserActions cho row/card, cùng getUserActionRules; desktop ≥768 px table, mobile <768 px list `<ul>/<li>` hoặc article; tên wrap, date/null login format hiện có, badge self/owner/role/disabled và số ván đầy đủ. Layout ẩn `display:none`, không duplicate focusable actions; một dialog host chung ngoài hai layout. SCSS Module mới, button ≥44 px có tên; empty `Không có tài khoản nào phù hợp.` và count matching total từ API.
- [ ] **Step 4: Dialog confirm** — lock/unlock/demote thay `confirm=`/PATCH ngay bằng pending target. Title/nút/messages theo spec §6.3, có username được render text an toàn. `Huỷ` mặc định focus, onOpenChange chỉ cancel nếu !busy; xác nhận re-read target + rules trước onPatch. Promote/reset dùng ResetPasswordDialog Task 5, promote submit là confirm, không thêm popup chồng. Error toast giữ dialog, success đóng rồi refetch. Nếu target biến mất/mất quyền, đóng pending và không patch; server 403/401 vẫn là nguồn quyết định.
- [ ] **Step 5: Kiểm pure regressions** — `npm test -- src/components/admin/usersQuery.test.ts src/components/admin/userActions.test.ts src/components/admin/resetPassword.test.ts src/components/admin/format.test.ts`; expected PASS.
- [ ] **Step 6: Browser với API P1** — >50 fixture user local, chọn admin/disabled/owner + q NFD/hoa thường + mỗi sort/chiều, page 2; Network params đúng, total/row order giống server, null login cuối. Đổi filter nhanh khi response chậm không overwrite mới. Khoá/unlock/demote cancel không PATCH, confirm đúng body một lần, lỗi 403 không success; mutation làm row rời filter thì list/count cập nhật và page cuối co lại. Thử owner khác/self trên table/card; tên 20 ký tự, empty, 500/offline/retry. 375 px không cuộn ngang bảng; Tab chạm từng nút card, layout ẩn không vào tab order; dialog trap/focus restore, Esc/swipe, busy. Expected toàn bộ đúng; ghi screenshots/Network đã loại bí mật trong PR. Rollback backend sau P3 phải rollback P3 hoặc tắt control nâng cao, không tin server cũ hiểu params.

### Task 9: Summary đầu trang, docs và checks cuối P3

**Files:** Modify `src/components/admin/AdminDashboard.tsx`, `StatCards.tsx`, `docs/GAMES_GUIDE.md` §10.5, `docs/CHANGELOG.md`; Create `src/components/admin/AdminDashboard.module.scss`, `StatCards.module.scss`.

**Interfaces:** Giữ `StatCards({ totals, daily, days }: { totals: AdminStats["totals"]; daily: DailyRow[]; days: number })`. `StatsView` nhận các prop thống kê hiện có; bỏ summary/period controls đã chuyển ra dashboard để không trùng. `AdminStats` không thêm field; không tạo endpoint/metric mới.

- [ ] **Step 1: Lập browser assertions trước sửa UI** — trên bản cũ summary không hiện khi chọn Người dùng (case chưa đạt yêu cầu mới). Kỳ vọng sau sửa: cùng một bộ chọn 7/30/90 và bảy thẻ sau header trước tabs ở cả hai tab; đổi kỳ cập nhật đúng totals/daily; tổng users ghi mọi thời gian. Stats lỗi có retry riêng, users vẫn dùng được; 401 redirect/403 Forbidden không lộ stats. Đây là acceptance browser, không giả component test trong vitest node.
- [ ] **Step 2: Di chuyển phần summary** — giữ fetch/state stats một chỗ AdminDashboard, đưa period/loading/error/retry + StatCards trước GameTabs; StatsView giữ chart/rankings và trạng thái cần thiết, không render thẻ đôi. Giữ dynamic import Recharts, session-key isolation. Dùng SCSS Modules cho layout mới và phần StatCards sửa; không convert Charts/RankTables/page root. Nhãn bảy thẻ và key totals giữ đúng spec §6.4; không lấy admin/locked count từ trang users.
- [ ] **Step 3: Docs/changelog** — cập nhật GAMES_GUIDE về filter/sort server, pageSize 50, table/cards, popup confirmation và summary; thêm entry P3 mới Date/branch/checks/rollout; không sửa entries P2/lịch sử để ghi kết quả chưa chạy.
- [ ] **Step 4: Browser desktop/375 px cuối P3** — thực hiện assertions Step 1 + Task 8, chọn kỳ 7/30/90, all zero, loading, stats lỗi/retry và users lỗi độc lập; xác minh số hiển thị lấy từ đúng totals và không trùng thẻ. Kiểm lại logout confirm Task 6 (dù không sửa code đó), focus trap/restore, auto revoke; không overflow toàn trang, touch target/labels rõ. Expected PASS và ảnh desktop/375 px trong PR không chứa credential.
- [ ] **Step 5: Checks cuối P3** — `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; expected tất cả exit 0. Rà diff, review owner/validation/query/auth/a11y không scope creep; PR riêng vào `develop` từ nhánh mới sau P2. Trạng thái là chờ maintainer review/merge, không tự đưa `develop` lên `main`.

## Risks và cách kiểm soát

- OWNER_USERNAME thiếu/sai/khác hai backend: warning không ngăn chạy; smoke GET flag + PATCH 403 cả hai là gate. Owner tự rename làm protection đi theo tên/env; docs phải nói rõ và quy trình đổi env đồng bộ, không âm thầm thêm policy rename mới.
- Guard chỉ UI hoặc quên serializer GET/PATCH: Task 2 test route/service và shared helper bắt lỗi; rollout P2 missing flag chỉ là compatibility, không chứng minh bảo vệ.
- Root cause password chưa biết: Task 1 test baseline có thể PASS; chỉ đánh dấu fixed với chứng cứ fail/pass hoặc xác minh deploy đã giải thích triệu chứng. Không bỏ điều tra vì frontend chặn được.
- SQL games aggregate tốn hơn: đúng global order trước LIMIT là bắt buộc, review query plan trên Postgres dev khi cần; không thay bằng fetch-all hoặc sort trang. pg-mem không thay thế hoàn toàn Postgres, ghi giới hạn và test thật case không mô phỏng được.
- Confirm khi target/session đổi, double click, response chậm: Task 5/6/8 guards và browser cases; không thay auto-signout, không stale success.
- Mobile table/cards và summary hoist dễ trùng DOM focus/request: một dialog host, layout ẩn khỏi accessibility, một stats source, kiểm 375 px/keyboard và auth transitions.

## Câu hỏi mở

Không có quyết định sản phẩm chưa chốt. Kết quả điều tra root cause mật khẩu là đầu ra bắt buộc Task 1; nếu chưa xác định được, báo rõ phần việc còn mở và không tuyên bố đã hoàn tất fix. Lựa chọn unset OWNER_USERNAME đã được quyết định trong spec, không yêu cầu mở lại để tiếp tục viết plan.

## Bàn giao

Plan này chưa được thực thi; không có kết quả lint/test/build/production check trong lượt viết tài liệu. Sau khi được duyệt, mỗi phase kết thúc bằng checks, review, PR và deploy notes riêng như trên; báo các bước thực tế đã chạy và phần còn thiếu, không thay bằng expected result.
