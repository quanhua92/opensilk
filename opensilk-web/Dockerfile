FROM node:25-alpine AS base

FROM base AS deps
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
RUN npm install -g pnpm
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output /app/.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
