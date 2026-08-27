FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm --filter @ai-material/api prisma:generate && pnpm --filter @ai-material/api build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @ai-material/api exec prisma migrate deploy && pnpm --filter @ai-material/api prisma:seed && node apps/api/dist/src/main"]
