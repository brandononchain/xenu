import { BaseCollector } from "./base.js";
import { getAllUserTweets, type XTweet, type XMedia } from "../api/x-client.js";
import { getDb } from "../db/index.js";

export class TimelineCollector extends BaseCollector {
  name = "timeline";

  protected async collect(): Promise<number> {
    const { items: tweets, includes } = await getAllUserTweets(5);
    if (!tweets.length) {
      this.log.info("No tweets returned");
      return 0;
    }

    const db = getDb();
    const mediaMap = new Map<string, XMedia>();
    if (includes?.media) {
      for (const m of includes.media) mediaMap.set(m.media_key, m);
    }

    const insert = db.prepare(`
      INSERT INTO tweets (
        id, text, created_at, tweet_type, in_reply_to_user_id, in_reply_to_tweet_id,
        conversation_id, has_media, media_type, media_urls, hashtags, mentions, urls,
        lang, likes, retweets, replies, impressions, bookmarks, quote_count
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      ) ON CONFLICT(id) DO UPDATE SET
        likes = excluded.likes,
        retweets = excluded.retweets,
        replies = excluded.replies,
        impressions = excluded.impressions,
        bookmarks = excluded.bookmarks,
        quote_count = excluded.quote_count,
        collected_at = datetime('now')
    `);

    const insertMany = db.transaction((tweetList: XTweet[]) => {
      let count = 0;
      for (const tweet of tweetList) {
        const tweetType = this.classifyTweetType(tweet);
        const replyToTweet = tweet.referenced_tweets?.find(r => r.type === "replied_to")?.id || null;
        const pm = tweet.public_metrics;
        const hashtags = tweet.entities?.hashtags?.map(h => h.tag) || [];
        const mentionsList = tweet.entities?.mentions?.map(m => m.username) || [];
        const urlsList = tweet.entities?.urls?.map(u => u.expanded_url) || [];

        let hasMedia = 0;
        let mediaType: string | null = null;
        let mediaUrls: string[] = [];
        if (tweet.attachments?.media_keys) {
          hasMedia = 1;
          for (const key of tweet.attachments.media_keys) {
            const m = mediaMap.get(key);
            if (m) {
              mediaType = m.type;
              if (m.url) mediaUrls.push(m.url);
              else if (m.preview_image_url) mediaUrls.push(m.preview_image_url);
            }
          }
        }

        insert.run(
          tweet.id,
          tweet.text,
          tweet.created_at,
          tweetType,
          tweet.in_reply_to_user_id || null,
          replyToTweet,
          tweet.conversation_id || null,
          hasMedia,
          mediaType,
          mediaUrls.length ? JSON.stringify(mediaUrls) : null,
          hashtags.length ? JSON.stringify(hashtags) : null,
          mentionsList.length ? JSON.stringify(mentionsList) : null,
          urlsList.length ? JSON.stringify(urlsList) : null,
          tweet.lang || null,
          pm?.like_count || 0,
          pm?.retweet_count || 0,
          pm?.reply_count || 0,
          pm?.impression_count || 0,
          pm?.bookmark_count || 0,
          pm?.quote_count || 0,
        );
        count++;
      }
      return count;
    });

    const count = insertMany(tweets);
    this.log.info("Tweets stored", { count, total: tweets.length });
    return count;
  }

  private classifyTweetType(tweet: XTweet): string {
    if (!tweet.referenced_tweets) return "original";
    const types = tweet.referenced_tweets.map(r => r.type);
    if (types.includes("retweeted")) return "retweet";
    if (types.includes("quoted")) return "quote";
    if (types.includes("replied_to")) return "reply";
    return "original";
  }
}
