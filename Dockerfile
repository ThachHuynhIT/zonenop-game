# Self-hosted games web (Next.js standalone server). Same host setup as be_game: Traefik + Cloudflare Tunnel.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they are build args, not runtime env.
ARG NEXT_PUBLIC_TIENLEN_SERVER_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_TIENLEN_SERVER_URL=$NEXT_PUBLIC_TIENLEN_SERVER_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# output: "standalone" (next.config.ts, enabled by NEXT_STANDALONE=1 above) bundles server.js with only the node_modules it needs;
# static assets and public/ are not part of it and are copied next to it.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
EXPOSE 3000
USER node

# No curl in the image: ask node itself.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# Exec form so SIGTERM reaches node.
CMD ["node", "server.js"]
