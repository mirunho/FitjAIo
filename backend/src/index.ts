import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { sessionRoutes } from "./routes/sessions";
import { clientRoutes } from "./routes/clients";
import { aiRoutes } from "./routes/ai";
import { getDb } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

// Initialise DB + run migrations + seed history (all in getDb on first call)
getDb();

const app = Fastify({ logger: isProd ? false : true, ignoreTrailingSlash: true });

// CORS only needed in dev (in prod, frontend is served from same origin)
if (!isProd) {
  await app.register(cors, {
    origin: ["http://localhost:5173", "http://localhost:3000"],
  });
}

await app.register(sessionRoutes);
await app.register(clientRoutes);
await app.register(aiRoutes);

app.get("/health", async () => ({ status: "ok" }));

// Serve built frontend in production
if (isProd) {
  const distPath = path.join(__dirname, "..", "..", "frontend", "dist");
  await app.register(staticFiles, { root: distPath, prefix: "/" });
  // SPA fallback - serve index.html for any unknown route
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile("index.html");
  });
}

const port = Number(process.env.PORT) || 8000;
await app.listen({ port, host: "0.0.0.0" });
console.log(`FitjAIo running on http://localhost:${port} [${isProd ? "production" : "development"}]`);
