import { scanProfile, type ScanResult } from "./collect.js";
import { analyzeScannedProfile } from "./analyze.js";
import { getDb } from "../db/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("scanner");

export interface FullScanResult {
  scan: ScanResult;
  analysis: { patterns: number };
  durationMs: number;
}

/** Full scan pipeline: fetch tweets → run analysis */
export async function fullScan(handle: string): Promise<FullScanResult> {
  const start = Date.now();

  // Step 1: Collect tweets
  const scanResult = await scanProfile(handle);

  if (scanResult.status === "error" || scanResult.tweetsCollected === 0) {
    return {
      scan: scanResult,
      analysis: { patterns: 0 },
      durationMs: Date.now() - start,
    };
  }

  // Step 2: Run analysis on collected data
  const analysisResult = await analyzeScannedProfile(scanResult.userId);

  const duration = Date.now() - start;
  log.info(`Full scan complete: @${handle}`, {
    tweets: scanResult.tweetsCollected,
    patterns: analysisResult.patterns,
    durationMs: duration,
  });

  return {
    scan: scanResult,
    analysis: analysisResult,
    durationMs: duration,
  };
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

  // Extract key metrics for comparison
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
      topTweets: {
        a: a.topTweets,
        b: b.topTweets,
      },
    },
  };
}
