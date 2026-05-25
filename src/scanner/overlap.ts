import { createLogger } from "../logger.js";
import { config } from "../config.js";
import { getPublicFollowers, getFollowers } from "../api/x-client.js";
import type Database from "better-sqlite3";

const log = createLogger("scanner:overlap");

export interface OverlapAnalysis {
  yourFollowersSampled: number;
  theirFollowersSampled: number;
  sharedFollowers: {
    userId: string;
    handle: string;
    name: string;
    followers: number;
  }[];
  overlapCount: number;
  overlapPct: number;
  highValueShared: {
    userId: string;
    handle: string;
    name: string;
    followers: number;
  }[];
  audienceProfile: {
    avgFollowers: number;
    medianFollowers: number;
    verifiedPct: number;
  };
}

export async function analyzeFollowerOverlap(
  db: Database.Database,
  targetUserId: string
): Promise<OverlapAnalysis | null> {
  log.info("Starting follower overlap analysis", { targetUserId });

  // 1. Get your followers from the most recent following_snapshot
  //    OR fetch fresh if we don't have stored data
  let yourFollowerIds = new Set<string>();
  let yourFollowerMap = new Map<string, { handle: string; name: string; followers: number }>();

  // Try to get from stored follower data (if we ever collected followers)
  // We store "following" not "followers" in snapshots, so let's fetch fresh
  try {
    const { items: yourFollowers } = await getFollowers(3); // Sample ~3000
    for (const f of yourFollowers) {
      yourFollowerIds.add(f.id);
      yourFollowerMap.set(f.id, {
        handle: f.username,
        name: f.name,
        followers: f.public_metrics?.followers_count || 0,
      });
    }
    log.info(`Fetched ${yourFollowers.length} of your followers`);
  } catch (err) {
    log.error("Failed to fetch your followers", { error: String(err) });
    return null;
  }

  if (yourFollowerIds.size === 0) {
    log.info("No followers found for your account");
    return null;
  }

  // 2. Get target profile's followers
  let theirFollowerIds = new Set<string>();
  let theirFollowerMap = new Map<string, { handle: string; name: string; followers: number; verified: boolean }>();

  try {
    const { items: theirFollowers } = await getPublicFollowers(targetUserId, 3);
    for (const f of theirFollowers) {
      theirFollowerIds.add(f.id);
      theirFollowerMap.set(f.id, {
        handle: f.username,
        name: f.name,
        followers: f.public_metrics?.followers_count || 0,
        verified: f.verified || false,
      });
    }
    log.info(`Fetched ${theirFollowers.length} of target's followers`);
  } catch (err) {
    log.error("Failed to fetch target followers", { error: String(err) });
    return null;
  }

  if (theirFollowerIds.size === 0) {
    log.info("No followers found for target account");
    return null;
  }

  // 3. Compute overlap
  const sharedIds = [...yourFollowerIds].filter(id => theirFollowerIds.has(id));

  const sharedFollowers = sharedIds.map(id => {
    const yours = yourFollowerMap.get(id);
    const theirs = theirFollowerMap.get(id);
    return {
      userId: id,
      handle: yours?.handle || theirs?.handle || "",
      name: yours?.name || theirs?.name || "",
      followers: yours?.followers || theirs?.followers || 0,
    };
  }).sort((a, b) => b.followers - a.followers);

  // High-value shared: followers with 1000+ followers themselves
  const highValueShared = sharedFollowers.filter(f => f.followers >= 1000).slice(0, 20);

  // Audience profile of their followers
  const theirFollowerCounts = [...theirFollowerMap.values()].map(f => f.followers).sort((a, b) => a - b);
  const avgFollowers = theirFollowerCounts.length > 0
    ? Math.round(theirFollowerCounts.reduce((s, c) => s + c, 0) / theirFollowerCounts.length)
    : 0;
  const medianFollowers = theirFollowerCounts.length > 0
    ? theirFollowerCounts[Math.floor(theirFollowerCounts.length / 2)]
    : 0;
  const verifiedCount = [...theirFollowerMap.values()].filter(f => f.verified).length;
  const verifiedPct = theirFollowerMap.size > 0
    ? Math.round((verifiedCount / theirFollowerMap.size) * 100)
    : 0;

  const overlapPct = Math.round((sharedIds.length / Math.min(yourFollowerIds.size, theirFollowerIds.size)) * 100);

  log.info("Follower overlap computed", {
    yourSampled: yourFollowerIds.size,
    theirSampled: theirFollowerIds.size,
    overlap: sharedIds.length,
    overlapPct,
    highValue: highValueShared.length,
  });

  return {
    yourFollowersSampled: yourFollowerIds.size,
    theirFollowersSampled: theirFollowerIds.size,
    sharedFollowers: sharedFollowers.slice(0, 50),
    overlapCount: sharedIds.length,
    overlapPct,
    highValueShared,
    audienceProfile: {
      avgFollowers,
      medianFollowers,
      verifiedPct,
    },
  };
}
