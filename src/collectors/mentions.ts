import { BaseCollector } from "./base.js";
import { getMentions } from "../api/x-client.js";
import { getDb } from "../db/index.js";

export class MentionsCollector extends BaseCollector {
  name = "mentions";

  protected async collect(): Promise<number> {
    const { items: mentions, includes } = await getMentions(100);
    if (!mentions.length) {
      this.log.info("No mentions returned");
      return 0;
    }

    const db = getDb();
    const userMap = new Map<string, { username: string; name: string; followers: number }>();
    if (includes?.users) {
      for (const u of includes.users) {
        userMap.set(u.id, {
          username: u.username,
          name: u.name,
          followers: u.public_metrics?.followers_count || 0,
        });
      }
    }

    const insert = db.prepare(`
      INSERT INTO mentions (
        tweet_id, author_id, author_handle, author_name, author_followers,
        text, created_at, in_reply_to_tweet_id, conversation_id,
        likes, retweets
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tweet_id) DO UPDATE SET
        likes = excluded.likes,
        retweets = excluded.retweets,
        collected_at = datetime('now')
    `);

    const insertAll = db.transaction(() => {
      let count = 0;
      for (const tweet of mentions) {
        const author = tweet.author_id ? userMap.get(tweet.author_id) : null;
        const pm = tweet.public_metrics;
        const replyTo = tweet.referenced_tweets?.find(r => r.type === "replied_to")?.id || null;

        insert.run(
          tweet.id,
          tweet.author_id || null,
          author?.username || null,
          author?.name || null,
          author?.followers || 0,
          tweet.text,
          tweet.created_at,
          replyTo,
          tweet.conversation_id || null,
          pm?.like_count || 0,
          pm?.retweet_count || 0,
        );
        count++;
      }
      return count;
    });

    const count = insertAll();
    this.log.info("Mentions stored", { count });
    return count;
  }
}
