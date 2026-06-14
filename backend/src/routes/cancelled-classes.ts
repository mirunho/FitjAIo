import type { FastifyInstance } from "fastify";
import { getDb } from "../db";

export async function cancelledClassesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { date_from?: string; date_to?: string } }>(
    "/cancelled-classes",
    async (req) => {
      const { date_from, date_to } = req.query;
      const db = getDb();
      const clauses: string[] = [];
      const params: string[] = [];
      if (date_from) { clauses.push("class_date >= ?"); params.push(date_from); }
      if (date_to)   { clauses.push("class_date <= ?"); params.push(date_to); }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      return db.prepare(`SELECT class_type, class_date FROM cancelled_classes ${where}`).all(...params);
    }
  );

  app.post<{ Body: Record<string, unknown> }>("/cancelled-classes", async (req, reply) => {
    const { class_type, class_date } = req.body as { class_type: string; class_date: string };
    if (!class_type || !class_date)
      return reply.status(400).send({ error: "class_type and class_date required" });

    const db = getDb();
    db.prepare(
      "INSERT OR IGNORE INTO cancelled_classes (class_type, class_date) VALUES (?, ?)"
    ).run(class_type, class_date);

    // Also clear registrations for the cancelled class
    db.prepare(
      "DELETE FROM class_registrations WHERE class_type=? AND class_date=?"
    ).run(class_type, class_date);

    return reply.status(201).send({ class_type, class_date });
  });

  app.delete<{ Querystring: { class_type?: string; class_date?: string } }>(
    "/cancelled-classes",
    async (req, reply) => {
      const { class_type, class_date } = req.query;
      if (!class_type || !class_date)
        return reply.status(400).send({ error: "class_type and class_date required" });

      getDb()
        .prepare("DELETE FROM cancelled_classes WHERE class_type=? AND class_date=?")
        .run(class_type, class_date);
      return reply.status(204).send();
    }
  );
}
