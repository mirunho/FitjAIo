import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "fitjaio.db");

// Ensure the directory exists (needed when DB_PATH=/data/fitjaio.db and /data is a Railway volume)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

export function resetDb(db: Database.Database) {
  _db = db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '',
      class_type TEXT NOT NULL,
      exercises TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      participants INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT DEFAULT '',
      goals TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personal_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      exercises TEXT DEFAULT '',
      trainer_notes TEXT DEFAULT '',
      progress_notes TEXT DEFAULT '',
      muscle_groups TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
