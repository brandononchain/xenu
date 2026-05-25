import { getDb } from "../db/index.js";
import { createLogger } from "../logger.js";
import { fullScan } from "./index.js";
import crypto from "crypto";

const log = createLogger("scanner:watch");

type Interval = "daily" | "weekly" | "biweekly" | "monthly";

const INTERVAL_DAYS: Record<Interval, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

// ─── Watch List Management ──────────────────────────────

export function addToWatchList(handle: string, userId: string, interval: Interval = "weekly") {
  const db = getDb();
  const nextScan = computeNextScan(interval);

  db.prepare(`
    INSERT INTO watch_list (user_id, handle, interval, enabled, last_scan, next_scan)
    VALUES (?, ?, ?, 1, datetime('now'), ?)
    ON CONFLICT(user_id) DO UPDATE SET
      interval = excluded.interval,
      enabled = 1,
      next_scan = excluded.next_scan
  `).run(userId, handle.replace(/^@/, ""), interval, nextScan);

  log.info("Added to watch list", { handle, userId, interval, nextScan });
}

export function removeFromWatchList(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM watch_list WHERE user_id = ?").run(userId);
  log.info("Removed from watch list", { userId });
}

export function getWatchList() {
  const db = getDb();
  return db.prepare(`
    SELECT w.*, sp.name, sp.followers, sp.last_scanned as profile_last_scanned
    FROM watch_list w
    LEFT JOIN scanned_profiles sp ON w.user_id = sp.user_id
    ORDER BY w.next_scan ASC
  `).all();
}

export function updateWatchInterval(userId: string, interval: Interval) {
  const db = getDb();
  const nextScan = computeNextScan(interval);
  db.prepare("UPDATE watch_list SET interval = ?, next_scan = ? WHERE user_id = ?").run(interval, nextScan, userId);
}

export function toggleWatch(userId: string, enabled: boolean) {
  const db = getDb();
  db.prepare("UPDATE watch_list SET enabled = ? WHERE user_id = ?").run(enabled ? 1 : 0, userId);
}

// ─── Rescan Engine ──────────────────────────────────────

export async function processWatchList(): Promise<{ scanned: number; errors: number }> {
  const db = getDb();
  const now = new Date().toISOString();

  const due = db.prepare(`
    SELECT user_id, handle, interval FROM watch_list
    WHERE enabled = 1 AND next_scan <= ?
    ORDER BY next_scan ASC
  `).all(now) as { user_id: string; handle: string; interval: Interval }[];

  if (due.length === 0) {
    log.info("No watch list profiles due for rescan");
    return { scanned: 0, errors: 0 };
  }

  log.info(`${due.length} profiles due for rescan`);

  let scanned = 0;
  let errors = 0;

  for (const entry of due) {
    try {
      // Snapshot current state before rescan
      const beforeState = snapshotProfileState(db, entry.user_id);

      // Run full scan
      const result = await fullScan(entry.handle);

      if (result.scan.status === "complete") {
        // Compute deltas
        if (beforeState) {
          const afterState = snapshotProfileState(db, entry.user_id);
          if (afterState) {
            computeDeltas(db, entry.user_id, beforeState, afterState);
          }
        }

        // Update watch list timing
        const nextScan = computeNextScan(entry.interval);
        db.prepare("UPDATE watch_list SET last_scan = datetime('now'), next_scan = ? WHERE user_id = ?")
          .run(nextScan, entry.user_id);

        scanned++;
      } else {
        errors++;
      }

      // Rate limit between scans
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      log.error("Watch rescan failed", { handle: entry.handle, error: String(err) });
      errors++;
    }
  }

  log.info("Watch list processing complete", { scanned, errors });
  return { scanned, errors };
}

// ─── Batch Scan ─────────────────────────────────────────

export async function startBatchScan(handles: string[]): Promise<string> {
  const db = getDb();
  const jobId = crypto.randomUUID().split("-")[0];

  db.prepare(`
    INSERT INTO batch_jobs (id, handles, status, total) VALUES (?, ?, 'pending', ?)
  `).run(jobId, JSON.stringify(handles), handles.length);

  // Process async (don't await — return immediately)
  processBatchJob(jobId, handles).catch(err => {
    log.error("Batch job failed", { jobId, error: String(err) });
    db.prepare("UPDATE batch_jobs SET status = 'error' WHERE id = ?").run(jobId);
  });

  return jobId;
}

async function processBatchJob(jobId: string, handles: string[]) {
  const db = getDb();
  db.prepare("UPDATE batch_jobs SET status = 'running' WHERE id = ?").run(jobId);

  const results: { handle: string; status: string; tweetsCollected: number; error?: string }[] = [];
  let completed = 0;
  let failed = 0;

  for (const handle of handles) {
    try {
      const result = await fullScan(handle);
      results.push({
        handle,
        status: result.scan.status,
        tweetsCollected: result.scan.tweetsCollected,
        error: result.scan.error,
      });

      if (result.scan.status === "complete") completed++;
      else failed++;
    } catch (err) {
      results.push({ handle, status: "error", tweetsCollected: 0, error: String(err) });
      failed++;
    }

    // Update progress
    db.prepare("UPDATE batch_jobs SET completed = ?, failed = ?, results = ? WHERE id = ?")
      .run(completed, failed, JSON.stringify(results), jobId);

    // Rate limit: 5s between scans
    await new Promise(r => setTimeout(r, 5000));
  }

  db.prepare("UPDATE batch_jobs SET status = 'complete', completed = ?, failed = ?, results = ?, finished_at = datetime('now') WHERE id = ?")
    .run(completed, failed, JSON.stringify(results), jobId);

  log.info("Batch job complete", { jobId, completed, failed, total: handles.length });
}

