import Database from "better-sqlite3";
import { getDb } from "../db/index.js";
import { createLogger } from "../logger.js";

export abstract class BaseAnalyzer {
  protected log;
  protected db: Database.Database;
  abstract name: string;

  constructor() {
    this.log = createLogger(`analysis:${this.constructor.name}`);
    this.db = getDb();
  }

  async run(): Promise<{ patterns: number }> {
    const start = Date.now();
    this.log.info(`Starting analysis: ${this.name}`);

    try {
      const patterns = await this.analyze();
      const duration = Date.now() - start;
      this.log.info(`Analysis complete: ${this.name}`, { patterns, durationMs: duration });
      return { patterns };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log.error(`Analysis failed: ${this.name}`, { error: errMsg });
      return { patterns: 0 };
    }
  }

  protected abstract analyze(): Promise<number>;

  /** Upsert a pattern into the patterns table */
  protected savePattern(type: string, key: string, value: unknown, confidence: number, sampleSize: number) {
    this.db.prepare(`
      INSERT INTO patterns (pattern_type, pattern_key, pattern_value, confidence, sample_size, computed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(pattern_type, pattern_key) DO UPDATE SET
        pattern_value = excluded.pattern_value,
        confidence = excluded.confidence,
        sample_size = excluded.sample_size,
        computed_at = datetime('now')
    `).run(type, key, JSON.stringify(value), confidence, sampleSize);
  }

  /** Upsert a voice profile metric */
  protected saveVoiceMetric(metric: string, value: unknown) {
    this.db.prepare(`
      INSERT INTO voice_profile (metric, value, computed_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(metric) DO UPDATE SET
        value = excluded.value,
        computed_at = datetime('now')
    `).run(metric, JSON.stringify(value));
  }
}
