import { existsSync, unlinkSync } from "fs";
import { config } from "../config.js";
import { getDb, closeDb } from "./index.js";
import { createLogger } from "../logger.js";

const log = createLogger("db:reset");

const dbPath = config.db.path;

if (existsSync(dbPath)) {
  log.warn("Deleting existing database", { path: dbPath });
  unlinkSync(dbPath);
  if (existsSync(dbPath + "-wal")) unlinkSync(dbPath + "-wal");
  if (existsSync(dbPath + "-shm")) unlinkSync(dbPath + "-shm");
}

log.info("Re-initializing database...");
getDb();
closeDb();
log.info("Database reset complete");
