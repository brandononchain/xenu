import { logCollectorStart, logCollectorEnd } from "../db/index.js";
import { createLogger } from "../logger.js";

export abstract class BaseCollector {
  protected log;
  abstract name: string;

  constructor() {
    this.log = createLogger(`collector:${this.constructor.name}`);
  }

  async run(): Promise<{ collected: number; errors: string[] }> {
    const runId = logCollectorStart(this.name);
    const startTime = Date.now();
    const errors: string[] = [];
    let collected = 0;

    try {
      this.log.info(`Starting collection: ${this.name}`);
      collected = await this.collect();
      const duration = Date.now() - startTime;
      logCollectorEnd(runId, errors.length > 0 ? "partial" : "success", collected, duration);
      this.log.info(`Collection complete: ${this.name}`, { collected, durationMs: duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      logCollectorEnd(runId, "error", collected, duration, errMsg);
      this.log.error(`Collection failed: ${this.name}`, { error: errMsg, durationMs: duration });
    }

    return { collected, errors };
  }

  protected abstract collect(): Promise<number>;
}
