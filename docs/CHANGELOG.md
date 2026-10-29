# Project Changelog

Purpose: restore project context quickly after `/clear`. Only decisions, problems, and state that
aren't already derivable from git log / current code / `CLAUDE.md`+`AGENTS.md`. Never contains
secrets — see `.env.example` for the shape of required env vars.

The portfolio-with-CMS history (Phases 0–17: Prisma/Neon, Auth.js admin, Cloudinary uploads, Resend
contact form, CV/blog/projects pages) was removed with that code; it is still in git history before
the `refactor/repurpose-as-games` branch (`git log -- docs/CHANGELOG.md`).

---

## Nối Chữ, the eighth game

- **Date:** 2026-10-29 (branch `feature/noi-chu`; backend be_game `feature/noi-chu` ([be_game #25](https://github.com/ThachHuynhIT/be_game/pull/25)), **deploy it first**).
- New game at `/noi-chu`, 2–8 players: type a two-syllable word whose first syllable is the last syllable of the previous word (tone marks must match, no repeats); running out of time puts you out, the last one standing wins. Rules, settings and commands: `be_game/docs/games/noichu.md`; UI notes: `docs/GAMES_GUIDE.md` §4.8.
- First table written with the SCSS Module rule (`NoiChuTable.module.scss`) and the `game-ui` kit instead of long Tailwind class strings.
- Dictionary check lives on the server (be_game ships a 48,425-word list from Viet74K, GPL-2.0, kept as a separate data file there; the licence decision and caveats are in be_game's `src/noichu/dict/README.md`). Known limit: the list is incomplete (e.g. `con mèo` is missing), so the host can turn the check off in the room settings.
- Verified against a real be_game with two Playwright browsers (register, create room, settings, refused words, 4 valid words, timeout, result, new game, phone width, hub card, lobby). The Playwright script is not in the repo.

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
