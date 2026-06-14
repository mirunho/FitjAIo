import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import Database from "better-sqlite3";
import { resetDb } from "../db";
import { cancelledClassesRoutes } from "../routes/cancelled-classes";
import { registrationRoutes } from "../routes/registrations";

function buildApp() {
  const app = Fastify();
  app.register(cancelledClassesRoutes);
  app.register(registrationRoutes);
  return app;
}

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE cancelled_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_type TEXT NOT NULL,
      class_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(class_type, class_date)
    );
    CREATE TABLE class_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_type TEXT NOT NULL,
      class_date TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'registered',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

beforeEach(() => { resetDb(freshDb()); });

describe("POST /cancelled-classes", () => {
  it("cancels a class", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "Body Shape", class_date: "2026-06-16" },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().class_type).toBe("Body Shape");
  });

  it("returns 400 without required fields", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "POST", url: "/cancelled-classes", payload: {} });
    expect(r.statusCode).toBe(400);
  });

  it("is idempotent (duplicate cancel doesn't error)", async () => {
    const app = buildApp();
    const payload = { class_type: "Body Shape", class_date: "2026-06-16" };
    await app.inject({ method: "POST", url: "/cancelled-classes", payload });
    const r = await app.inject({ method: "POST", url: "/cancelled-classes", payload });
    expect(r.statusCode).toBe(201);
  });

  it("clears registrations when cancelling", async () => {
    const app = buildApp();
    await app.inject({
      method: "POST", url: "/registrations",
      payload: { class_type: "Body Shape", class_date: "2026-06-16", name: "Anna", phone: "" },
    });
    await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "Body Shape", class_date: "2026-06-16" },
    });
    const list = await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-16",
    });
    expect(list.json().registrations).toHaveLength(0);
  });
});

describe("GET /cancelled-classes", () => {
  it("returns cancelled classes in date range", async () => {
    const app = buildApp();
    await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "Body Shape", class_date: "2026-06-16" },
    });
    await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "WalkCore", class_date: "2026-06-18" },
    });

    const r = await app.inject({
      method: "GET", url: "/cancelled-classes?date_from=2026-06-16&date_to=2026-06-18",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toHaveLength(2);
  });

  it("filters by date range", async () => {
    const app = buildApp();
    await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "Body Shape", class_date: "2026-06-16" },
    });
    await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "WalkCore", class_date: "2026-06-25" },
    });

    const r = await app.inject({
      method: "GET", url: "/cancelled-classes?date_from=2026-06-16&date_to=2026-06-20",
    });
    expect(r.json()).toHaveLength(1);
    expect(r.json()[0].class_type).toBe("Body Shape");
  });
});

describe("DELETE /cancelled-classes", () => {
  it("restores a cancelled class", async () => {
    const app = buildApp();
    await app.inject({
      method: "POST", url: "/cancelled-classes",
      payload: { class_type: "Body Shape", class_date: "2026-06-16" },
    });
    const del = await app.inject({
      method: "DELETE", url: "/cancelled-classes?class_type=Body%20Shape&class_date=2026-06-16",
    });
    expect(del.statusCode).toBe(204);

    const r = await app.inject({
      method: "GET", url: "/cancelled-classes?date_from=2026-06-16&date_to=2026-06-16",
    });
    expect(r.json()).toHaveLength(0);
  });

  it("returns 400 without required fields", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "DELETE", url: "/cancelled-classes" });
    expect(r.statusCode).toBe(400);
  });
});
