import { runAllCollectors } from "./collectors/index.js";
import { closeDb } from "./db/index.js";
import { createLogger } from "./logger.js";

const log = createLogger("run-collectors");

log.info("═══ Xenu Collection Cycle Starting ═══");

try {
  const results = await runAllCollectors();

  let totalCollected = 0;
  let totalErrors = 0;

  for (const [name, result] of Object.entries(results)) {
    totalCollected += result.collected;
    totalErrors += result.errors.length;
    const status = result.errors.length > 0 ? "⚠" : "✓";
    log.info(`  ${status} ${name}: ${result.collected} records`, {
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  }

  log.info("═══ Collection Cycle Complete ═══", { totalCollected, totalErrors });
} catch (err) {
  log.error("Collection cycle failed", { error: String(err) });
  process.exit(1);
} finally {
  closeDb();
}
