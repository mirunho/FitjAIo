import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import Database from "better-sqlite3";
import { resetDb } from "../db";
import { registrationRoutes } from "../routes/registrations";

function buildApp() {
  const app = Fastify();
  app.register(registrationRoutes);
  return app;
}

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
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

// ── helpers ──────────────────────────────────────────────────────────
async function register(app: ReturnType<typeof buildApp>, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST", url: "/registrations",
    payload: {
      class_type: "Body Shape", class_date: "2026-06-10",
      name: "Anna Nowak", phone: "600111222",
      ...overrides,
    },
  });
}

async function fillClass(
  app: ReturnType<typeof buildApp>,
  classType: string,
  classDate: string,
  count: number
) {
  for (let i = 0; i < count; i++) {
    await register(app, { class_type: classType, class_date: classDate, name: `Osoba ${i + 1}` });
  }
}

// ── POST /registrations ───────────────────────────────────────────────
describe("POST /registrations", () => {
  it("creates a registration with status registered", async () => {
    const app = buildApp();
    const r = await register(app);
    expect(r.statusCode).toBe(201);
    const body = r.json();
    expect(body.status).toBe("registered");
    expect(body.name).toBe("Anna Nowak");
    expect(body.class_type).toBe("Body Shape");
  });

  it("returns 400 when name is missing", async () => {
    const app = buildApp();
    const r = await register(app, { name: "" });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 when class_type is missing", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "POST", url: "/registrations",
      payload: { class_date: "2026-06-10", name: "Anna" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("trims whitespace from name", async () => {
    const app = buildApp();
    const r = await register(app, { name: "  Kasia  " });
    expect(r.json().name).toBe("Kasia");
  });

  it("puts 7th person on waitlist for Body Shape (limit 6)", async () => {
    const app = buildApp();
    await fillClass(app, "Body Shape", "2026-06-10", 6);
    const r = await register(app, { name: "Siódma Osoba" });
    expect(r.json().status).toBe("waitlist");
  });

  it("allows 8 registered for Trening Obwodowy (limit 8, not 6)", async () => {
    const app = buildApp();
    await fillClass(app, "Trening Obwodowy", "2026-06-10", 7);
    const eighth = await register(app, { class_type: "Trening Obwodowy", name: "Ósma" });
    expect(eighth.json().status).toBe("registered");

    const ninth = await register(app, { class_type: "Trening Obwodowy", name: "Dziewiąta" });
    expect(ninth.json().status).toBe("waitlist");
  });

  it("unknown class_type defaults to limit 6", async () => {
    const app = buildApp();
    await fillClass(app, "Nowe Zajecia", "2026-06-10", 6);
    const r = await register(app, { class_type: "Nowe Zajecia", name: "Siódma" });
    expect(r.json().status).toBe("waitlist");
  });

  it("registrations for different dates are independent", async () => {
    const app = buildApp();
    await fillClass(app, "Body Shape", "2026-06-10", 6);
    // same class type, different date — should get 'registered', not 'waitlist'
    const r = await register(app, { class_date: "2026-06-17", name: "Nowa" });
    expect(r.json().status).toBe("registered");
  });
});

// ── GET /registrations ───────────────────────────────────────────────
describe("GET /registrations", () => {
  it("returns registrations and limit for a class", async () => {
    const app = buildApp();
    await register(app, { name: "Anna" });
    await register(app, { name: "Basia" });

    const r = await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.limit).toBe(6);
    expect(body.registrations).toHaveLength(2);
  });

  it("returns empty list when no registrations", async () => {
    const app = buildApp();
    const r = await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    });
    expect(r.json().registrations).toHaveLength(0);
  });

  it("returns 400 without query params", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "GET", url: "/registrations" });
    expect(r.statusCode).toBe(400);
  });

  it("orders registered before waitlist", async () => {
    const app = buildApp();
    await fillClass(app, "Body Shape", "2026-06-10", 6);
    await register(app, { name: "Rezerwowa" }); // goes to waitlist

    const r = await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    });
    const list = r.json().registrations as Array<{ status: string; name: string }>;
    const statuses = list.map(x => x.status);
    const lastRegistered = statuses.lastIndexOf("registered");
    const firstWaitlist  = statuses.indexOf("waitlist");
    expect(lastRegistered).toBeLessThan(firstWaitlist);
  });
});

