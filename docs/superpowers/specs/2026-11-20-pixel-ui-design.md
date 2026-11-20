# Pixel arcade UI and regression fixes

Approved in chat on 2026-11-20: “Kiểu dáng pixel là đc rồi, tiến hành hết đi”.

## Intent and scope

Redesign the existing Vietnamese multiplayer games site in a coherent pixel arcade style and fix reproducible UI/client lifecycle defects. Cover the hub, authentication/account, shared navigation/lobbies/chat, all eight online games, and Contra's surrounding UI. Preserve game rules, protocols, scoring, backend endpoints, hidden information, existing card illustrations and board geometry.

## Approaches

- Token-only reskin: cheap but leaves rounded glass layouts and duplicate dialogs untouched.
- Full engine/art replacement: unnecessary risk to rules, performance and readable card identity.
- Selected: reuse the existing game-ui foundation, add intentional pixel iconography and scoped SCSS, then migrate the existing screens and legacy modal adapters. This gives every route the same visual language without replacing game engines.

## Visual contract

- Dark navy background (#10182b), deep ink (#070d19), raised panels (#1b2a43), cream foreground (#f4ecd8), muted blue (#a9bdd4), gold (#ffd66b), mint (#83e0bb), coral (#ff927e).
- Square geometry with 2px outlines, 4px hard shadows, stepped accents, 4px spacing rhythm; no glass blur or decorative gradients in redesigned chrome.
- Original code-native pixel SVG icons for nine game identities and controller mark. Decorative icons are hidden from assistive technology. Do not use image generation for vector/code-native icons.
- Self-hosted existing Geist Mono for display/control labels and readable existing sans for body, Vietnamese rules, chat and dense card data. Avoid remote font dependencies and unreadable bitmap Vietnamese.
- Preserve game-specific accent colors and distinguish selected, disabled, busy, offline, error and current-turn states without depending on color alone.
- UI remains usable at widths 320, 360, 390, 768 and 1440px and landscape 844x390. Touch controls have 44px minimum where space permits; dense board/card controls retain an accessible detail affordance.
- Respect reduced motion; no pixel filter on text or detailed card illustrations.

## Architecture and constraints

- Build on Next.js 16.4.5, React 19, existing Base UI / Vaul / Motion; read bundled Next docs after lockfile synchronization.
- SCSS Modules colocated with components. Shared static mixins and aliases in src/styles; runtime theme tokens in globals.css. Preserve root/dark token order and existing shadcn behavior.
- Shared UI API stays compatible. Add a reusable accessible legacy modal adapter using existing Base UI, not an additional dependency.
- Shared styles own their files exclusively. Parallel workers touch disjoint areas; route shared API requests to the controller.
- No backend/database changes; no secrets in docs or screenshots; no production account/room mutations for QA. Use mocked local HTTP/WebSocket fixtures for gameplay states when real authenticated sessions are unavailable.

## Functional fixes

Reproduce and fix: stale logout/password responses overwriting newer sessions; overlapping room reconnect attempts; chat focus stealing, unnecessary auto-scroll and rejected sends; stale lobby refresh status; missing dialog focus/accessible names; unnamed selectable hidden Mèo Nổ cards; Contra held keys after losing focus and Enter handling outside its game controls. Add guarded request deadlines if needed for affected pending UI, with no automatic retry of password/logout mutations. Do not speculate about server heartbeat policy or change room semantics without evidence.

## Validation and completion

Run baseline and final npm run lint, npm run typecheck, npm test, npm run build. Add focused regression tests for behavior changes; use browser interaction checks for dialogs and responsive UI, not tests mirroring CSS implementation. Inspect desktop/mobile screenshots and console. Smoke all nine routes and representative waiting, playing, ended, spectator and reconnecting views using fixtures; explicitly document any state that cannot be verified. Leave the branch reviewable with changelog and evidence; never merge without separate authorization.
