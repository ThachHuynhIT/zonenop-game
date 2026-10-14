@AGENTS.md

## What this repo is

The games site: 7 online multiplayer games (Tiến Lên, Mèo Nổ, Cờ Tỷ Phú, Splendor,
Bang!, Ô Ăn Quan, Cờ Cá Ngựa) plus offline Contra. The hub is `/`, each game lives
at its own route (`/tien-len`, `/meo-no`, …, `/contra`). There is no database and no
auth: rooms, game state and WebSockets live in the separate **be_game** repo,
reached via `NEXT_PUBLIC_TIENLEN_SERVER_URL`. It is self-hosted with Docker
(`compose.selfhost.yml`, deployed by `.github/workflows/deploy.yml`), like be_game.

(History: this repo started as a portfolio with a self-built CMS, abandoned in
favour of hosting the games; that code was removed in `refactor/repurpose-as-games`.)

- `src/components/games/`: shared game framework (GamesShell, GameLobby,
  `gameClient.ts` WebSocket client, `gamesRegistry.ts` list of online games).
- `src/components/<game>/` + `src/lib/<game>/`: per-game table UI and
  rules/protocol (the protocol mirrors be_game; keep the two in sync).
- `docs/GAMES_GUIDE.md`: how to add a game. `scripts/card-art.mjs`: card art
  pipeline (`npm run art:meono` / `art:bang`).

## Repository conventions

