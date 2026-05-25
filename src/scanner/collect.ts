import { createLogger } from "../logger.js";
import { getDb } from "../db/index.js";
import {
  getUserByHandle,
  getPublicUserTweets,
  type XTweet,
  type XMedia,
} from "../api/x-client.js";

const log = createLogger("scanner:collect");

export interface ScanResult {
  userId: string;
  handle: string;
  tweetsCollected: number;
  status: "complete" | "error";
  error?: string;
}

export async function scanProfile(handle: string): Promise<ScanResult> {
  const clean = handle.replace(/^@/, "").toLowerCase();
  log.info(`Starting scan: @${clean}`);

  const db = getDb();

  // 1. Resolve handle to user ID + profile
  const userRes = await getUserByHandle(clean);
  if (!userRes?.data) {
    const err = `Could not find user @${clean}`;
    log.error(err);
    return { userId: "", handle: clean, tweetsCollected: 0, status: "error", error: err };
  }

  const user = userRes.data;
  const userId = user.id;
  const pm = user.public_metrics;

  // Upsert profile
  db.prepare(`
    INSERT INTO scanned_profiles (
      user_id, handle, name, bio, followers, following, tweet_count, listed_count,
      verified, profile_image_url, location, created_at, last_scanned, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'scanning')
    ON CONFLICT(user_id) DO UPDATE SET
      handle = excluded.handle,
      name = excluded.name,
      bio = excluded.bio,
      followers = excluded.followers,
      following = excluded.following,
      tweet_count = excluded.tweet_count,
      listed_count = excluded.listed_count,
      verified = excluded.verified,
      profile_image_url = excluded.profile_image_url,
      location = excluded.location,
      last_scanned = datetime('now'),
      scan_count = scan_count + 1,
      status = 'scanning'
  `).run(
    userId, user.username, user.name, user.description || null,
    pm?.followers_count || 0, pm?.following_count || 0,
    pm?.tweet_count || 0, pm?.listed_count || 0,
    user.verified ? 1 : 0, user.profile_image_url || null,
    user.location || null, user.created_at || null
  );

  // 2. Fetch tweets (up to 500)
  let totalCollected = 0;
  try {
    const { items: tweets, includes } = await getPublicUserTweets(userId, 5);

    if (!tweets.length) {
      log.info(`No public tweets for @${clean}`);
      db.prepare("UPDATE scanned_profiles SET status = 'complete' WHERE user_id = ?").run(userId);
      return { userId, handle: clean, tweetsCollected: 0, status: "complete" };
    }

    const mediaMap = new Map<string, XMedia>();
    if (includes?.media) {
      for (const m of includes.media) mediaMap.set(m.media_key, m);
    }

    const insert = db.prepare(`
      INSERT INTO scanned_tweets (
        id, user_id, text, created_at, tweet_type, in_reply_to_user_id,
        conversation_id, has_media, media_type, hashtags, mentions, urls,
        lang, likes, retweets, replies, impressions, bookmarks, quote_count
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      ) ON CONFLICT(id, user_id) DO UPDATE SET
        likes = excluded.likes,
        retweets = excluded.retweets,
        replies = excluded.replies,
        impressions = excluded.impressions,
        bookmarks = excluded.bookmarks,
        quote_count = excluded.quote_count,
        collected_at = datetime('now')
    `);

    const insertAll = db.transaction((tweetList: XTweet[]) => {
      let count = 0;
      for (const tweet of tweetList) {
        const tweetType = classifyTweetType(tweet);
        const replyTo = tweet.referenced_tweets?.find(r => r.type === "replied_to")?.id || null;
        const tpm = tweet.public_metrics;
        const hashtags = tweet.entities?.hashtags?.map(h => h.tag) || [];
        const mentionsList = tweet.entities?.mentions?.map(m => m.username) || [];
        const urlsList = tweet.entities?.urls?.map(u => u.expanded_url) || [];

        let hasMedia = 0;
        let mediaType: string | null = null;
        if (tweet.attachments?.media_keys) {
          hasMedia = 1;
          for (const key of tweet.attachments.media_keys) {
            const m = mediaMap.get(key);
            if (m) mediaType = m.type;
          }
        }

        insert.run(
          tweet.id, userId, tweet.text, tweet.created_at, tweetType,
          tweet.in_reply_to_user_id || null, tweet.conversation_id || null,
          hasMedia, mediaType,
          hashtags.length ? JSON.stringify(hashtags) : null,
          mentionsList.length ? JSON.stringify(mentionsList) : null,
          urlsList.length ? JSON.stringify(urlsList) : null,
          tweet.lang || null,
          tpm?.like_count || 0, tpm?.retweet_count || 0,
          tpm?.reply_count || 0, tpm?.impression_count || 0,
          tpm?.bookmark_count || 0, tpm?.quote_count || 0,
        );
        count++;
      }
      return count;
    });

    totalCollected = insertAll(tweets);
    log.info(`Collected ${totalCollected} tweets for @${clean}`);

    db.prepare("UPDATE scanned_profiles SET status = 'complete' WHERE user_id = ?").run(userId);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error(`Scan failed for @${clean}`, { error: errMsg });
    db.prepare("UPDATE scanned_profiles SET status = 'error' WHERE user_id = ?").run(userId);
    return { userId, handle: clean, tweetsCollected: totalCollected, status: "error", error: errMsg };
  }

  return { userId, handle: clean, tweetsCollected: totalCollected, status: "complete" };
}

function classifyTweetType(tweet: XTweet): string {
  if (!tweet.referenced_tweets) return "original";
  const types = tweet.referenced_tweets.map(r => r.type);
  if (types.includes("retweeted")) return "retweet";
  if (types.includes("quoted")) return "quote";
  if (types.includes("replied_to")) return "reply";
  return "original";
}
