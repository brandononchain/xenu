import { BaseCollector } from "./base.js";
import { getLikedTweets } from "../api/x-client.js";
import { getDb } from "../db/index.js";

export class EngagementCollector extends BaseCollector {
  name = "engagement";

  protected async collect(): Promise<number> {
    const { items: likedTweets, includes } = await getLikedTweets(100);
    if (!likedTweets.length) {
      this.log.info("No liked tweets returned");
      return 0;
    }

    const db = getDb();
    const userMap = new Map<string, { username: string; name: string }>();
    if (includes?.users) {
      for (const u of includes.users) userMap.set(u.id, { username: u.username, name: u.name });
    }

    const insertLike = db.prepare(`
      INSERT INTO liked_tweets (tweet_id, author_id, author_handle, text, created_at, likes, retweets)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tweet_id) DO UPDATE SET
        likes = excluded.likes,
        retweets = excluded.retweets,
        collected_at = datetime('now')
    `);

    const insertEngagement = db.prepare(`
      INSERT INTO engagements (action_type, target_tweet_id, target_user_id, target_user_handle, target_tweet_text)
      SELECT 'like', ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM engagements WHERE action_type = 'like' AND target_tweet_id = ?
      )
    `);

    const insertAll = db.transaction(() => {
      let count = 0;
      for (const tweet of likedTweets) {
        const author = tweet.author_id ? userMap.get(tweet.author_id) : null;
        const pm = tweet.public_metrics;

        insertLike.run(
          tweet.id,
          tweet.author_id || null,
          author?.username || null,
          tweet.text,
          tweet.created_at,
          pm?.like_count || 0,
          pm?.retweet_count || 0,
        );

        insertEngagement.run(
          tweet.id,
          tweet.author_id || null,
          author?.username || null,
          tweet.text.substring(0, 200),
          tweet.id,
        );

        count++;
      }
      return count;
    });

    const count = insertAll();
    this.log.info("Liked tweets stored", { count });
    return count;
  }
}
