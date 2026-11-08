# Project Changelog

Purpose: restore project context quickly after `/clear`. Only decisions, problems, and state that
aren't already derivable from git log / current code / `CLAUDE.md`+`AGENTS.md`. Never contains
secrets — see `.env.example` for the shape of required env vars.

The portfolio-with-CMS history (Phases 0–17: Prisma/Neon, Auth.js admin, Cloudinary uploads, Resend
contact form, CV/blog/projects pages) was removed with that code; it is still in git history before
the `refactor/repurpose-as-games` branch (`git log -- docs/CHANGELOG.md`).

---

## /admin: filters and sorting, cards on phones, confirmations, overview on top

- **Date:** 2026-11-08 (branch `feature/admin-ui-enhancements`, stacked on `feature/admin-owner-and-ui`; Phase 3 of `docs/superpowers/plans/2026-11-08-admin-owner-and-ui.md`; needs be_game #49 on both backends, live since 2026-11-08).
- Users tab: filter (all / admins / locked / owner), sort (created, last login, games) and order, done by be_game across every account before paging; the client only builds the URL (`admin/usersQuery.ts`, tested). After a successful change the list is fetched again (membership and order may change), and an emptied last page steps back. A slower old response never overwrites a newer one.
- Below 768 px the users are cards instead of a sideways-scrolling table; both layouts share `UserActionButtons` and one dialog host.
- Lock, unlock and demote now ask in a dialog (`UserActionDialog`) instead of the two-tap `confirm` button / immediate unlock; promote still uses the password dialog as its confirmation.
- The period picker and the seven totals moved above the tabs (visible on both); charts and rankings stay under "Thống kê".
- If a backend is ever rolled back below be_game #49, roll this back too: an older backend ignores `filter`/`sort`/`order` silently.
- UI by Codex, reviewed by Claude (the component file was renamed `UserActionButtons.tsx`: `UserActions.tsx` collided with `userActions.ts` on case-insensitive file systems). Checked against a local be_game with 59 accounts: params and page reset, page 2/2, owner/admin/locked filters, unlock dialog (Esc sends nothing, a double click sends one PATCH, the list refetches to the empty state), cards only at 375 px without horizontal overflow, 44 px buttons. The browser pane was hidden during part of the check, so dialog clicks were also driven by `element.click()`; a visual pass on a real screen is still worth doing.

## Owner badge, live password check, sign-out confirmation

- **Date:** 2026-11-08 (branch `feature/admin-owner-and-ui`, from `origin/develop`; Phase 2 of `docs/superpowers/plans/2026-11-08-admin-owner-and-ui.md`; needs be_game #49, live since 2026-11-08).
- `/admin` user rows read be_game's `isOwner` (the account named by its `OWNER_USERNAME`): a "Chủ sở hữu" badge, and for other admins the role, lock and password buttons are hidden (unlock stays) with "Tài khoản chủ sở hữu được bảo vệ" (`getUserActionRules`, `admin/userActions.ts`). Cosmetic: be_game refuses those changes with 403. An older backend without `isOwner` is treated as "not the owner"; the owner is never guessed from the name. Your own row no longer shows the disabled role/lock buttons (they are hidden).
- The reset / promote password dialog checks while typing (`resetPasswordState`, `admin/resetPassword.ts`): the length hint shows from the start, the error as soon as the value is invalid, and the submit button and Enter stay blocked until it fits (8–72, 12–72 for admins and promotions). `AuthField` gained optional `error` with `aria-describedby` / `aria-invalid` and is now a password field in this dialog. This replaces the 2026-11-06 "message only after a submit attempt" behaviour.
- "Đăng xuất" in the account menu now switches the same dialog to "Đăng xuất?" with Huỷ / Đăng xuất (`canConfirmLogout`, `auth/logoutConfirm.ts`); cancel, Esc or dismiss returns to the account view, and a confirmation opened for a session that was meanwhile replaced does nothing. Automatic sign-outs (revoked or expired session) are unchanged.
- Docs: GAMES_GUIDE §10.5/10.6, README, `.env.example` and `CLAUDE.md` no longer say `ADMIN_USERNAMES` grants admin (be_game grants by user id with `bootstrap-admin.ts`), and say that `NEXT_PUBLIC_TIENLEN_FALLBACK_URL` is set in neither live build.
- The "admin set a one-character password" report: be_game allowed 1–72 characters from 2026-10-17 until #28 (2026-11-06); current code refuses it (regression tests in be_game #49). Not re-tested on production yet.
- UI by Codex, reviewed by Claude; checked in the browser against a local be_game (memory accounts, an owner admin, a second admin, a user, a locked user): badge and hidden actions, live error and blocked Enter at 1 character, one PATCH at 8, the sign-out confirmation (focus on Huỷ, Esc back with focus restored, one POST then `/dang-nhap`) at desktop and 375 px.

## Security headers, CSP in Report-Only

- **Date:** 2026-11-06 (branch `feat/security-headers-csp`, from `origin/develop`; T09 of the be_game/zonenop-game hardening plan).
- Every route now sends `Content-Security-Policy-Report-Only`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` (`next.config.ts` → `headers()`, built by `src/lib/security-headers.ts`, tested). Before, the Vercel copy sent none of them; the self-hosted one got nosniff, Referrer-Policy and X-Frame-Options from its proxy.
- Owner decisions: `script-src` keeps `'unsafe-inline'` (Next and next-themes inline scripts; a per-request nonce would make every page dynamic on the phone server), and violations are only seen in the browser (no report endpoint). The CSP still limits `connect-src` to this origin and the two backends (with ws/wss), and sets `object-src 'none'`, `base-uri`, `form-action`, `frame-ancestors 'none'`. Enforcing is a later, separate PR.
- Checked in the browser on a production build against a local be_game: home, sign-in/register, lobby, creating a table over WebSocket and the theme script produce no violation; a deliberate fetch to another origin is reported (`connect-src`, disposition "report").

## Password rules: 8–72, admin 12–72

- **Date:** 2026-11-06 (branch `fix/password-policy-8-12`, from `origin/develop`; T10 part 1 of the be_game/zonenop-game hardening plan, decision D1-b).
- `src/components/auth/password.ts` mirrors be_game `validatePassword` (be_game PR #28): new passwords need 8–72 characters, 12–72 for an admin account, counted as NFC code points (the old client counted without NFC and allowed 1). `passwordProblem(p, role)` and `passwordHint(role)` take the role; register uses the user rule, "Đổi mật khẩu" the signed-in role, the admin "Đặt lại mật khẩu" dialog the target account's role. Login checks no length, so short old passwords still sign in.
- The submit buttons of register / change password now wait only for non-empty fields, so a too-short password gets a message on submit instead of a silently disabled button; the admin reset dialog works the same way: its button waits for a non-empty field and the length rule appears after a submit attempt (not on every keystroke, where a `role="alert"` would be read out while typing); it used to show only "too long".
- Granting admin in `/admin` now opens the password dialog in a "promote" mode and sends `{ role: "admin", password }` (admin minimum, 12): be_game #28 refuses a promotion without a new password (`ADMIN_NEEDS_PASSWORD`), since the stored hash cannot tell whether the old one is long enough. Removing admin still asks for confirmation and sends `{ role: "user" }`. With an older backend the password is simply set along with the role.
- Order: be_game #28 has been live since 2026-11-06, so production already refuses short new passwords and a promotion without a password; until this reaches `main`, the "Cấp quyền" button of `/admin` gets that 400. The client is never looser than the server, so releasing it is safe at any time.

## Session lifecycle tests, and two storage bugs

- **Date:** 2026-11-06 (branch `test/session-lifecycle`, from `origin/develop`; T10 part 2 of the be_game/zonenop-game hardening plan, decision D3-a: keep the token in localStorage, sent as Bearer).
- `src/components/auth/sessionLifecycle.test.ts` (21 tests, each on a freshly loaded `session.ts`): blocked storage, reload, several tabs (storage events, `clear()` in another tab), a late 401 / `refreshMe` / profile answer after signing in again or out (the 401 test checks the request really carried the old token), password change, a 401 (expiry after 30 days, revocation) signs out with a notice, 403/429/500/503 and network failures keep the session.
- Two bugs found and fixed in `session.ts`: when only `setItem` threw (quota, some private modes) the session read back as the previous value, so a fresh sign-in was lost at once; when `removeItem` threw, signing out read the old token back. Now the first failing write or removal makes the page use only its in-memory copy until it closes (`storageFailed`); a failed write also tries to remove the previous value, so a reload or another tab does not bring back the earlier account. A failed read alone does not switch modes (the next read may work). Limits: with removal failing, a reload still finds the old token in storage (nothing in the page can clear it); once a page has switched to memory it no longer follows sign-in/sign-out in other tabs, and the other tabs do not see its changes (the server still answers a revoked token with a 401).
- The 30-day expiry itself is checked by be_game (`readSession`); its boundary test is in be_game.

## Deploy workflow: no `${{ }}` in shell scripts

- **Date:** 2026-11-06 (branch `fix/deploy-shell-env`, from `origin/develop`; T08 of the be_game/zonenop-game hardening plan in be_game `docs/superpowers/plans/2026-11-05-be-game-and-zonenop-game-hardening.md`).
- `.github/workflows/deploy.yml` pasted `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `WEB_DOMAIN` into `run:` scripts as `${{ }}`: Actions substitutes the text before bash runs, so a quote, `$(...)` or backtick in the value became shell syntax. They now come in through step `env:` and are read as `"$VAR"` (same secret names, file paths and modes).
- New step "Validate configuration" (`scripts/check-deploy-env.mjs`) runs right after checkout: `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_PORT` go into `~/.ssh/config` through a heredoc (a newline could add e.g. a `ProxyCommand`), `DEPLOY_PATH` and `SHA` into the remote command in single quotes, `WEB_DOMAIN` into a URL; each must match a strict pattern. Errors name the variable, not the value.
- Tests (`scripts/check-deploy-env.test.mjs`; `vitest.config.mts` now also includes `scripts/**/*.test.mjs`): the validator; no `run:` block in any workflow contains `${{`; and the real "Prepare SSH" script from `deploy.yml` run in bash with a hostile multi-line key (quotes, `$(touch …)`, backticks) keeps it byte for byte with mode 600 and runs nothing, while the old pasted form does run the payload. The bash tests need Linux file modes, so they are skipped on Windows and run in CI.
- Not run against the real server: the first deploy after this reaches `main` is the real check (a bad existing secret would now fail at "Validate configuration" instead of later).

## Cờ Tỷ Phú table effects

- **Date:** 2026-10-29 (branch `claude/dautri-millionaire-flags-ui-664700`, cut from `origin/develop`). No game protocol change; the per-account prefs (below) need be_game's new `/api/auth/prefs` endpoint (older backends answer 404 and the prefs stay on the device).
- Money flying (`typhu/fx/MoneyFx.tsx`): the server sends no "who paid whom" event, so `fx/moneyFlows.ts` infers it from each player's cash between two state updates. Payers are matched with receivers in turn (rent: tenant → owner); what is left over goes to / comes from the bank (the board centre, `data-bank`). Totals per player are exact, only the pairing is a guess when several payments land in one update. It skips the first state it sees and resets when a new game starts (the game `status` going ended → playing: be_game replaces the game in place, so the last game's cash is never compared with the next one's), and players who just went bankrupt.
- Positions come from the DOM: `data-token` (board token) falling back to `data-seat` (panel avatar).
- Turn: `fx/TurnBanner.tsx` (full-width band, loud for me, quiet for others, only on a real turn change) and `fx/turnGlow.module.scss` (pulsing halo on the board token and the panel avatar, still under `prefers-reduced-motion`).
- Buying land: `OwnerFlag` in `board/Cell.tsx` plants a flag in the owner's colour for about 1.8 s when a square gets its first owner (purchase or auction win; not on a trade or a bankruptcy hand-over); not replayed for owners already there on load.
- Review round 1: money ± waits until every token has stopped walking (`arrived` from `useWalkingTokens`, then a 250 ms beat); walking is ~2x faster (step 40–110 ms); the turn banner flashes in and fades (1.1 s mine / 0.8 s others); the turn glow is softer.
- Flag and house drop straight down from above and touch down, no wobble (`fx/DropFx.tsx`). They are drawn in a portal on `document.body`, because a square is `overflow-hidden` and clipped the flag on the side squares. The in-square burst and the new building wait for the touch-down (`LAND_MS`).
- `Celebration` got an `intensity` prop (default 1, Cờ Tỷ Phú passes 2.2: more particles, more and faster bursts spread wider, a second side volley) and a `confetti` prop (default true; false = banner only). Everything that differs only applies when `intensity > 1` or `confetti={false}`, so other games are unchanged.
- Leaving: "← Sảnh" asks for confirmation for a seated, non-bankrupt player in a running game, and `beforeunload` warns on closing / refreshing (`preventDefault` + `returnValue = ""`). Browser Back and the site nav are not covered.
- Review round 2: the effect layers (`MoneyFx` z-46, `DropFx` z-45, `TurnBanner` z-44) sit below dialogs (z-50) and use colocated SCSS Modules; all of them render nothing under `prefers-reduced-motion` (`useReducedMotion`); MoneyFx's clean-up timers are cleared on unmount; dead code in `Cell.tsx` removed.
- The bankruptcy that ends the game shows "PHÁ SẢN!" to everybody but the winner. The winner gets `fx/VictoryFx.tsx` on top of `Celebration` (playing → ended only, never on reconnect): two trumpets blowing in the lower corners, two flags in the winner's token colour rising on poles at the sides and waving, and fireworks (rockets climbing, then bursting; canvas-confetti, lazily imported). ~4.6 s, z-41.
- A planted flag makes its square shake for ~320 ms as it touches down (`board/Cell.module.scss`, `.shake`, motion-safe).
- Effect switches: `typhu:prefs` gains `fx: { money, turn, flag, end }` (default all on; older saves without `fx` = all on, only an explicit `false` turns one off; tests in `prefs.test.ts`). The ⚙ button is now on every screen with a "Hiệu ứng" section of four switches (Tiền bay · Báo lượt · Cắm cờ & rung ô · Phá sản & chiến thắng); Giao diện / Vị trí nút still show on phones held upright only. `end` off = no "PHÁ SẢN!", no VictoryFx and no confetti (the result banner stays).
- Prefs per account: `useTyPhuPrefs` also keeps `typhu:prefs` on the signed-in account via be_game `GET`/`PATCH /api/auth/prefs` (`{ game: "typhu", prefs }`, ≤ 2000 chars). Local storage stays the first read (no flash); the account's copy is fetched once on mount and applied (validated by `prefsFrom`/`accountPrefs`) unless the viewer already changed something; an account without one gets this device's prefs uploaded once. Changes save after 500 ms, one request at a time; every failure (offline, 401, 404 from an older backend) is silent and keeps the local value. Needs the matching be_game release to take effect; until then it behaves as before. The ⚙ dialog now says the options are saved with the account.
- Turn banner restyle: the band takes the turn player's token colour darkened with black (`color-mix(in oklab, <colour> 75%, black)` via the `--turn-color` custom property), black borders on its top and bottom edges, text white or dark by contrast (`inkOn` in `typhu/tokens.ts`, tested), and a slower fade-in (about 0.26 s, was 0.13 s; on screen 1.4 s mine / 1.0 s others).

---

## Nối Chữ, the eighth game

- **Date:** 2026-10-29 (branch `feature/noi-chu`; backend be_game `feature/noi-chu` ([be_game #25](https://github.com/ThachHuynhIT/be_game/pull/25)), **deploy it first**).
- New game at `/noi-chu`, 2–8 players: type a two-syllable word whose first syllable is the last syllable of the previous word (tone marks must match, no repeats); running out of time puts you out, the last one standing wins. Rules, settings and commands: `be_game/docs/games/noichu.md`; UI notes: `docs/GAMES_GUIDE.md` §4.8.
- First table written with the SCSS Module rule (`NoiChuTable.module.scss`) and the `game-ui` kit instead of long Tailwind class strings.
- Dictionary check lives on the server (be_game ships a 48,425-word list from Viet74K, GPL-2.0, kept as a separate data file there, plus 606 extra words written for this project such as `con mèo`, `trà sữa`, `đà nẵng`; the licence decision and caveats are in be_game's `src/noichu/dict/README.md`). Known limit: free compound phrases (`đôi mắt`, `giờ học`, `tin nhắn`…) are still often missing (about 81% of a fresh 150-word probe was accepted). So the room setting is two levels, with no way to turn the check off: **strict** (dictionary, the default) and **loose** (dictionary, or both syllables are real Vietnamese; accepts `đôi mắt`, refuses `qqqqq`, but also nonsense like `bàn bàn`). `dictionary` is a string now; the server still reads the old boolean (`false`, the old "off", means loose).
- Verified against a real be_game with two Playwright browsers (register, create room, settings, refused words, 4 valid words, timeout, result, new game, phone width, hub card, lobby). The Playwright script is not in the repo.

---

## Cờ Tỷ Phú: luật Đấu giá

- **Date:** 2026-10-30 (branch `feature/typhu-auction`; backend [be_game #26](https://github.com/ThachHuynhIT/be_game/pull/26) (đã merge) — **deploy be_game (primary và backup) TRƯỚC**).
- Luật bàn mới **"Đấu giá"**, mặc định tắt: ô chưa có chủ mà người dừng bỏ qua / hết giờ thì đem ra đấu giá. Khởi điểm **80%** giá đất, ai còn trong ván cũng trả giá được, mỗi lần ≥ giá hiện tại + 10tr và bằng tiền mặt, 15 giây (+5 giây mỗi lần trả, tối đa còn 15 giây); hết giờ người cao nhất trả ngân hàng và nhận đất. Người vừa bỏ qua lượt mua (`floorFor`) chỉ được trả từ **giá đất** (`floor`) trở lên. Nút **"Bỏ cuộc"** (`{type:"fold"}`, phím `Q`): rời phiên, không trả lại được, người dẫn đầu không bỏ cuộc được; mọi người khác bỏ cuộc thì người dẫn đầu thắng ngay, tất cả bỏ cuộc mà chưa ai trả thì đất không bán. Lượt tạm dừng (người tới lượt vẫn xây / bán nhà được); không đổi đất / vay / thế chấp trong phiên. Toast khi phiên đấu giá mở (một lần mỗi phiên).
- UI: `AuctionPanel` giữa bàn (nút +10…+500tr, "Khởi điểm" / "Giá đất" cho người vừa bỏ qua, "Bỏ cuộc"; phím `Space` / `1`–`6` / `Q`; danh sách người đã bỏ cuộc; gọn hơn khi bảng hẹp ≤ 18rem nhờ container query; màu qua alias `vars.$color-*` mới trong `_variables.scss`), công tắc "Đấu giá" ở tab 🏠 Luật nhà, mô tả trong `RulesDialog`. `protocol.ts` đồng bộ tay với be_game (`TPSettings.auction?`, `Phase "auction"`, `TPGameView.auction?` gồm cả `folded?` / `floor?` / `floorFor?`, `{type:"bid"}`, `{type:"fold"}`; mọi field mới tuỳ chọn — server không gửi `folded` thì không hiện nút Bỏ cuộc). `localizeTPView` (`typhu/clock.ts`) tách khỏi `TyPhuTable` để test, dịch cả `auction.deadline`.
- Tương thích: server cũ không gửi `auction` → không có bảng đấu giá, công tắc bị khoá và ghi "Máy chủ chưa hỗ trợ" (không bật lạc quan). Client cũ không có UI trả giá: đừng bật luật ở bàn còn tab cũ.
- Hiệu ứng xu bay khi trả tiền (`fx/MoneyFx`) **không** nằm trong PR này: nó thuộc PR #91 (chưa merge), tự chạy theo thay đổi tiền khi PR đó vào. Rebase lên `develop` mới nhất nếu #91 merge trước (xung đột có thể ở `TyPhuTable.tsx`).

---

## Baloo 2 self-hosted

- **Date:** 2026-10-28 (branch `claude/check-build-error-8dnat2`).
- Why: a Vercel preview build (`0cb37f0`, docs-only commit) failed with `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` on Baloo 2's generated `@font-face`; a no-cache redeploy of the same commit passed, so it was a flaky `next/font/google` fetch/cache, not the code.
- `gameFont.ts` now uses `next/font/local` with `components/games/fonts/Baloo2-latin-vietnamese.woff2`: the OFL variable font (wght 400–800) subset to Latin + Vietnamese with `pyftsubset` (56 KB; licence beside it). Same `--font-game` variable, so no call sites changed.
- It was not a one-off: the next Vercel build of this branch (cache restored) failed the same way on Bricolage Grotesque in `app/layout.tsx`, so the failure follows whichever `next/font/google` font Turbopack resolves first. Bricolage Grotesque, Geist and Geist Mono are now self-hosted too (`app/fonts/`, same CSS variables, same Latin + Vietnamese subset; Bricolage has `wdth` pinned to 100, keeping `opsz` + `wght`, 108 KB). No `next/font/google` is left in the repo. Geist/Bricolage now also cover Vietnamese diacritics (they were `latin` only before).
- To re-subset or update a font: take the OFL variable TTF from `google/fonts` (`ofl/<family>/`), `pyftsubset --flavor=woff2` with the Latin + Vietnamese ranges (see the Baloo 2 file's glyph set), keep the licence next to it.

---

## Cờ Tỷ Phú auto-play no longer builds

- **Date:** 2026-10-26 (branch `fix/typhu-auto-no-build`; backend be_game `fix/typhu-auto-no-build`, deploy it for the change to take effect).
- Auto-play (`Ctrl+Shift+Y`) still rolls, buys squares under 300tr keeping 150tr, and handles jail/debt, but it no longer builds houses at the end of the turn; building stays a manual choice. be_game dropped `autoBuild`. The client only had comments/docs to update.

---

## Account seats and resume banner

- **Date:** 2026-10-23 (branch `feature/account-seats`; depends on [be_game #23](https://github.com/ThachHuynhIT/be_game/pull/23), deploy backend first).
- Seats follow the account across devices. Signing in revokes older sessions; a replaced/revoked table stops reconnecting without leaving its seat and shows the reason on sign-in.
- Exception: when this browser already holds a newer session (a password change at the table issues one and revokes the token the socket joined with), `signedOut` re-joins with it instead of stopping (`hasNewerSession`).
- Auth HTTP 401 records the revoked reason; returning to a visible tab revalidates the session (30-second throttle).
- Hub and lobbies show “Ván đang dở” with a “Vào lại” link from `GET /api/auth/rooms`. Refresh on entry/session change, and on tab visibility at most every 30 seconds (each check scans every game's recent rooms server-side); no polling; unknown game ids are ignored.
- Known debt: the banner and sign-in notice SCSS use hard-coded amber hex colours (like the game tables) instead of `_variables.scss` tokens.
- Cross-instance revocation can take about 90 seconds. Both backends must share the account database for revocation to propagate.

---

## Cờ Cá Ngựa auto-play

- **Date:** 2026-10-19 (branch `feature/cangua-auto-play`; backend be_game `feature/cangua-auto-play`)

**Changes**
- Hidden `Ctrl+Shift+Y` toggles auto-play for the current player, like Cờ Tỷ Phú. The server rolls and moves (best move) at the offline pace; a "🤖 Tự động chơi" badge shows while on (`view.auto`).
- Protocol copy `src/lib/cangua/protocol.ts` gained `{ type: "auto", on }` and `view.auto`.

**Traps**
- Deploy be_game first: an older backend rejects the `auto` command for Cá Ngựa (toast with the error, nothing breaks).

---

## Accounts and admin go live

- **Date:** 2026-10-17 (PRs #77-#78 released to `main`; backend be_game #14-#20)

**Changes**
- Sign-in is mandatory (`/dang-nhap`); session in `localStorage["games:session"]`. The account menu has Hồ sơ (username, icon, colour) and Mật khẩu tabs; passwords may be 1 character.
- `/admin` (admins only): traffic, games, players, devices, user table. The first admin comes from `ADMIN_USERNAMES` on the backend (`Thach`); register that name first.
- Leaderboard has "Mùa này" (per account) and "Mùa trước (theo tên)".
- Postgres is a new Neon project used only by be_game; this repo still has no database.

**Traps**
- Release the frontend only after both backends report `accounts: "postgres"`; the old frontend cannot join once the backend requires a session.
- The phone's containers need the `docker-begame` bridge to reach the internet (see be_game `docs/SELF_HOSTING.md`).

---

## Failover per room, Cờ Tỷ Phú part 1, deployed-commit check

- **Date:** 2026-10-16 (PRs #67-#73, released to `main`)

**Changes**
- Seat token lives in `localStorage` (shared by every tab; #67). Game UI kit `components/game-ui` + dev-only `/ui-kit` (#68).
- Per-room backend failover (#70): `basesToTry` tries the room's pinned backend first; `resolveJoin` / `failedJoinOutcome`
  count a join timeout or a socket dropped mid-join as unreachable, while the room's own backend answering "not found" is final.
- Cờ Tỷ Phú (#69): tokens are the players' site looks (`seatTokens`; `PiecePicker` removed; tap your token to edit the profile),
  host crown on the avatar, ⚙ display options (`typhu:prefs` `{actions, view}`: full = players panel, minimal = chip strip),
  names always on squares, smaller action buttons, my turn's clock on the panel border (`BorderTimer`).
- `/api/health` returns `{ ok, commit }`; the deploy waits for the shipped commit on the phone and on Vercel (#72, repo variable
  `VERCEL_HEALTH_URL`).

**Not done / follow-ups**
- The two backends do not share a store yet (shared Upstash cutover pending): failover to the backup only resumes a running game
  after that cutover.

---

## Lighter lobby polling

- **Date:** 2026-10-14
- **Branch:** `develop` → `perf/lobby-polling`

**Why:** the be_game backup's Upstash Redis (free tier, 500k commands/month) hit 90%. Redis load
grew with open lobby tabs: every `/rooms` poll costs Redis reads. be_game now caches these reads
(be_game PR #7); this cuts the requests themselves.

**Changes**
- `fetchApi` shares one request between identical GETs within 4 s (`gameClient.ts`): on a lobby
  page `GameLobby` and `AllRoomsPanel` poll the same `/rooms`. Failed requests are not shared.
- Poll intervals: game lobby 5 s → 10 s, all-rooms panel 10 s → 20 s, both via
  `pollWhileVisible()`, which also reloads right away when the tab becomes visible again.

---

## Repurpose as the games site

- **Date:** 2026-10-14
- **Branch:** `develop` → `refactor/repurpose-as-games`

**Changes**
- Removed all portfolio/CMS code: `(public)` + `admin` routes, Auth.js (`src/auth.ts`,
  `src/proxy.ts`), Prisma (schema, migrations, client, Prisma agent skills), Cloudinary, Resend,
  TanStack Table, react-hook-form, markdown stack. Kept the foundation: root layout, `globals.css`
  tokens, shadcn `ui/`, `motion/`, `theme-toggle`, `src/styles/`, pure helpers in `src/lib/`.
- Root layout: static `metadata` (no DB read), `lang="vi"`, `viewportFit: "cover"`.
- Moved the games in from the `portfolio` repo (Next 14 / React 18): 7 online games + Contra,
  `src/components/{games,<game>}`, `src/lib/<game>`, routes, `public/games/` card art,
  `scripts/card-art.mjs`, `docs/GAMES_GUIDE.md` + art prompt docs. Hub moved from `/games` to `/`.
- Added self-hosting with Docker (`Dockerfile`, `compose.selfhost.yml`, `docker-compose.yml`,
  `.github/workflows/deploy.yml`), mirroring be_game's Traefik + Cloudflare Tunnel + Tailscale deploy.
- New deps: `@formkit/auto-animate`, `@number-flow/react`, `@use-gesture/react`,
  `canvas-confetti` (+ types), dev `sharp` (card art script).

**Important decisions**
- **`domMax` instead of `domAnimation`** in the root `LazyMotion`: Cờ Tỷ Phú animates tokens with
  `layoutId`, which needs the layout feature bundle.
- **`m as motion`** in game files: `LazyMotion strict` throws on the full `motion` component; aliasing
  `m` kept every `<motion.div>` unchanged and avoids shadowing by local `m` variables
  (`messages.map((m) => …)`) that a rename to `<m.div>` would have hit.
- **React Compiler lint rules off for the game folders only** (`eslint.config.mjs`): ~50 hits in code
  that works and was never linted with them (Next 14). Refactoring 18k lines was out of scope.
- **Game shell keeps `border-color: currentColor`** (`globals.css`): shadcn's `@layer base`
  `border-border` would otherwise recolor every bare `border` in the game UI.
- **Room pages read `params` with `use()`**: Next 16 passes `params` as a Promise.
- **`output: "standalone"` only when `NEXT_STANDALONE=1`** (set by the Dockerfile): on Vercel it breaks
  `next/font/google` ("next/font/google queries have exactly one entry" for Bricolage Grotesque).
  Bisected on Vercel previews: `develop` builds, this branch failed, and the same branch built without the
  `output` line.
- `NEXT_PUBLIC_*` are build args in Docker (inlined at build time); changing them needs a rebuild.
- `NEXT_PUBLIC_TIENLEN_FALLBACK_URL` (set on Vercel `portfolio`) is not read by any merged code,
  so it was not carried over.

**Not done / follow-ups**
- Docker image not built locally (no Docker on the dev machine): first real check is the server.
- The Vercel project `portfolio-with-cms` and its CMS env vars are now unused.
