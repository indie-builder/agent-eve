FROM node:26.12.0-alpine AS build-base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')"
COPY . .
RUN pnpm install --frozen-lockfile

FROM build-base AS api-build
RUN pnpm exec turbo build --filter=@agent-template/api
RUN pnpm --filter @agent-template/api deploy --prod /deploy/api

FROM build-base AS worker-build
RUN pnpm exec turbo build --filter=@agent-template/worker
RUN pnpm --filter @agent-template/worker deploy --prod /deploy/worker

FROM build-base AS workflow-setup
ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@agent-template/runtime", "run", "workflow:setup"]

FROM build-base AS runtime-build
RUN pnpm exec turbo build --filter=@agent-template/runtime

FROM build-base AS web-build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:14000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm exec turbo build --filter=@agent-template/web

FROM node:26.12.0-alpine AS api
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=14000
WORKDIR /app
COPY --from=api-build --chown=node:node /deploy/api ./
USER node
EXPOSE 14000
CMD ["node", "dist/server.js"]

FROM node:26.12.0-alpine AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=worker-build --chown=node:node /deploy/worker ./
USER node
CMD ["node", "dist/worker.js"]

FROM node:26.12.0-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=13010
WORKDIR /app
COPY --from=runtime-build --chown=node:node /app/apps/runtime/.output ./.output
COPY --from=runtime-build --chown=node:node /app/apps/runtime/.eve/sandbox-cache/just-bash/templates ./.eve/sandbox-cache/just-bash/templates
RUN chown -R node:node .eve
USER node
EXPOSE 13010
CMD ["node", ".output/server/index.mjs"]

FROM node:26.12.0-alpine AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=13000
WORKDIR /app
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 13000
CMD ["node", "apps/web/server.js"]
