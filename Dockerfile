# ===== Build stage =====
FROM node:22-bookworm-slim AS build
# build tools เผื่อ argon2/prisma ต้อง compile
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.7.0
WORKDIR /app

# copy manifests ก่อน (cache layer)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN pnpm install --no-frozen-lockfile

# copy source ทั้งหมด
COPY . .

# build web (baked VITE_API_BASE_URL=/api)
ENV VITE_API_BASE_URL=/api
RUN pnpm --filter ./web build

# prisma generate + build api
RUN pnpm --filter ./api exec prisma generate
RUN pnpm --filter ./api build

# ย้าย web build เข้า api/public (ให้ API เสิร์ฟ web)
RUN rm -rf api/public && cp -r web/dist api/public

# ===== Runtime stage =====
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.7.0
WORKDIR /app
ENV NODE_ENV=production

# คัดลอกทั้งแอป (รวม node_modules + prisma engines + public)
COPY --from=build /app /app

WORKDIR /app/api
EXPOSE 3000
# รัน migration แล้วเริ่ม server
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