// ── DELETE /registrations/:id ────────────────────────────────────────
describe("DELETE /registrations/:id", () => {
  it("deletes a registration", async () => {
    const app = buildApp();
    const reg = (await register(app)).json();
    const del = await app.inject({ method: "DELETE", url: `/registrations/${reg.id}` });
    expect(del.statusCode).toBe(204);

    const list = (await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    })).json().registrations;
    expect(list).toHaveLength(0);
  });

  it("returns 404 for non-existent id", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "DELETE", url: "/registrations/9999" });
    expect(r.statusCode).toBe(404);
  });

  it("promotes first waitlisted person when a registered spot frees up", async () => {
    const app = buildApp();
    await fillClass(app, "Body Shape", "2026-06-10", 6);
    const waitlisted = (await register(app, { name: "Rezerwowa Kasia" })).json();
    expect(waitlisted.status).toBe("waitlist");

    // Get the first registered person and delete them
    const list = (await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    })).json().registrations as Array<{ id: number; status: string }>;
    const firstRegistered = list.find(r => r.status === "registered")!;
    await app.inject({ method: "DELETE", url: `/registrations/${firstRegistered.id}` });

    // Kasia should now be registered
    const updated = (await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    })).json().registrations as Array<{ id: number; status: string; name: string }>;
    const kasia = updated.find(r => r.name === "Rezerwowa Kasia");
    expect(kasia?.status).toBe("registered");
  });

  it("does NOT promote when there are still enough spots", async () => {
    const app = buildApp();
    await register(app, { name: "Anna" });  // registered, spot 1 of 6
    const r2 = (await register(app, { name: "Basia" })).json(); // spot 2
    await register(app, { name: "Rezerwowa" }); // still registered (3/6)

    // Delete Basia — still 2 registered, well under limit, no waitlist to promote
    await app.inject({ method: "DELETE", url: `/registrations/${r2.id}` });
    const list = (await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    })).json().registrations as Array<{ status: string }>;
    expect(list.every(r => r.status === "registered")).toBe(true);
  });
});

// ── GET /registrations/summary ───────────────────────────────────────
describe("GET /registrations/summary", () => {
  it("returns counts per class and date", async () => {
    const app = buildApp();
    await register(app, { name: "A", class_date: "2026-06-10" });
    await register(app, { name: "B", class_date: "2026-06-10" });
    await register(app, { name: "C", class_date: "2026-06-12", class_type: "WalkCore" });

    const r = await app.inject({ method: "GET", url: "/registrations/summary" });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Array<{ class_type: string; class_date: string; registered: number; waitlist: number }>;
    const bs = body.find(x => x.class_type === "Body Shape" && x.class_date === "2026-06-10");
    expect(bs?.registered).toBe(2);
    expect(bs?.waitlist).toBe(0);
  });

  it("counts waitlist separately from registered", async () => {
    const app = buildApp();
    await fillClass(app, "Body Shape", "2026-06-10", 6); // 6 registered
    await register(app, { name: "W1" }); // waitlist
    await register(app, { name: "W2" }); // waitlist

    const r = await app.inject({
      method: "GET",
      url: "/registrations/summary?date_from=2026-06-10&date_to=2026-06-10",
    });
    const bs = (r.json() as Array<{ registered: number; waitlist: number }>)[0];
    expect(bs.registered).toBe(6);
    expect(bs.waitlist).toBe(2);
  });

  it("filters by date range", async () => {
    const app = buildApp();
    await register(app, { class_date: "2026-06-10" });
    await register(app, { class_date: "2026-06-17" });

    const r = await app.inject({
      method: "GET",
      url: "/registrations/summary?date_from=2026-06-10&date_to=2026-06-10",
    });
    expect((r.json() as unknown[]).length).toBe(1);
  });
});

// ── DELETE /registrations/clear ──────────────────────────────────────
describe("DELETE /registrations/clear", () => {
  it("removes all registrations for a class+date", async () => {
    const app = buildApp();
    await register(app, { name: "A" });
    await register(app, { name: "B" });

    const del = await app.inject({
      method: "DELETE",
      url: "/registrations/clear?class_type=Body%20Shape&class_date=2026-06-10",
    });
    expect(del.statusCode).toBe(204);

    const list = (await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-10",
    })).json().registrations;
    expect(list).toHaveLength(0);
  });

  it("does not affect registrations for other dates", async () => {
    const app = buildApp();
    await register(app, { name: "A", class_date: "2026-06-10" });
    await register(app, { name: "B", class_date: "2026-06-17" });

    await app.inject({
      method: "DELETE",
      url: "/registrations/clear?class_type=Body%20Shape&class_date=2026-06-10",
    });

    const kept = (await app.inject({
      method: "GET", url: "/registrations?class_type=Body%20Shape&class_date=2026-06-17",
    })).json().registrations;
    expect(kept).toHaveLength(1);
    expect(kept[0].name).toBe("B");
  });

  it("returns 400 when params are missing", async () => {
    const app = buildApp();
    const r = await app.inject({ method: "DELETE", url: "/registrations/clear" });
    expect(r.statusCode).toBe(400);
  });
});