export function getBatchJobStatus(jobId: string) {
  const db = getDb();
  const job = db.prepare("SELECT * FROM batch_jobs WHERE id = ?").get(jobId) as any;
  if (!job) return null;
  return {
    ...job,
    handles: JSON.parse(job.handles),
    results: job.results ? JSON.parse(job.results) : [],
  };
}

export function listBatchJobs() {
  const db = getDb();
  const jobs = db.prepare("SELECT id, status, total, completed, failed, created_at, finished_at FROM batch_jobs ORDER BY created_at DESC LIMIT 20").all();
  return jobs;
}

// ─── Change Detection ───────────────────────────────────

interface ProfileSnapshot {
  followers: number;
  following: number;
  engRate: number;
  avgLikes: number;
  velocity: string;
  topTopics: string[];
  directness: number;
  technical: number;
}

function snapshotProfileState(db: any, userId: string): ProfileSnapshot | null {
  const profile = db.prepare("SELECT followers, following FROM scanned_profiles WHERE user_id = ?").get(userId) as any;
  if (!profile) return null;

  const engSummary = db.prepare(
    "SELECT pattern_value FROM scanned_patterns WHERE user_id = ? AND pattern_type = 'content_perf' AND pattern_key = 'summary'"
  ).get(userId) as any;

  const velocityPattern = db.prepare(
    "SELECT pattern_value FROM scanned_patterns WHERE user_id = ? AND pattern_type = 'velocity' AND pattern_key = 'analysis'"
  ).get(userId) as any;

  const topicPattern = db.prepare(
    "SELECT pattern_value FROM scanned_patterns WHERE user_id = ? AND pattern_type = 'topics' AND pattern_key = 'distribution'"
  ).get(userId) as any;

  const toneMetric = db.prepare(
    "SELECT value FROM scanned_voice WHERE user_id = ? AND metric = 'tone'"
  ).get(userId) as any;

  let eng: any = {};
  if (engSummary) try { eng = JSON.parse(engSummary.pattern_value); } catch {}

  let vel = "";
  if (velocityPattern) try { vel = JSON.parse(velocityPattern.pattern_value)?.trend || ""; } catch {}

  let topics: string[] = [];
  if (topicPattern) try { topics = JSON.parse(topicPattern.pattern_value).slice(0, 3).map((t: any) => t.topic); } catch {}

  let tone: any = {};
  if (toneMetric) try { tone = JSON.parse(toneMetric.value); } catch {}

  return {
    followers: profile.followers,
    following: profile.following,
    engRate: eng.overallEngRate || 0,
    avgLikes: eng.avgLikes || 0,
    velocity: vel,
    topTopics: topics,
    directness: tone.directness || 0,
    technical: tone.technical || 0,
  };
}

function computeDeltas(db: any, userId: string, before: ProfileSnapshot, after: ProfileSnapshot) {
  const today = new Date().toISOString().split("T")[0];

  const insertDelta = db.prepare(`
    INSERT INTO scan_deltas (user_id, scan_date, delta_type, previous_value, current_value, change_pct)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Follower delta
  if (before.followers > 0) {
    const changePct = Math.round(((after.followers - before.followers) / before.followers) * 10000) / 100;
    insertDelta.run(userId, today, "followers",
      JSON.stringify({ followers: before.followers, following: before.following }),
      JSON.stringify({ followers: after.followers, following: after.following }),
      changePct
    );
  }

  // Engagement delta
  if (before.engRate > 0) {
    const changePct = Math.round(((after.engRate - before.engRate) / before.engRate) * 10000) / 100;
    insertDelta.run(userId, today, "engagement",
      JSON.stringify({ engRate: before.engRate, avgLikes: before.avgLikes }),
      JSON.stringify({ engRate: after.engRate, avgLikes: after.avgLikes }),
      changePct
    );
  }

  // Velocity change
  if (before.velocity && after.velocity && before.velocity !== after.velocity) {
    insertDelta.run(userId, today, "velocity",
      JSON.stringify({ trend: before.velocity }),
      JSON.stringify({ trend: after.velocity }),
      0
    );
  }

  // Topic shifts
  const newTopics = after.topTopics.filter(t => !before.topTopics.includes(t));
  const droppedTopics = before.topTopics.filter(t => !after.topTopics.includes(t));
  if (newTopics.length > 0 || droppedTopics.length > 0) {
    insertDelta.run(userId, today, "topics",
      JSON.stringify(before.topTopics),
      JSON.stringify(after.topTopics),
      0
    );
  }

  log.info("Deltas computed", {
    userId,
    followerChange: after.followers - before.followers,
    engChange: Math.round((after.engRate - before.engRate) * 100) / 100,
    newTopics,
    droppedTopics,
  });
}

export function getDeltas(userId: string, limit = 30) {
  const db = getDb();
  const deltas = db.prepare(
    "SELECT * FROM scan_deltas WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(userId, limit) as any[];

  return deltas.map(d => ({
    ...d,
    previous_value: JSON.parse(d.previous_value),
    current_value: JSON.parse(d.current_value),
  }));
}

// ─── Helpers ────────────────────────────────────────────

function computeNextScan(interval: Interval): string {
  const days = INTERVAL_DAYS[interval];
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
}
