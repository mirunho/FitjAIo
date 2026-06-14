import { FastifyInstance } from "fastify";
import { getDb } from "../db";

const CLASS_LIMITS: Record<string, number> = {
  "Body Shape": 6,
  "Trening Obwodowy": 8,
  "Pośladki i Brzuch": 6,
  "WalkCore": 6,
};

export async function registrationRoutes(app: FastifyInstance) {
  // Summary: registration counts per class+date (for calendar badges)
  app.get<{ Querystring: { date_from?: string; date_to?: string } }>(
    "/registrations/summary",
    async (req) => {
      const { date_from, date_to } = req.query;
      const db = getDb();
      const clauses: string[] = [];
      const params: string[] = [];
      if (date_from) { clauses.push("class_date >= ?"); params.push(date_from); }
      if (date_to)   { clauses.push("class_date <= ?"); params.push(date_to); }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      return db
        .prepare(
          `SELECT class_type, class_date,
                  SUM(CASE WHEN status='registered' THEN 1 ELSE 0 END) AS registered,
                  SUM(CASE WHEN status='waitlist'   THEN 1 ELSE 0 END) AS waitlist
           FROM class_registrations ${where}
           GROUP BY class_type, class_date`
        )
        .all(...params);
    }
  );

  // Single slot list
  app.get<{ Querystring: { class_type?: string; class_date?: string } }>(
    "/registrations",
    async (req, reply) => {
      const { class_type, class_date } = req.query;
      if (!class_type || !class_date)
        return reply.status(400).send({ error: "class_type and class_date required" });

      const db = getDb();
      const registrations = db
        .prepare(
          `SELECT * FROM class_registrations
           WHERE class_type=? AND class_date=?
           ORDER BY CASE WHEN status='registered' THEN 0 ELSE 1 END, position, created_at`
        )
        .all(class_type, class_date);

      const limit = CLASS_LIMITS[class_type] ?? 6;
      return { registrations, limit };
    }
  );

  // Register for a class
  app.post<{ Body: Record<string, unknown> }>("/registrations", async (req, reply) => {
    const { class_type, class_date, name, phone = "" } = req.body as {
      class_type: string; class_date: string; name: string; phone?: string;
    };

    if (!class_type || !class_date || !String(name ?? "").trim())
      return reply.status(400).send({ error: "class_type, class_date i name są wymagane" });

    const db = getDb();
    const limit = CLASS_LIMITS[class_type] ?? 6;

    const { count: registeredCount } = db
      .prepare("SELECT COUNT(*) as count FROM class_registrations WHERE class_type=? AND class_date=? AND status='registered'")
      .get(class_type, class_date) as { count: number };

    const status = registeredCount < limit ? "registered" : "waitlist";

    const { count: totalCount } = db
      .prepare("SELECT COUNT(*) as count FROM class_registrations WHERE class_type=? AND class_date=?")
      .get(class_type, class_date) as { count: number };

    const r = db
      .prepare("INSERT INTO class_registrations (class_type, class_date, name, phone, status, position) VALUES (?,?,?,?,?,?)")
      .run(class_type, class_date, String(name).trim(), String(phone ?? "").trim(), status, totalCount + 1);

    return reply.status(201).send(
      db.prepare("SELECT * FROM class_registrations WHERE id=?").get(r.lastInsertRowid)
    );
  });

  // Clear all registrations for a class+date (when deleting a session)
  app.delete<{ Querystring: { class_type?: string; class_date?: string } }>(
    "/registrations/clear",
    async (req, reply) => {
      const { class_type, class_date } = req.query;
      if (!class_type || !class_date)
        return reply.status(400).send({ error: "class_type and class_date required" });
      getDb()
        .prepare("DELETE FROM class_registrations WHERE class_type=? AND class_date=?")
        .run(class_type, class_date);
      return reply.status(204).send();
    }
  );

  // Delete single registration
  app.delete<{ Params: { id: string } }>("/registrations/:id", async (req, reply) => {
    const db = getDb();
    const reg = db
      .prepare("SELECT * FROM class_registrations WHERE id=?")
      .get(req.params.id) as
      | { id: number; class_type: string; class_date: string; status: string }
      | undefined;

    if (!reg) return reply.status(404).send({ error: "Not found" });

    db.prepare("DELETE FROM class_registrations WHERE id=?").run(req.params.id);

    if (reg.status === "registered") {
      const limit = CLASS_LIMITS[reg.class_type] ?? 6;
      const { count: remaining } = db
        .prepare("SELECT COUNT(*) as count FROM class_registrations WHERE class_type=? AND class_date=? AND status='registered'")
        .get(reg.class_type, reg.class_date) as { count: number };

      if (remaining < limit) {
        const first = db
          .prepare("SELECT id FROM class_registrations WHERE class_type=? AND class_date=? AND status='waitlist' ORDER BY position, created_at LIMIT 1")
          .get(reg.class_type, reg.class_date) as { id: number } | undefined;
        if (first)
          db.prepare("UPDATE class_registrations SET status='registered' WHERE id=?").run(first.id);
      }
    }

    return reply.status(204).send();
  });
}
