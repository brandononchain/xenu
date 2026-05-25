import { createLogger } from "../logger.js";
import type Database from "better-sqlite3";

const log = createLogger("scanner:threads");

interface TweetRow {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  tweet_type: string;
  conversation_id: string | null;
  in_reply_to_user_id: string | null;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  has_media: number;
}

export interface ThreadAnalysis {
  threadCount: number;
  singleCount: number;
  threadPct: number;
  avgThreadLength: number;
  maxThreadLength: number;
  threadPerformance: {
    avgLikes: number;
    avgRT: number;
    avgImpressions: number;
    engRate: number;
  };
  singlePerformance: {
    avgLikes: number;
    avgRT: number;
    avgImpressions: number;
    engRate: number;
  };
  threadMultiplier: {
    likes: number;
    impressions: number;
    engRate: number;
  };
  threads: {
    conversationId: string;
    tweetCount: number;
    totalLikes: number;
    totalImpressions: number;
    firstTweetText: string;
    createdAt: string;
  }[];
  lengthDistribution: Record<number, number>;
}

export function analyzeThreads(db: Database.Database, userId: string): ThreadAnalysis | null {
  // Get all tweets for this user that have conversation_id
  const tweets = db.prepare(`
    SELECT id, user_id, text, created_at, tweet_type, conversation_id, in_reply_to_user_id,
           likes, retweets, replies, impressions, has_media
    FROM scanned_tweets
    WHERE user_id = ? AND tweet_type != 'retweet'
    ORDER BY created_at ASC
  `).all(userId) as TweetRow[];

  if (tweets.length < 10) return null;

  // Group by conversation_id where the user is replying to themselves
  // A thread = multiple tweets by the same user in the same conversation
  const convGroups = new Map<string, TweetRow[]>();

  for (const t of tweets) {
    if (!t.conversation_id) continue;
    if (!convGroups.has(t.conversation_id)) convGroups.set(t.conversation_id, []);
    convGroups.get(t.conversation_id)!.push(t);
  }

  // Filter: threads are conversations where:
  // - The user has 2+ tweets in the same conversation
  // - The first tweet in the conversation is by the user (they started it)
  const threads: TweetRow[][] = [];
  const singles: TweetRow[] = [];

  for (const [convId, group] of convGroups) {
    // Sort by time
    group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (group.length >= 2) {
      // Check if the conversation starter is by this user
      // The tweet whose id matches the conversation_id is the starter
      const isStarter = group[0].id === convId || group[0].in_reply_to_user_id === null || group[0].in_reply_to_user_id === userId;
      if (isStarter) {
        threads.push(group);
      } else {
        // This is a reply chain to someone else, not a thread
        singles.push(...group);
      }
    } else {
      singles.push(...group);
    }
  }

  // Also include tweets without conversation_id as singles
  const noConv = tweets.filter(t => !t.conversation_id);
  singles.push(...noConv);

  if (threads.length === 0 && singles.length === 0) return null;

  // Compute thread performance (aggregate all tweets in a thread)
  const threadTweets = threads.flat();
  const threadLengths = threads.map(t => t.length);

  const threadPerf = computePerf(threadTweets);
  const singlePerf = computePerf(singles);

  // Build thread summaries
  const threadSummaries = threads
    .map(t => ({
      conversationId: t[0].conversation_id || t[0].id,
      tweetCount: t.length,
      totalLikes: t.reduce((s, tw) => s + tw.likes, 0),
      totalImpressions: t.reduce((s, tw) => s + tw.impressions, 0),
      firstTweetText: t[0].text.substring(0, 140),
      createdAt: t[0].created_at,
    }))
    .sort((a, b) => b.totalLikes - a.totalLikes)
    .slice(0, 10);

  // Length distribution
  const lengthDist: Record<number, number> = {};
  for (const len of threadLengths) {
    const capped = Math.min(len, 10);
    lengthDist[capped] = (lengthDist[capped] || 0) + 1;
  }

  // Thread multiplier: how much better do threads perform per tweet?
  const likeMult = singlePerf.avgLikes > 0 ? Math.round((threadPerf.avgLikes / singlePerf.avgLikes) * 100) / 100 : 0;
  const impMult = singlePerf.avgImpressions > 0 ? Math.round((threadPerf.avgImpressions / singlePerf.avgImpressions) * 100) / 100 : 0;
  const engMult = singlePerf.engRate > 0 ? Math.round((threadPerf.engRate / singlePerf.engRate) * 100) / 100 : 0;

  const totalOriginal = threads.length + singles.length;

  log.info(`Thread analysis: ${threads.length} threads, ${singles.length} singles`, {
    userId,
    threadMultiplier: { likes: likeMult, impressions: impMult },
  });

  return {
    threadCount: threads.length,
    singleCount: singles.length,
    threadPct: Math.round((threads.length / totalOriginal) * 100),
    avgThreadLength: threadLengths.length > 0
      ? Math.round(threadLengths.reduce((s, l) => s + l, 0) / threadLengths.length * 10) / 10
      : 0,
    maxThreadLength: threadLengths.length > 0 ? Math.max(...threadLengths) : 0,
    threadPerformance: threadPerf,
    singlePerformance: singlePerf,
    threadMultiplier: { likes: likeMult, impressions: impMult, engRate: engMult },
    threads: threadSummaries,
    lengthDistribution: lengthDist,
  };
}

function computePerf(tweets: TweetRow[]) {
  if (tweets.length === 0) return { avgLikes: 0, avgRT: 0, avgImpressions: 0, engRate: 0 };
  const totalLikes = tweets.reduce((s, t) => s + t.likes, 0);
  const totalRT = tweets.reduce((s, t) => s + t.retweets, 0);
  const totalReplies = tweets.reduce((s, t) => s + t.replies, 0);
  const totalImp = tweets.reduce((s, t) => s + t.impressions, 0);
  return {
    avgLikes: Math.round(totalLikes / tweets.length * 10) / 10,
    avgRT: Math.round(totalRT / tweets.length * 10) / 10,
    avgImpressions: Math.round(totalImp / tweets.length),
    engRate: totalImp > 0 ? Math.round(((totalLikes + totalRT + totalReplies) / totalImp) * 10000) / 100 : 0,
  };
}
