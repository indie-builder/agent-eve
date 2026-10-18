FROM node:26.12.0-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/agent/package.json packages/agent/package.json
COPY packages/agent-claude/package.json packages/agent-claude/package.json
COPY packages/agent-eve/package.json packages/agent-eve/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm install --global "$(node -p 'require("./package.json").packageManager')" && pnpm install --frozen-lockfile

COPY . .

RUN pnpm db:generate && pnpm build

EXPOSE 13000 13010 14000
