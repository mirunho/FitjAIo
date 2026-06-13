import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import Database from "better-sqlite3";
import { resetDb } from "../db";
import { sessionRoutes } from "../routes/sessions";
import { clientRoutes } from "../routes/clients";

function buildApp() {
  const app = Fastify();
  app.register(cors);
  app.register(sessionRoutes);
  app.register(clientRoutes);
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE group_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, time TEXT DEFAULT '', class_type TEXT NOT NULL,
      exercises TEXT DEFAULT '', notes TEXT DEFAULT '', participants INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, notes TEXT DEFAULT '', goals TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE personal_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      date TEXT NOT NULL, time TEXT DEFAULT '', exercises TEXT DEFAULT '',
      trainer_notes TEXT DEFAULT '', progress_notes TEXT DEFAULT '',
      muscle_groups TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

beforeEach(() => {
  resetDb(freshDb());
});

describe("Health", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.json()).toEqual({ status: "ok" });
  });
});

describe("Group sessions", () => {
  it("creates and lists sessions", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "POST", url: "/sessions",
      payload: { date: "2025-06-01", time: "10:00", class_type: "Body Shape", participants: 8 },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().class_type).toBe("Body Shape");

    const list = await app.inject({ method: "GET", url: "/sessions" });
    expect(list.json()).toHaveLength(1);
  });

  it("returns 400 when date missing", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "POST", url: "/sessions",
      payload: { class_type: "Walk Core" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("updates session", async () => {
    const app = buildApp();
    const s = (await app.inject({
      method: "POST", url: "/sessions",
      payload: { date: "2025-06-01", time: "09:00", class_type: "Walk Core" },
    })).json();

    const r = await app.inject({
      method: "PUT", url: `/sessions/${s.id}`,
      payload: { notes: "Swietny trening" },
    });
    expect(r.json().notes).toBe("Swietny trening");
  });

  it("deletes session", async () => {
    const app = buildApp();
    const s = (await app.inject({
      method: "POST", url: "/sessions",
      payload: { date: "2025-06-01", time: "09:00", class_type: "Walk Core" },
    })).json();

    const r = await app.inject({ method: "DELETE", url: `/sessions/${s.id}` });
    expect(r.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/sessions" })).json()).toHaveLength(0);
  });

  it("returns 404 for missing session", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "GET", url: "/sessions/999" });
    expect(r.statusCode).toBe(404);
  });
});

describe("Clients", () => {
  it("creates and lists clients", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "POST", url: "/clients",
      payload: { name: "Anna Kowalska", goals: "Redukcja" },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().name).toBe("Anna Kowalska");

    const list = await app.inject({ method: "GET", url: "/clients" });
    expect(list.json()).toHaveLength(1);
  });

  it("updates client", async () => {
    const app = buildApp();
    const c = (await app.inject({
      method: "POST", url: "/clients",
      payload: { name: "Jan Nowak" },
    })).json();

    const r = await app.inject({
      method: "PUT", url: `/clients/${c.id}`,
      payload: { goals: "Budowa masy" },
    });
    expect(r.json().goals).toBe("Budowa masy");
  });

  it("deletes client", async () => {
    const app = buildApp();
    const c = (await app.inject({
      method: "POST", url: "/clients",
      payload: { name: "Test" },
    })).json();

    expect((await app.inject({ method: "DELETE", url: `/clients/${c.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/clients" })).json()).toHaveLength(0);
  });
});

describe("Personal sessions", () => {
  it("full lifecycle", async () => {
    const app = buildApp();
    const c = (await app.inject({
      method: "POST", url: "/clients",
      payload: { name: "Maria" },
    })).json();

    const s = (await app.inject({
      method: "POST", url: `/clients/${c.id}/sessions`,
      payload: { date: "2025-06-10", exercises: "Przysiady 3x12", muscle_groups: "Nogi,Posladki" },
    })).json();
    expect(s.id).toBeDefined();

    const list = (await app.inject({ method: "GET", url: `/clients/${c.id}/sessions` })).json();
    expect(list).toHaveLength(1);

    const upd = (await app.inject({
      method: "PUT", url: `/clients/${c.id}/sessions/${s.id}`,
      payload: { trainer_notes: "Dobra forma" },
    })).json();
    expect(upd.trainer_notes).toBe("Dobra forma");

    expect((await app.inject({ method: "DELETE", url: `/clients/${c.id}/sessions/${s.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/clients/${c.id}/sessions` })).json()).toHaveLength(0);
  });

  it("returns 404 for unknown client", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "POST", url: "/clients/999/sessions",
      payload: { date: "2025-06-01" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("cascades deletion to sessions when client deleted", async () => {
    const app = buildApp();
    const c = (await app.inject({
      method: "POST", url: "/clients",
      payload: { name: "Ewa" },
    })).json();

    await app.inject({ method: "POST", url: `/clients/${c.id}/sessions`, payload: { date: "2025-05-01" } });
    await app.inject({ method: "POST", url: `/clients/${c.id}/sessions`, payload: { date: "2025-05-08" } });

    await app.inject({ method: "DELETE", url: `/clients/${c.id}` });
    expect((await app.inject({ method: "GET", url: `/clients/${c.id}` })).statusCode).toBe(404);
  });
});
