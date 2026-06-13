import { FastifyInstance } from "fastify";
import { getDb } from "../db";

export async function clientRoutes(app: FastifyInstance) {
  app.get("/clients", async () =>
    getDb().prepare("SELECT * FROM clients ORDER BY name").all()
  );

  app.post<{ Body: Record<string, unknown> }>("/clients", async (req, reply) => {
    const { name, notes = "", goals = "" } = req.body as { name: string; notes?: string; goals?: string };
    if (!name) return reply.status(400).send({ error: "name required" });
    const db = getDb();
    const r = db.prepare("INSERT INTO clients (name, notes, goals) VALUES (?,?,?)").run(name, notes, goals);
    return reply.status(201).send(db.prepare("SELECT * FROM clients WHERE id=?").get(r.lastInsertRowid));
  });

  app.get<{ Params: { id: string } }>("/clients/:id", async (req, reply) => {
    const c = getDb().prepare("SELECT * FROM clients WHERE id=?").get(req.params.id);
    return c ?? reply.status(404).send({ error: "Not found" });
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>("/clients/:id", async (req, reply) => {
    const db = getDb();
    const c = db.prepare("SELECT id FROM clients WHERE id=?").get(req.params.id);
    if (!c) return reply.status(404).send({ error: "Not found" });

    const allowed = ["name", "notes", "goals"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return db.prepare("SELECT * FROM clients WHERE id=?").get(req.params.id);

    const setClauses = updates.map(([k]) => `${k}=?`).join(", ");
    db.prepare(`UPDATE clients SET ${setClauses} WHERE id=?`).run(...updates.map(([, v]) => v), req.params.id);
    return db.prepare("SELECT * FROM clients WHERE id=?").get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>("/clients/:id", async (req, reply) => {
    const db = getDb();
    const c = db.prepare("SELECT id FROM clients WHERE id=?").get(req.params.id);
    if (!c) return reply.status(404).send({ error: "Not found" });
    db.prepare("DELETE FROM clients WHERE id=?").run(req.params.id);
    return reply.status(204).send();
  });

  // Personal sessions
  app.get<{ Params: { id: string } }>("/clients/:id/sessions", async (req, reply) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM clients WHERE id=?").get(req.params.id))
      return reply.status(404).send({ error: "Client not found" });
    return db.prepare(
      "SELECT * FROM personal_sessions WHERE client_id=? ORDER BY date DESC"
    ).all(req.params.id);
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/clients/:id/sessions", async (req, reply) => {
    const db = getDb();
    if (!db.prepare("SELECT id FROM clients WHERE id=?").get(req.params.id))
      return reply.status(404).send({ error: "Client not found" });

    const { date, time = "", exercises = "", trainer_notes = "", progress_notes = "", muscle_groups = "" } =
      req.body as { date: string; time?: string; exercises?: string; trainer_notes?: string; progress_notes?: string; muscle_groups?: string };
    if (!date) return reply.status(400).send({ error: "date required" });

    const r = db.prepare(
      "INSERT INTO personal_sessions (client_id, date, time, exercises, trainer_notes, progress_notes, muscle_groups) VALUES (?,?,?,?,?,?,?)"
    ).run(req.params.id, date, time, exercises, trainer_notes, progress_notes, muscle_groups);
    return reply.status(201).send(db.prepare("SELECT * FROM personal_sessions WHERE id=?").get(r.lastInsertRowid));
  });

  app.put<{ Params: { id: string; sid: string }; Body: Record<string, unknown> }>("/clients/:id/sessions/:sid", async (req, reply) => {
    const db = getDb();
    const s = db.prepare("SELECT id FROM personal_sessions WHERE id=? AND client_id=?").get(req.params.sid, req.params.id);
    if (!s) return reply.status(404).send({ error: "Not found" });

    const allowed = ["date", "time", "exercises", "trainer_notes", "progress_notes", "muscle_groups"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (updates.length > 0) {
      const setClauses = updates.map(([k]) => `${k}=?`).join(", ");
      db.prepare(`UPDATE personal_sessions SET ${setClauses} WHERE id=?`).run(...updates.map(([, v]) => v), req.params.sid);
    }
    return db.prepare("SELECT * FROM personal_sessions WHERE id=?").get(req.params.sid);
  });

  app.delete<{ Params: { id: string; sid: string } }>("/clients/:id/sessions/:sid", async (req, reply) => {
    const db = getDb();
    const s = db.prepare("SELECT id FROM personal_sessions WHERE id=? AND client_id=?").get(req.params.sid, req.params.id);
    if (!s) return reply.status(404).send({ error: "Not found" });
    db.prepare("DELETE FROM personal_sessions WHERE id=?").run(req.params.sid);
    return reply.status(204).send();
  });
}
