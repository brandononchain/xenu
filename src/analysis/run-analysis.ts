import { runAllAnalyzers } from "./index.js";
import { closeDb } from "../db/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("run-analysis");

log.info("═══ Xenu Analysis Engine Starting ═══");

try {
  const results = await runAllAnalyzers();

  let totalPatterns = 0;
  for (const [name, result] of Object.entries(results)) {
    totalPatterns += result.patterns;
    log.info(`  ✓ ${name}: ${result.patterns} patterns computed`);
  }

  log.info("═══ Analysis Complete ═══", { totalPatterns });
} catch (err) {
  log.error("Analysis failed", { error: String(err) });
  process.exit(1);
} finally {
  closeDb();
}
