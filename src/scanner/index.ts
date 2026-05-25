import { scanProfile, type ScanResult } from "./collect.js";
import { analyzeScannedProfile } from "./analyze.js";
import { analyzeThreads, type ThreadAnalysis } from "./threads.js";
import { analyzeTopics, type TopicAnalysis } from "./topics.js";
import { analyzeFollowerOverlap, type OverlapAnalysis } from "./overlap.js";
import { computeSimilarity, type SimilarityScore } from "./similarity.js";
import { analyzeVelocity, type VelocityAnalysis } from "./velocity.js";
import { analyzeOptimalTiming, type TimingAnalysis } from "./timing.js";
import { getDb } from "../db/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("scanner");

export interface FullScanResult {
  scan: ScanResult;
  analysis: { patterns: number };
  threads: ThreadAnalysis | null;
  topics: TopicAnalysis | null;
  velocity: VelocityAnalysis | null;
  timing: TimingAnalysis | null;
  durationMs: number;
}

/** Full scan pipeline: fetch tweets → run all analysis */
export async function fullScan(handle: string): Promise<FullScanResult> {
  const start = Date.now();

  // Step 1: Collect tweets
  const scanResult = await scanProfile(handle);

  if (scanResult.status === "error" || scanResult.tweetsCollected === 0) {
    return {
      scan: scanResult,
      analysis: { patterns: 0 },
      threads: null,
      topics: null,
      velocity: null,
      timing: null,
      durationMs: Date.now() - start,
    };
  }

  const db = getDb();
  const userId = scanResult.userId;

  // Step 2: Run core pattern analysis
  const analysisResult = await analyzeScannedProfile(userId);

  // Step 3: Thread detection
  let threadResult: ThreadAnalysis | null = null;
  try {
    threadResult = analyzeThreads(db, userId);
    if (threadResult) {
      savePattern(db, userId, "threads", "analysis", threadResult, 0.85, threadResult.threadCount + threadResult.singleCount);
    }
  } catch (err) {
    log.error("Thread analysis failed", { error: String(err) });
  }

  // Step 4: Topic clustering (requires Claude API)
  let topicResult: TopicAnalysis | null = null;
  try {
    topicResult = await analyzeTopics(db, userId);
    if (topicResult) {
      savePattern(db, userId, "topics", "distribution", topicResult.distribution, 0.8, topicResult.totalClassified);
      savePattern(db, userId, "topics", "performance", topicResult.topicPerformance, 0.8, topicResult.totalClassified);
      savePattern(db, userId, "topics", "crossover", topicResult.crossoverTopics, 0.75, topicResult.totalClassified);
    }
  } catch (err) {
    log.error("Topic analysis failed", { error: String(err) });
  }

  // Step 5: Engagement velocity
  let velocityResult: VelocityAnalysis | null = null;
  try {
    velocityResult = analyzeVelocity(db, userId);
    if (velocityResult) {
      savePattern(db, userId, "velocity", "analysis", velocityResult, 0.85, velocityResult.weeklyEngagement.length);
    }
  } catch (err) {
    log.error("Velocity analysis failed", { error: String(err) });
  }

  // Step 6: Optimal posting windows
  let timingResult: TimingAnalysis | null = null;
  try {
    timingResult = analyzeOptimalTiming(db, userId);
    if (timingResult) {
      savePattern(db, userId, "timing", "analysis", timingResult, 0.8, tweets_count(db, userId));
    }
  } catch (err) {
    log.error("Timing analysis failed", { error: String(err) });
  }

  const duration = Date.now() - start;
  log.info(`Full scan complete: @${handle}`, {
    tweets: scanResult.tweetsCollected,
    patterns: analysisResult.patterns,
    threads: threadResult?.threadCount || 0,
    topics: topicResult?.totalClassified || 0,
    velocity: velocityResult?.trend || "n/a",
    timing: timingResult?.bestWindows?.length || 0,
    durationMs: duration,
  });

  return {
    scan: scanResult,
    analysis: analysisResult,
    threads: threadResult,
    topics: topicResult,
    velocity: velocityResult,
    timing: timingResult,
    durationMs: duration,
  };
}

function tweets_count(db: any, userId: string): number {
  return (db.prepare("SELECT COUNT(*) as c FROM scanned_tweets WHERE user_id = ?").get(userId) as any)?.c || 0;
}

/** Run follower overlap analysis (separate call — costs extra API reads) */
export async function runOverlapAnalysis(targetUserId: string): Promise<OverlapAnalysis | null> {
  const db = getDb();
  const result = await analyzeFollowerOverlap(db, targetUserId);
  if (result) {
    savePattern(db, targetUserId, "overlap", "analysis", result, 0.7, result.yourFollowersSampled);
  }
  return result;
}