### Secrets
Never commit `.env` (it's gitignored). Only `.env.example` — placeholder values
only, no real credentials — is tracked. When a change introduces a new required
env var, update both `.env` (local, real/placeholder value) and `.env.example`
(placeholder) in the same change so the two never drift apart.

### Styling
- **SCSS Modules (`*.module.scss`) là cách styling mặc định** cho page/component
  layout, spacing, typography, responsive, và animation/visual styling.
- Tailwind chỉ dùng khi thực sự phù hợp — đặc biệt cho `shadcn/ui` (giữ nguyên
  cách nó style, không convert) và các utility đơn giản, một-lần dùng.
- Không dùng chuỗi class Tailwind dài cho page/component nếu một SCSS Module là
  lựa chọn phù hợp hơn.
- Không dùng inline style (`style={{ ... }}`) trừ khi có lý do kỹ thuật rõ ràng
  (ví dụ: giá trị tính toán runtime không thể biểu diễn bằng class tĩnh).
- Style riêng của 1 component/page không đặt trong `globals.css` — chỉ những
  gì thực sự toàn cục (theme tokens, reset, font) mới ở đó.
- File `.module.scss` colocate ngay cạnh component/page nó phục vụ (cùng
  folder). Token/mixin dùng chung nằm ở `src/styles/` (`@styles/*`), import
  bằng `@use "@styles/variables" as vars;` / `@use "@styles/mixins" as mix;`.
- **Trạng thái hiện tại:** toàn bộ code game (chuyển sang từ repo portfolio,
  Next 14) dùng Tailwind utility class + `cn()` cho layout — viết từ trước khi
  rule này áp dụng. Đây là nợ kỹ thuật đã biết; code mới theo rule SCSS Modules,
  code game chuyển dần khi refactor từng bàn, không convert hồi tố hàng loạt.
- Các class dùng chung cho mọi bàn game (`.game-shell`, `.games-shell-table`,
  `.games-table`, variant `short:`) nằm trong `globals.css` vì chúng là layout
  toàn cục của game shell.
- Animation: root layout dùng `<LazyMotion features={domMax} strict>`, nên
  import `m` từ `motion/react` (code game dùng `m as motion`), không dùng
  `motion.*` đầy đủ — strict mode sẽ throw.
- Lint: các rule React Compiler (`react-hooks/refs`, `set-state-in-effect`, …)
  đang tắt **chỉ cho các thư mục game** trong `eslint.config.mjs` (nợ kỹ thuật);
  code ngoài các thư mục đó vẫn bị kiểm tra đầy đủ.

### Token ownership (Phase 10)
Token sống ở **CSS custom property** (`src/app/globals.css`, cả `:root` và
`.dark`) nếu giá trị phải đổi lúc runtime (theme) hoặc phải được
Tailwind/shadcn đọc (mọi biến shadcn nhìn thấy qua `@theme inline`). Token
sống ở **SCSS `$variable`** (`src/styles/_variables.scss`) nếu tĩnh *và* cần
lúc build (breakpoint cho `@media`, SCSS math, `@for`/map lookup). Với token
do CSS var sở hữu mà SCSS Module cần dùng, `_variables.scss` expose **alias
mỏng** dạng `$x: var(--x)` — component SCSS chỉ có một cửa import
(`@use "@styles/variables" as vars;`) và không bao giờ gõ `var()` thô; giá
trị vẫn nằm đúng một chỗ. Ví dụ: `$radius-lg: var(--radius-lg)`,
`$duration-fast: var(--duration-fast)`.

Hai bẫy phải giữ khi sửa `globals.css`:
1. `:root` và `.dark` cùng specificity (0,1,0) — dark chỉ thắng nhờ thứ tự
   nguồn trong file. Mọi block token mới phải append vào **cả hai**, và
   `.dark` phải luôn ở **sau** `:root` trong file.
2. CSS Modules hash tên `@keyframes` cục bộ — animation dùng chung phải emit
   keyframes qua `@at-root` trong mixin (xem `skeleton` trong `_mixins.scss`),
   không khai báo keyframes trực tiếp trong `globals.css` rồi trỏ tên từ SCSS
   Module.

### Module aliases
TypeScript path aliases hiện có (`tsconfig.json`), mỗi alias trỏ tới một thư
mục **thực sự tồn tại** với nội dung thật — không tạo alias cho domain/module
chưa có:

| Alias | Trỏ tới | Có thật vì |
|---|---|---|
| `@/*` | `./src/*` | gốc, dùng chung |
| `@components/*` | `./src/components/*` | `ui/` (shadcn), `games/` và UI từng game |
| `@lib/*` | `./src/lib/*` | `utils.ts`, rules/protocol từng game (`tienlen/`, `meono/`, …) |
| `@styles/*` | `./src/styles/*` | shared SCSS partials (`_variables.scss`, `_mixins.scss`) |

- Ưu tiên dùng alias khi import giữa các module khác nhau; tránh relative
  import sâu kiểu `../../../`.
- Relative import (`./`, `../`) vẫn dùng bình thường cho file gần nhau trong
  cùng component/module (ví dụ colocated `.module.scss`).
- **Không** tạo alias cho domain chưa tồn tại thật trong code (ví dụ
  `@modules/*`, `@games/*`, `@tienlen/*`) chỉ vì route cùng tên đang tồn tại ở
  `src/app/...` — route là routing, không phải domain module có logic riêng.
  Code game hiện import qua `@/components/...` và `@/lib/...`. Nếu sau này thực sự tái cấu trúc thành domain module
  (`src/modules/<domain>/`), thêm alias tương ứng lúc đó, như một quyết định
  kiến trúc riêng — không thêm alias rỗng trước để "dành chỗ".
- Không tạo alias cho mọi folder nhỏ — alias phải đại diện cho một application
  boundary có ý nghĩa (đủ lớn/đủ dùng chung để việc gọi tên tắt có giá trị).

## Git & task workflow

This project is also how the maintainer is learning Git, branching, commits, PRs,
code review, Next.js, Prisma, Postgres, auth, testing, software architecture, and
effective Claude Code usage. Prefer teaching/explaining over silently generating
code — the process matters as much as the result.

### Branching
- `main` is always stable and deployable. `develop` is the integration branch.
- Every feature/task branch is created **from `develop`**, not from `main`:
  `feature/<name>`, `fix/<name>`, `refactor/<topic>`, `chore/<topic>`.
- Never implement a feature directly on `main` or directly on `develop` — always
  through a dedicated branch, even small ones, unless the change is genuinely
  trivial (see below).
- Keep each branch scoped to one meaningful feature or learning topic. Don't
  create a branch for a tiny/trivial change.
- `main` only moves forward via merges from `develop` (releases) — that's a
  separate decision the maintainer makes, not part of the per-task flow below.

### Per-task process
Always state which STEP is currently active. Do not skip steps for non-trivial tasks.

1. **Check git state** — current branch, `git status`, recent commits, confirm no
   unexpected uncommitted changes. Confirm the task branch is created from (and
   up to date with) `develop`. No modifications yet.
2. **Analyze** — read the relevant existing code, `CLAUDE.md`/`AGENTS.md`, current
   architecture, dependencies/side effects. Explain the problem and proposed
   solution. No code changes yet.
3. **Plan** — goal, requirements, files to create/change, DB changes,
   API/server-side changes, UI changes, validation, error handling, security
   considerations, testing strategy, risks. Keep it simple, avoid unnecessary
   abstractions. **Stop and wait for approval before implementing.**
4. **Implement** — only the approved scope, following the existing architecture.
   No unrelated features, no unnecessary new dependencies, no unrelated files.
5. **Verify** — run lint, tests, build (when appropriate), check for TypeScript
   errors, review the final `git diff`.
6. **Code review** — review as a senior engineer: bugs, security issues, data
   integrity, TypeScript issues, architecture problems, unnecessary abstractions,
   duplicated code, error handling, edge cases, accessibility, test coverage.
   Report findings only — do not modify code during this step.
7. **Fix review findings** — only after approval, fix reported issues, re-run
   lint/tests/build, show the final diff.
8. **Commit** — Claude may commit on the task branch once lint and build are
   clean. Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
   `chore:`) with a clear description, e.g. `feat: add project CRUD`.
