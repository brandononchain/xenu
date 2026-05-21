import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";
import { SCHEMA } from "./schema.js";
import { createLogger } from "../logger.js";

const log = createLogger("db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = config.db.path;
  mkdirSync(dirname(dbPath), { recursive: true });

  _db = new Database(dbPath);

  // Performance pragmas
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("cache_size = -64000"); // 64MB cache

  // Initialize schema
  _db.exec(SCHEMA);

  log.info("Database initialized", { path: dbPath });
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
    log.info("Database closed");
  }
}

// ─── Collector run logging ───────────────────────────────

export function logCollectorStart(collector: string): number {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO collector_runs (collector, status, started_at) VALUES (?, 'running', datetime('now'))`
  ).run(collector);
  return Number(result.lastInsertRowid);
}

export function logCollectorEnd(
  runId: number,
  status: "success" | "error" | "partial",
  recordsCollected: number,
  durationMs: number,
  errorMessage?: string
) {
  const db = getDb();
  db.prepare(
    `UPDATE collector_runs SET status = ?, records_collected = ?, duration_ms = ?, error_message = ?, finished_at = datetime('now') WHERE id = ?`
  ).run(status, recordsCollected, durationMs, errorMessage || null, runId);
}

// ─── Token storage ──────────────────────────────────────

export function saveTokens(accessToken: string, refreshToken: string, expiresAt: number, scope?: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at, scope, updated_at)
    VALUES (1, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      updated_at = datetime('now')
  `).run(accessToken, refreshToken, expiresAt, scope || null);
}

export function loadTokens(): { accessToken: string; refreshToken: string; expiresAt: number } | null {
  const db = getDb();
  const row = db.prepare("SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE id = 1").get() as any;
  if (!row) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  };
}
