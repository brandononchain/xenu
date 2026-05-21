import { runCollector, collectors } from "./index.js";
import { closeDb } from "../db/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("run-single");

const name = process.argv[2];

if (!name || !collectors[name]) {
  console.error(`Usage: tsx src/collectors/run-single.ts <collector>`);
  console.error(`Available: ${Object.keys(collectors).join(", ")}`);
  process.exit(1);
}

try {
  const result = await runCollector(name);
  log.info(`Collector ${name} finished`, result);
} catch (err) {
  log.error(`Collector ${name} failed`, { error: String(err) });
  process.exit(1);
} finally {
  closeDb();
}
