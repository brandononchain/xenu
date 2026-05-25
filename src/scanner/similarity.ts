import { createLogger } from "../logger.js";
import type Database from "better-sqlite3";

const log = createLogger("scanner:similarity");

export interface SimilarityScore {
  overall: number;  // 0-100
  dimensions: {
    tone: number;
    vocabulary: number;
    structure: number;
    topics: number;
    timing: number;
  };
  insights: string[];
  yourProfile: VoiceSummary;
  theirProfile: VoiceSummary;
}

interface VoiceSummary {
  avgLength: number;
  directness: number;
  technical: number;
  hype: number;
  sarcasm: number;
  emojiRate: number;
  topWords: string[];
  wordsPerTweet: number;
}

export function computeSimilarity(db: Database.Database, targetUserId: string): SimilarityScore | null {
  // Load your voice profile
  const yourVoice = db.prepare("SELECT metric, value FROM voice_profile ORDER BY metric").all() as { metric: string; value: string }[];
  if (yourVoice.length === 0) {
    log.info("No voice profile for your account — run analysis first");
    return null;
  }

  // Load their voice profile
  const theirVoice = db.prepare("SELECT metric, value FROM scanned_voice WHERE user_id = ? ORDER BY metric").all(targetUserId) as { metric: string; value: string }[];
  if (theirVoice.length === 0) {
    log.info("No voice profile for scanned account", { targetUserId });
    return null;
  }

  const yours = parseVoice(yourVoice);
  const theirs = parseVoice(theirVoice);

  if (!yours || !theirs) return null;

  // ── 1. Tone similarity (directness, technical, hype, sarcasm) ──
  const toneSim = 100 - (
    Math.abs(yours.directness - theirs.directness) * 0.3 +
    Math.abs(yours.technical - theirs.technical) * 0.3 +
    Math.abs(yours.hype - theirs.hype) * 0.2 +
    Math.abs(yours.sarcasm - theirs.sarcasm) * 0.2
  );

  // ── 2. Vocabulary similarity (shared top words) ──
  const yourWords = new Set(yours.topWords);
  const theirWords = new Set(theirs.topWords);
  const sharedWords = [...yourWords].filter(w => theirWords.has(w));
  const vocabSim = yourWords.size > 0 && theirWords.size > 0
    ? Math.round((sharedWords.length / Math.max(yourWords.size, theirWords.size)) * 100)
    : 0;

  // ── 3. Structure similarity (length, words per tweet, emoji rate) ──
  const lenDiff = Math.abs(yours.avgLength - theirs.avgLength) / Math.max(yours.avgLength, theirs.avgLength, 1);
  const wptDiff = Math.abs(yours.wordsPerTweet - theirs.wordsPerTweet) / Math.max(yours.wordsPerTweet, theirs.wordsPerTweet, 1);
  const emojiDiff = Math.abs(yours.emojiRate - theirs.emojiRate);
  const structSim = Math.round((1 - (lenDiff * 0.4 + wptDiff * 0.3 + emojiDiff / 100 * 0.3)) * 100);

  // ── 4. Topic similarity (compare posting time patterns as proxy) ──
  // If we have topic data, use it; otherwise compare hashtag overlap
  const yourHashtags = getTopHashtags(db, "patterns");
  const theirHashtags = getTopHashtags(db, "scanned_patterns", targetUserId);
  const yourTagSet = new Set(yourHashtags);
  const theirTagSet = new Set(theirHashtags);
  const sharedTags = [...yourTagSet].filter(t => theirTagSet.has(t));
  const topicSim = yourTagSet.size > 0 && theirTagSet.size > 0
    ? Math.round((sharedTags.length / Math.max(yourTagSet.size, theirTagSet.size)) * 100)
    : 50; // Default middle if no hashtag data

  // ── 5. Timing similarity (posting hour overlap) ──
  const yourHours = getPeakHours(db, "patterns");
  const theirHours = getPeakHours(db, "scanned_patterns", targetUserId);
  const yourHourSet = new Set(yourHours);
  const timingSim = yourHours.length > 0 && theirHours.length > 0
    ? Math.round((theirHours.filter(h => yourHourSet.has(h)).length / Math.max(yourHours.length, theirHours.length)) * 100)
    : 50;

  // ── Overall weighted score ──
  const overall = Math.round(
    toneSim * 0.30 +
    vocabSim * 0.25 +
    structSim * 0.20 +
    topicSim * 0.15 +
    timingSim * 0.10
  );

  // ── Generate insights ──
  const insights: string[] = [];

  if (toneSim > 75) insights.push("Very similar tone and communication style");
  else if (toneSim < 40) insights.push("Different communication styles — could complement each other");

  if (vocabSim > 50) insights.push(`${sharedWords.length} shared vocabulary terms: ${sharedWords.slice(0, 5).join(", ")}`);
  else if (vocabSim < 20) insights.push("Very different vocabulary — different knowledge domains");

  if (sharedTags.length > 0) insights.push(`Shared hashtags: ${sharedTags.slice(0, 5).map(t => "#" + t).join(", ")}`);

  if (Math.abs(yours.directness - theirs.directness) < 15) insights.push("Similar directness levels");
  if (Math.abs(yours.technical - theirs.technical) < 15) insights.push("Similar technical depth");

  if (theirs.hype > yours.hype + 30) insights.push("They use significantly more hype language");
  if (yours.hype > theirs.hype + 30) insights.push("You use significantly more hype language");

  if (timingSim > 60) insights.push("Active during similar hours — likely same timezone audience");

  log.info("Similarity computed", { targetUserId, overall, tone: toneSim, vocab: vocabSim });

  return {
    overall: Math.max(0, Math.min(100, overall)),
    dimensions: {
      tone: Math.max(0, Math.min(100, Math.round(toneSim))),
      vocabulary: Math.max(0, Math.min(100, vocabSim)),
      structure: Math.max(0, Math.min(100, structSim)),
      topics: Math.max(0, Math.min(100, topicSim)),
      timing: Math.max(0, Math.min(100, timingSim)),
    },
    insights,
    yourProfile: yours,
    theirProfile: theirs,
  };
}

