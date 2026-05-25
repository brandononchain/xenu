import { createLogger } from "../logger.js";
import type Database from "better-sqlite3";

const log = createLogger("scanner:velocity");

export interface VelocityAnalysis {
  recentAvg: { likes: number; rt: number; impressions: number; engRate: number };
  historicalAvg: { likes: number; rt: number; impressions: number; engRate: number };
  ratio: { likes: number; impressions: number; engRate: number };
  trend: "accelerating" | "stable" | "declining";
  trendSlope: number;
  breakouts: {
    id: string;
    text: string;
    likes: number;
    impressions: number;
    multiplier: number;
    created_at: string;
  }[];
  stage: "emerging" | "growing" | "established" | "declining" | "viral_moment";
  weeklyEngagement: { week: string; avgLikes: number; avgImpressions: number; tweetCount: number }[];
}

interface TweetRow {
  id: string;
  text: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}

export function analyzeVelocity(db: Database.Database, userId: string, table: "scanned_tweets" | "tweets" = "scanned_tweets"): VelocityAnalysis | null {
  const whereClause = table === "scanned_tweets" ? "user_id = ? AND" : "";
  const params = table === "scanned_tweets" ? [userId] : [];

  const tweets = db.prepare(`
    SELECT id, text, created_at, likes, retweets, replies, impressions
    FROM ${table}
    WHERE ${whereClause} tweet_type IN ('original', 'quote')
    ORDER BY created_at DESC LIMIT 200
  `).all(...params) as TweetRow[];

  if (tweets.length < 20) {
    log.info("Not enough tweets for velocity analysis", { count: tweets.length });
    return null;
  }

  // Split into recent half and historical half
  const midpoint = Math.floor(tweets.length / 2);
  const recent = tweets.slice(0, midpoint);
  const historical = tweets.slice(midpoint);

  const recentAvg = computeAvg(recent);
  const historicalAvg = computeAvg(historical);

  // Ratios: > 1.0 = accelerating
  const likeRatio = historicalAvg.likes > 0 ? Math.round((recentAvg.likes / historicalAvg.likes) * 100) / 100 : 0;
  const impRatio = historicalAvg.impressions > 0 ? Math.round((recentAvg.impressions / historicalAvg.impressions) * 100) / 100 : 0;
  const engRatio = historicalAvg.engRate > 0 ? Math.round((recentAvg.engRate / historicalAvg.engRate) * 100) / 100 : 0;

  // Compute weekly engagement for trend line
  const weeklyMap = new Map<string, { likes: number; imp: number; count: number }>();
  for (const t of tweets) {
    const d = new Date(t.created_at);
    // ISO week: year-Wxx
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
    const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { likes: 0, imp: 0, count: 0 });
    const w = weeklyMap.get(weekKey)!;
    w.likes += t.likes;
    w.imp += t.impressions;
    w.count++;
  }

  const weeklyEngagement = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, d]) => ({
      week,
      avgLikes: Math.round(d.likes / d.count * 10) / 10,
      avgImpressions: Math.round(d.imp / d.count),
      tweetCount: d.count,
    }));

  // Linear regression on weekly avg likes for trend slope
  const trendSlope = computeSlope(weeklyEngagement.map(w => w.avgLikes));

  // Determine trend
  let trend: "accelerating" | "stable" | "declining";
  if (likeRatio > 1.15 || trendSlope > 0.5) trend = "accelerating";
  else if (likeRatio < 0.85 || trendSlope < -0.5) trend = "declining";
  else trend = "stable";

  // Breakout detection: tweets that got 3x+ the average likes
  const overallAvgLikes = tweets.reduce((s, t) => s + t.likes, 0) / tweets.length;
  const breakoutThreshold = Math.max(overallAvgLikes * 3, 10);

  const breakouts = tweets
    .filter(t => t.likes >= breakoutThreshold)
    .map(t => ({
      id: t.id,
      text: t.text.substring(0, 140),
      likes: t.likes,
      impressions: t.impressions,
      multiplier: Math.round((t.likes / Math.max(overallAvgLikes, 1)) * 10) / 10,
      created_at: t.created_at,
    }))
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 10);

  // Get follower count for stage classification
  let followers = 0;
  if (table === "scanned_tweets") {
    const profile = db.prepare("SELECT followers FROM scanned_profiles WHERE user_id = ?").get(userId) as any;
    followers = profile?.followers || 0;
  } else {
    const aud = db.prepare("SELECT followers FROM audience_metrics ORDER BY date DESC LIMIT 1").get() as any;
    followers = aud?.followers || 0;
  }

  // Stage classification
  let stage: VelocityAnalysis["stage"];
  if (breakouts.length >= 3 && breakouts[0].multiplier > 5) {
    stage = "viral_moment";
  } else if (followers < 5000 && trend === "accelerating") {
    stage = "emerging";
  } else if (followers < 5000 && trend !== "declining") {
    stage = "growing";
  } else if (trend === "declining") {
    stage = "declining";
  } else {
    stage = "established";
  }

  log.info("Velocity analysis complete", {
    userId, trend, stage,
    likeRatio, trendSlope: Math.round(trendSlope * 100) / 100,
    breakouts: breakouts.length,
  });

  return {
    recentAvg,
    historicalAvg,
    ratio: { likes: likeRatio, impressions: impRatio, engRate: engRatio },
    trend,
    trendSlope: Math.round(trendSlope * 100) / 100,
    breakouts,
    stage,
    weeklyEngagement,
  };
}

function computeAvg(tweets: TweetRow[]) {
  if (tweets.length === 0) return { likes: 0, rt: 0, impressions: 0, engRate: 0 };
  const totalLikes = tweets.reduce((s, t) => s + t.likes, 0);
  const totalRT = tweets.reduce((s, t) => s + t.retweets, 0);
  const totalReplies = tweets.reduce((s, t) => s + t.replies, 0);
  const totalImp = tweets.reduce((s, t) => s + t.impressions, 0);
  return {
    likes: Math.round(totalLikes / tweets.length * 10) / 10,
    rt: Math.round(totalRT / tweets.length * 10) / 10,
    impressions: Math.round(totalImp / tweets.length),
    engRate: totalImp > 0 ? Math.round(((totalLikes + totalRT + totalReplies) / totalImp) * 10000) / 100 : 0,
  };
}

function computeSlope(values: number[]): number {
  if (values.length < 3) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}
