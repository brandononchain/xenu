import { getDb, closeDb } from "./index.js";
import { createLogger } from "../logger.js";

const log = createLogger("db:init");

log.info("Initializing database...");
const db = getDb();

// Verify tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
log.info("Tables created", { count: tables.length, tables: tables.map(t => t.name) });

closeDb();
log.info("Database initialization complete");
