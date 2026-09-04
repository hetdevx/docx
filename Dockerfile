# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" bunx prisma generate
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# soffice (headless LibreOffice) converts uploaded PDFs to DOCX so they can
# go through the same editable-content flow as native DOCX uploads.
RUN apk add --no-cache libreoffice

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
