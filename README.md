# zonenop-game

Board and card games to play online with friends, right in the browser: Tiến Lên Miền Nam, Mèo Nổ,
Cờ Tỷ Phú, Đá Quý (Splendor), Đấu Súng (Bang!), Ô Ăn Quan, Cờ Cá Ngựa, plus an offline Contra.

- Frontend only (this repo): Next.js 16 (App Router), React 19, Tailwind 4, `motion`.
- Rooms, game state and WebSockets: the separate **be_game** repo, reached via
  `NEXT_PUBLIC_TIENLEN_SERVER_URL`.
- No database, no auth.

The hub is `/`; each game has a lobby at its route (`/tien-len`, `/meo-no`, …) and tables at
`/<game>/<ROOM>`. How the game UI is put together: [`docs/GAMES_GUIDE.md`](docs/GAMES_GUIDE.md).

## Development

```bash
cp .env.example .env    # set NEXT_PUBLIC_TIENLEN_SERVER_URL (be_game, default http://localhost:4000)
npm install
npm run dev             # http://localhost:3000
```

Run be_game alongside (`npm run dev` in that repo; it uses an in-memory store without Redis).

| Script | What |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` | Checks run by CI |
| `npm run art:meono` / `npm run art:bang` | Rebuild card art from `/art/` sources into `public/games/` |

## Deploy self-host (Docker)

Same setup as be_game: the server runs Traefik (external network `traefik_network`) behind a
Cloudflare Tunnel; nothing publishes ports.

1. On the server, in the deploy folder (e.g. `~/apps/games_web`), create `.env`:
   ```
   WEB_DOMAIN=games.example.com
   NEXT_PUBLIC_TIENLEN_SERVER_URL=https://game.example.com
   ```
2. Route `WEB_DOMAIN` to Traefik in the Cloudflare Tunnel (like be_game's domain).
3. Add `https://<WEB_DOMAIN>` to be_game's `ALLOWED_ORIGIN`, or its WebSockets reject the site.
4. GitHub → this repo → Settings → Environments → `self-hosted`: add the same secrets as be_game
   (`TS_OAUTH_CLIENT_ID`, `TS_AUDIENCE`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`,
   `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`) and `DEPLOY_PATH` = this app's own folder (**not**
   be_game's). Optional variable `WEB_DOMAIN` enables the public health check.

Every push to `main` that passes CI is then deployed by `.github/workflows/deploy.yml`
(`docker compose -f compose.selfhost.yml up -d --build`). By hand on the server:

```bash
docker compose -f compose.selfhost.yml up -d --build
```

`NEXT_PUBLIC_*` values are baked in at build time, so changing them needs `--build`.

Local run of the production image: `docker compose up --build` → http://localhost:3000.