function parseVoice(rows: { metric: string; value: string }[]): VoiceSummary | null {
  const map = new Map<string, any>();
  for (const r of rows) {
    try { map.set(r.metric, JSON.parse(r.value)); } catch { continue; }
  }

  const tone = map.get("tone") || {};
  const vocab = map.get("vocabulary") || {};
  const avgLen = map.get("avg_length") || {};
  const emoji = map.get("emoji_rate") || {};

  return {
    avgLength: avgLen.average || 0,
    directness: tone.directness || tone.direct * 100 || 50,
    technical: tone.technical || 0,
    hype: tone.hype || 0,
    sarcasm: tone.sarcasm || 0,
    emojiRate: emoji.pctWithEmoji || 0,
    topWords: (vocab.topWords || []).slice(0, 20).map((w: any) => typeof w === "string" ? w : w.word),
    wordsPerTweet: vocab.avgWordsPerTweet || 0,
  };
}

function getTopHashtags(db: Database.Database, table: string, userId?: string): string[] {
  try {
    let row;
    if (userId) {
      row = db.prepare(`SELECT pattern_value FROM ${table} WHERE user_id = ? AND pattern_type = 'hashtag' AND pattern_key = 'frequency'`).get(userId) as any;
    } else {
      row = db.prepare(`SELECT pattern_value FROM ${table} WHERE pattern_type = 'hashtag' AND pattern_key = 'frequency'`).get() as any;
    }
    if (!row) return [];
    const tags = JSON.parse(row.pattern_value);
    return tags.slice(0, 15).map((t: any) => t.tag.toLowerCase());
  } catch { return []; }
}

function getPeakHours(db: Database.Database, table: string, userId?: string): number[] {
  try {
    let row;
    if (userId) {
      row = db.prepare(`SELECT pattern_value FROM ${table} WHERE user_id = ? AND pattern_type = 'posting_time' AND pattern_key = 'peak_hours'`).get(userId) as any;
    } else {
      row = db.prepare(`SELECT pattern_value FROM ${table} WHERE pattern_type = 'posting_time' AND pattern_key = 'peak_hours'`).get() as any;
    }
    if (!row) return [];
    return JSON.parse(row.pattern_value).map((h: any) => h.hour);
  } catch { return []; }
}
