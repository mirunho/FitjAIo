import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { sessionRoutes } from "./routes/sessions";
import { clientRoutes } from "./routes/clients";
import { aiRoutes } from "./routes/ai";
import { seedIfEmpty } from "./seed";

seedIfEmpty();

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:3000"],
});

await app.register(sessionRoutes);
await app.register(clientRoutes);
await app.register(aiRoutes);

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT) || 8000;
await app.listen({ port, host: "0.0.0.0" });
console.log(`FitjAIo backend running on http://localhost:${port}`);