9. **Pull request** — Claude may push the task branch and open a PR **targeting
   `develop`** with: summary, changes, technical decisions, testing performed,
   potential risks, and screenshots for UI changes.
10. **PR review** — before merge, review the branch against `develop` for
    correctness, architecture, security, DB migration safety, regression risk,
    test coverage, and unnecessary changes. **Merging (a PR into `develop`, or
    `develop` → `main`) always requires asking the maintainer first** and waiting
    for an explicit yes.

### Hard rules
- Commit and push of task branches are allowed. Never merge without asking,
  never delete branches without asking, never force-push `develop` or `main`.
- Never make destructive changes without asking.
- Never expand scope without asking.
- Never skip the planning step (3) for a non-trivial task.
- If requirements are ambiguous, ask before implementing.
- If a better architectural approach is found mid-task, explain it before
  changing direction — don't switch silently.
- Before committing anything, run `npm run lint`
  and `npm run build` and make sure both are clean.

### Operating modes

Default mode is **Learning Mode** — the per-task process above, in full (state each
STEP, explain before implementing, wait for plan approval at Step 3, narrate decisions).
Use this whenever a task doesn't specify otherwise.

**Full Auto Mode** — opt in per task by prefixing the request with `full auto:`. Same
end-to-end responsibility (branch → implement → validate → docs → report), optimized for
less token/context and less narration, without lowering engineering quality:

- **Read minimally.** Only files/rules/docs relevant to the task. Don't re-read this
  file's rules or scan all of `docs/CHANGELOG.md`/`docs/LESSONS.md` — jump to the
  relevant section only.
- **Execute over explain.** Skip step-by-step narration and the Step-3 stop-and-wait for
  plan approval. Steps 1-2 (check git state, analyze) still happen, just silently.
- **Ask only when:** the action is destructive/hard-to-reverse, touches shared/remote
  state, expands scope beyond the request, or the requirement is genuinely ambiguous.
  Everything else proceeds without a pause.
- **No incremental progress messages** for routine sub-steps (one file read, one edit,
  one test run). Still surface: branch creation, any risk/ambiguity pause, and the final
  report.
- **Self-review replaces the separate Code Review step.** Still check for bugs,
  security, data integrity, TypeScript issues, accessibility, and edge cases before
  reporting — just fold it into fixing rather than a separately narrated review pass.
- **MCP tools:** call only when the task genuinely needs one, and request the minimal
  output needed.
- **Docs are mandatory, not optional:**
  - Update `docs/CHANGELOG.md` for every meaningful change (new feature, schema/API
    change, dependency added, architectural decision, breaking change). Skip for
    typos/formatting/pure refactors with no behavior change.
  - Update `docs/LESSONS.md` only when something has lasting reuse value (a technique, a
    bug root-cause worth remembering, a non-obvious decision rationale). Most tasks won't
    need this.
  - Write both so a future session can resume cold after `/clear` from these files alone.
- **Final report format** (replaces prose summaries):
  ```
  Changed: <files/behavior>
  Validation: <lint/test/build results>
  Docs: <CHANGELOG/LESSONS updated? yes/no + what>
  Status: <done | blocked on X | awaiting review>
  ```
- **Never relaxes:** security, input validation, error handling, logging, or the Hard
  Rules above (no auto-merge/branch-delete, no scope creep, no destructive action
  without asking, no skipping lint/build before commit). Full Auto Mode cuts process
  *overhead*, never engineering *rigor*.
