FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/src/ ./src/
COPY backend/tsconfig.json ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/fitjaio.db

EXPOSE 8080

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
