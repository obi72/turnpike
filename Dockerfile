FROM node:22-alpine AS builder
WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm install
COPY apps/backend/ .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
