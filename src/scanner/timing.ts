import { createLogger } from "../logger.js";
import type Database from "better-sqlite3";

const log = createLogger("scanner:timing");

export interface TimingAnalysis {
  hourlyPerformance: {
    hour: number;
    tweetCount: number;
    avgLikes: number;
    avgImpressions: number;
    engRate: number;
    score: number;
  }[];
  dailyPerformance: {
    day: string;
    dayIndex: number;
    tweetCount: number;
    avgLikes: number;
    engRate: number;
    score: number;
  }[];
  bestWindows: {
    day: string;
    hour: number;
    score: number;
    avgLikes: number;
    tweetCount: number;
    localHour: number;
  }[];
  worstWindows: {
    day: string;
    hour: number;
    score: number;
    avgLikes: number;
  }[];
  inferredTimezone: {
    utcOffset: number;
    label: string;
    confidence: number;
  };
  recommendations: string[];
}

interface TweetRow {
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONE_MAP: Record<number, string> = {
  "-12": "UTC-12 (Baker Island)",
  "-11": "UTC-11 (Samoa)",
  "-10": "UTC-10 (Hawaii)",
  "-9": "UTC-9 (Alaska)",
  "-8": "UTC-8 (PST)",
  "-7": "UTC-7 (MST)",
  "-6": "UTC-6 (CST)",
  "-5": "UTC-5 (EST)",
  "-4": "UTC-4 (AST)",
  "-3": "UTC-3 (Brazil)",
  "-2": "UTC-2",
  "-1": "UTC-1 (Azores)",
  "0": "UTC+0 (GMT)",
  "1": "UTC+1 (CET)",
  "2": "UTC+2 (EET)",
  "3": "UTC+3 (Moscow)",
  "4": "UTC+4 (Dubai)",
  "5": "UTC+5 (Pakistan)",
  "5.5": "UTC+5:30 (India)",
  "6": "UTC+6 (Bangladesh)",
  "7": "UTC+7 (Bangkok)",
  "8": "UTC+8 (Singapore)",
  "9": "UTC+9 (Tokyo)",
  "10": "UTC+10 (Sydney)",
  "11": "UTC+11",
  "12": "UTC+12 (NZ)",
};

export function analyzeOptimalTiming(
  db: Database.Database,
  userId: string,
  table: "scanned_tweets" | "tweets" = "scanned_tweets"
): TimingAnalysis | null {
  const whereClause = table === "scanned_tweets" ? "user_id = ? AND" : "";
  const params = table === "scanned_tweets" ? [userId] : [];

  const tweets = db.prepare(`
    SELECT created_at, likes, retweets, replies, impressions
    FROM ${table}
    WHERE ${whereClause} tweet_type IN ('original', 'quote')
    ORDER BY created_at DESC LIMIT 500
  `).all(...params) as TweetRow[];

  if (tweets.length < 20) {
    log.info("Not enough tweets for timing analysis", { count: tweets.length });
    return null;
  }

  // ── Hourly performance ──────────────────────────────────
  const hourBuckets: Record<number, TweetRow[]> = {};
  for (let h = 0; h < 24; h++) hourBuckets[h] = [];

  const dayBuckets: Record<number, TweetRow[]> = {};
  for (let d = 0; d < 7; d++) dayBuckets[d] = [];

  const dayHourBuckets: Record<string, TweetRow[]> = {};

  for (const t of tweets) {
    const d = new Date(t.created_at);
    const hour = d.getUTCHours();
    const day = d.getUTCDay();
    hourBuckets[hour].push(t);
    dayBuckets[day].push(t);
    const dhKey = `${day}-${hour}`;
    if (!dayHourBuckets[dhKey]) dayHourBuckets[dhKey] = [];
    dayHourBuckets[dhKey].push(t);
  }

  // Compute hourly performance (only hours with 3+ tweets)
  const hourlyPerformance = Object.entries(hourBuckets)
    .map(([h, tws]) => {
      const hour = parseInt(h);
      if (tws.length < 2) return { hour, tweetCount: tws.length, avgLikes: 0, avgImpressions: 0, engRate: 0, score: 0 };
      const perf = computePerf(tws);
      // Score: combine engagement rate and volume
      const score = Math.round(perf.engRate * Math.log2(tws.length + 1) * 10) / 10;
      return { hour, tweetCount: tws.length, ...perf, score };
    })
    .sort((a, b) => a.hour - b.hour);

  // ── Daily performance ───────────────────────────────────
  const dailyPerformance = Object.entries(dayBuckets)
    .map(([d, tws]) => {
      const dayIndex = parseInt(d);
      if (tws.length < 2) return { day: DAY_NAMES[dayIndex], dayIndex, tweetCount: tws.length, avgLikes: 0, engRate: 0, score: 0 };
      const perf = computePerf(tws);
      const score = Math.round(perf.engRate * Math.log2(tws.length + 1) * 10) / 10;
      return { day: DAY_NAMES[dayIndex], dayIndex, tweetCount: tws.length, avgLikes: perf.avgLikes, engRate: perf.engRate, score };
    })
    .sort((a, b) => a.dayIndex - b.dayIndex);

  // ── Best day×hour windows ───────────────────────────────
  const dayHourScores = Object.entries(dayHourBuckets)
    .filter(([_, tws]) => tws.length >= 2)
    .map(([key, tws]) => {
      const [d, h] = key.split("-").map(Number);
      const perf = computePerf(tws);
      const score = Math.round(perf.engRate * Math.log2(tws.length + 1) * 10) / 10;
      return { day: DAY_NAMES[d], dayIndex: d, hour: h, score, avgLikes: perf.avgLikes, tweetCount: tws.length };
    })
    .sort((a, b) => b.score - a.score);

  // ── Infer timezone ──────────────────────────────────────
  const tz = inferTimezone(hourBuckets);

  // Apply timezone to best windows
  const bestWindows = dayHourScores.slice(0, 8).map(w => ({
    day: w.day,
    hour: w.hour,
    score: w.score,
    avgLikes: w.avgLikes,
    tweetCount: w.tweetCount,
    localHour: ((w.hour + tz.utcOffset) % 24 + 24) % 24,
  }));

  const worstWindows = dayHourScores.length > 8
    ? dayHourScores.slice(-5).reverse().map(w => ({ day: w.day, hour: w.hour, score: w.score, avgLikes: w.avgLikes }))
    : [];

  // ── Recommendations ─────────────────────────────────────
  const recommendations: string[] = [];

  if (bestWindows.length > 0) {
    const topWindow = bestWindows[0];
    recommendations.push(
      `Best window: ${topWindow.day} ${topWindow.localHour}:00 local (${topWindow.hour}:00 UTC) — ${topWindow.avgLikes} avg likes, ${topWindow.score} score`
    );
  }

  // Find best day
  const bestDay = [...dailyPerformance].sort((a, b) => b.score - a.score)[0];
  if (bestDay && bestDay.score > 0) {
    recommendations.push(`Best day: ${bestDay.day} — ${bestDay.engRate}% engagement rate`);
  }

  // Find worst day
  const worstDay = [...dailyPerformance].filter(d => d.tweetCount >= 3).sort((a, b) => a.score - b.score)[0];
  if (worstDay && worstDay.score < bestDay.score * 0.5) {
    recommendations.push(`Weakest day: ${worstDay.day} — consider reducing output here`);
  }

  // Morning vs evening
  const morningTweets = tweets.filter(t => {
    const h = (new Date(t.created_at).getUTCHours() + tz.utcOffset + 24) % 24;
    return h >= 6 && h < 12;
  });
  const eveningTweets = tweets.filter(t => {
    const h = (new Date(t.created_at).getUTCHours() + tz.utcOffset + 24) % 24;
    return h >= 18 && h < 24;
  });

  if (morningTweets.length >= 5 && eveningTweets.length >= 5) {
    const morningPerf = computePerf(morningTweets);
    const eveningPerf = computePerf(eveningTweets);
    if (morningPerf.engRate > eveningPerf.engRate * 1.3) {
      recommendations.push(`Morning posts outperform evening by ${Math.round((morningPerf.engRate / eveningPerf.engRate - 1) * 100)}%`);
    } else if (eveningPerf.engRate > morningPerf.engRate * 1.3) {
      recommendations.push(`Evening posts outperform morning by ${Math.round((eveningPerf.engRate / morningPerf.engRate - 1) * 100)}%`);
    }
  }

  log.info("Timing analysis complete", { userId, tz: tz.label, bestWindows: bestWindows.length });

  return {
    hourlyPerformance,
    dailyPerformance,
    bestWindows,
    worstWindows,
    inferredTimezone: tz,
    recommendations,
  };
}

function inferTimezone(hourBuckets: Record<number, TweetRow[]>): { utcOffset: number; label: string; confidence: number } {
  // Find the hour with least activity — that's likely 3-5 AM local
  const counts = Object.entries(hourBuckets).map(([h, tws]) => ({ hour: parseInt(h), count: tws.length }));

  // Find the 3-hour window with least activity
  let minSum = Infinity;
  let minStart = 0;
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += counts[(start + i) % 24].count;
    }
    if (sum < minSum) {
      minSum = sum;
      minStart = start;
    }
  }

  // The dead zone midpoint is ~3-4 AM local, so UTC offset = local_3am - utc_deadzone
  // Dead zone midpoint in UTC
  const deadMidpointUTC = (minStart + 2) % 24;
  // If dead zone midpoint is at 3 AM local, then:
  // localHour = utcHour + offset => 3 = deadMidpointUTC + offset
  let offset = 3 - deadMidpointUTC;
  if (offset > 12) offset -= 24;
  if (offset < -12) offset += 24;

  // Round to nearest standard timezone
  const rounded = Math.round(offset);
  const label = (TIMEZONE_MAP as Record<string, string>)[String(rounded)] || `UTC${rounded >= 0 ? "+" : ""}${rounded}`;

  // Confidence: how quiet is the dead zone vs peak?
  const totalTweets = counts.reduce((s, c) => s + c.count, 0);
  const deadPct = totalTweets > 0 ? minSum / totalTweets : 0;
  const confidence = Math.min(95, Math.round((1 - deadPct) * 100));

  return { utcOffset: rounded, label, confidence };
}

function computePerf(tweets: TweetRow[]) {
  if (tweets.length === 0) return { avgLikes: 0, avgImpressions: 0, engRate: 0 };
  const totalLikes = tweets.reduce((s, t) => s + t.likes, 0);
  const totalRT = tweets.reduce((s, t) => s + t.retweets, 0);
  const totalReplies = tweets.reduce((s, t) => s + t.replies, 0);
  const totalImp = tweets.reduce((s, t) => s + t.impressions, 0);
  return {
    avgLikes: Math.round(totalLikes / tweets.length * 10) / 10,
    avgImpressions: Math.round(totalImp / tweets.length),
    engRate: totalImp > 0 ? Math.round(((totalLikes + totalRT + totalReplies) / totalImp) * 10000) / 100 : 0,
  };
}
