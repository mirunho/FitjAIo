import { FastifyInstance } from "fastify";
import { getDb } from "../db";

export async function sessionRoutes(app: FastifyInstance) {
  app.get("/sessions", async () => {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM group_sessions ORDER BY date DESC, time DESC"
    ).all();
  });

  app.post<{ Body: Record<string, unknown> }>("/sessions", async (req, reply) => {
    const { date, time, class_type, exercises = "", notes = "", participants = 0 } = req.body as {
      date: string; time: string; class_type: string;
      exercises?: string; notes?: string; participants?: number;
    };
    if (!date || !class_type) return reply.status(400).send({ error: "date and class_type required" });

    const db = getDb();
    const r = db.prepare(
      "INSERT INTO group_sessions (date, time, class_type, exercises, notes, participants) VALUES (?,?,?,?,?,?)"
    ).run(date, time || "", class_type, exercises, notes, participants);

    return reply.status(201).send(
      db.prepare("SELECT * FROM group_sessions WHERE id=?").get(r.lastInsertRowid)
    );
  });

  app.get<{ Params: { id: string } }>("/sessions/:id", async (req, reply) => {
    const s = getDb().prepare("SELECT * FROM group_sessions WHERE id=?").get(req.params.id);
    return s ?? reply.status(404).send({ error: "Not found" });
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>("/sessions/:id", async (req, reply) => {
    const db = getDb();
    const s = db.prepare("SELECT * FROM group_sessions WHERE id=?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!s) return reply.status(404).send({ error: "Not found" });

    const allowed = ["date", "time", "class_type", "exercises", "notes", "participants"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return s;

    const setClauses = updates.map(([k]) => `${k}=?`).join(", ");
    const values = updates.map(([, v]) => v);
    db.prepare(`UPDATE group_sessions SET ${setClauses} WHERE id=?`).run(...values, req.params.id);
    return db.prepare("SELECT * FROM group_sessions WHERE id=?").get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>("/sessions/:id", async (req, reply) => {
    const db = getDb();
    const s = db.prepare("SELECT id FROM group_sessions WHERE id=?").get(req.params.id);
    if (!s) return reply.status(404).send({ error: "Not found" });
    db.prepare("DELETE FROM group_sessions WHERE id=?").run(req.params.id);
    return reply.status(204).send();
  });
}