/** Run content similarity scoring */
export function runSimilarityAnalysis(targetUserId: string): SimilarityScore | null {
  const db = getDb();
  const result = computeSimilarity(db, targetUserId);
  if (result) {
    savePattern(db, targetUserId, "similarity", "score", result, 0.8, 1);
  }
  return result;
}

/** Get all scanned profiles */
export function getScannedProfiles() {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM scanned_profiles ORDER BY last_scanned DESC"
  ).all();
}

/** Get scan results for a specific profile */
export function getScanResults(userId: string) {
  const db = getDb();

  const profile = db.prepare(
    "SELECT * FROM scanned_profiles WHERE user_id = ?"
  ).get(userId);

  const patterns = db.prepare(
    "SELECT * FROM scanned_patterns WHERE user_id = ? ORDER BY pattern_type, pattern_key"
  ).all(userId) as any[];

  const voice = db.prepare(
    "SELECT * FROM scanned_voice WHERE user_id = ? ORDER BY metric"
  ).all(userId) as any[];

  const tweetCount = (db.prepare(
    "SELECT COUNT(*) as c FROM scanned_tweets WHERE user_id = ?"
  ).get(userId) as any)?.c || 0;

  const topTweets = db.prepare(
    "SELECT * FROM scanned_tweets WHERE user_id = ? AND tweet_type != 'retweet' ORDER BY likes DESC LIMIT 5"
  ).all(userId);

  return {
    profile,
    patterns: patterns.map(p => ({ ...p, pattern_value: JSON.parse(p.pattern_value) })),
    voice: voice.map(v => ({ ...v, value: JSON.parse(v.value) })),
    tweetCount,
    topTweets,
  };
}

/** Get scan results by handle */
export function getScanResultsByHandle(handle: string) {
  const db = getDb();
  const clean = handle.replace(/^@/, "").toLowerCase();
  const profile = db.prepare(
    "SELECT * FROM scanned_profiles WHERE LOWER(handle) = ?"
  ).get(clean) as any;
  if (!profile) return null;
  return getScanResults(profile.user_id);
}

/** Delete a scanned profile and all associated data */
export function deleteScan(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM scanned_tweets WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM scanned_patterns WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM scanned_voice WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM scanned_profiles WHERE user_id = ?").run(userId);
  log.info("Deleted scan data", { userId });
}

/** Compare two scanned profiles */
export function compareProfiles(userIdA: string, userIdB: string) {
  const a = getScanResults(userIdA);
  const b = getScanResults(userIdB);

  if (!a.profile || !b.profile) return null;

  const getMetric = (results: typeof a, patternType: string, patternKey: string) => {
    return results.patterns.find(p => p.pattern_type === patternType && p.pattern_key === patternKey)?.pattern_value;
  };

  const getVoice = (results: typeof a, metric: string) => {
    return results.voice.find(v => v.metric === metric)?.value;
  };

  return {
    profiles: { a: a.profile, b: b.profile },
    comparison: {
      tweetCounts: { a: a.tweetCount, b: b.tweetCount },
      engagementSummary: {
        a: getMetric(a, "content_perf", "summary"),
        b: getMetric(b, "content_perf", "summary"),
      },
      contentTypes: {
        a: getMetric(a, "content_type", "performance"),
        b: getMetric(b, "content_type", "performance"),
      },
      tone: {
        a: getVoice(a, "tone"),
        b: getVoice(b, "tone"),
      },
      vocabulary: {
        a: getVoice(a, "vocabulary"),
        b: getVoice(b, "vocabulary"),
      },
      threads: {
        a: getMetric(a, "threads", "analysis"),
        b: getMetric(b, "threads", "analysis"),
      },
      topics: {
        a: getMetric(a, "topics", "distribution"),
        b: getMetric(b, "topics", "distribution"),
      },
      topTweets: {
        a: a.topTweets,
        b: b.topTweets,
      },
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────

function savePattern(db: any, userId: string, type: string, key: string, value: unknown, confidence: number, sampleSize: number) {
  db.prepare(`
    INSERT INTO scanned_patterns (user_id, pattern_type, pattern_key, pattern_value, confidence, sample_size, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, pattern_type, pattern_key) DO UPDATE SET
      pattern_value = excluded.pattern_value,
      confidence = excluded.confidence,
      sample_size = excluded.sample_size,
      computed_at = datetime('now')
  `).run(userId, type, key, JSON.stringify(value), confidence, sampleSize);
}
