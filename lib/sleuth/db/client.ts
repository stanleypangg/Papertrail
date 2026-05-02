import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DEFAULT_DB_PATH = "sleuth.db";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${schema.SLEUTH_WORLDS_TABLE} (
  script_id TEXT PRIMARY KEY,
  operation_id TEXT,
  splat_url TEXT,
  status TEXT,
  world_prompt_json TEXT,
  created_at INTEGER,
  expires_at INTEGER
)
`;

type SleuthDb = BetterSQLite3Database<typeof schema>;

let cachedSqlite: Database.Database | null = null;
let cachedDb: SleuthDb | null = null;
let cachedPath: string | null = null;

function resolveDbPath(): string {
  const fromEnv = process.env.SLEUTH_DB_PATH;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_DB_PATH;
}

function ensureSchema(sqlite: Database.Database): void {
  const runDdl = sqlite.exec.bind(sqlite);
  runDdl(CREATE_TABLE_SQL);
}

export function getDb(): SleuthDb {
  const path = resolveDbPath();
  if (cachedDb && cachedPath === path) {
    return cachedDb;
  }
  if (cachedSqlite) {
    try {
      cachedSqlite.close();
    } catch {
      // best-effort close; the new handle below replaces it regardless.
    }
  }
  const sqlite = new Database(path);
  try {
    sqlite.pragma("journal_mode = WAL");
  } catch {
    // :memory: rejects WAL; the test suite relies on that, so ignore.
  }
  ensureSchema(sqlite);
  cachedSqlite = sqlite;
  cachedPath = path;
  cachedDb = drizzle(sqlite, { schema });
  return cachedDb;
}

export function resetDb(): void {
  if (cachedSqlite) {
    try {
      cachedSqlite.close();
    } catch {
      // ignored — we are discarding the handle anyway.
    }
  }
  cachedSqlite = null;
  cachedDb = null;
  cachedPath = null;
}
