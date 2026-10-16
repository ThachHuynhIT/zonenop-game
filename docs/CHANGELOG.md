# Project Changelog

Purpose: restore project context quickly after `/clear`. Only decisions, problems, and state that
aren't already derivable from git log / current code / `CLAUDE.md`+`AGENTS.md`. Never contains
secrets — see `.env.example` for the shape of required env vars.

The portfolio-with-CMS history (Phases 0–17: Prisma/Neon, Auth.js admin, Cloudinary uploads, Resend
contact form, CV/blog/projects pages) was removed with that code; it is still in git history before
the `refactor/repurpose-as-games` branch (`git log -- docs/CHANGELOG.md`).

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
