import { BaseCollector } from "./base.js";
import { getBookmarks } from "../api/x-client.js";
import { getDb } from "../db/index.js";

export class BookmarksCollector extends BaseCollector {
  name = "bookmarks";

  protected async collect(): Promise<number> {
    const { items: bookmarks, includes } = await getBookmarks(100);
    if (!bookmarks.length) {
      this.log.info("No bookmarks returned");
      return 0;
    }

    const db = getDb();
    const userMap = new Map<string, string>();
    if (includes?.users) {
      for (const u of includes.users) userMap.set(u.id, u.username);
    }
    const mediaMap = new Map<string, { type: string }>();
    if (includes?.media) {
      for (const m of includes.media) mediaMap.set(m.media_key, { type: m.type });
    }

    const insert = db.prepare(`
      INSERT INTO bookmarks (tweet_id, author_id, author_handle, text, created_at, has_media, media_type, likes, retweets)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tweet_id) DO UPDATE SET
        likes = excluded.likes,
        retweets = excluded.retweets,
        collected_at = datetime('now')
    `);

    const insertAll = db.transaction(() => {
      let count = 0;
      for (const tweet of bookmarks) {
        const handle = tweet.author_id ? userMap.get(tweet.author_id) : null;
        const pm = tweet.public_metrics;

        let hasMedia = 0;
        let mediaType: string | null = null;
        if (tweet.attachments?.media_keys?.length) {
          hasMedia = 1;
          const firstKey = tweet.attachments.media_keys[0];
          mediaType = mediaMap.get(firstKey)?.type || null;
        }

        insert.run(
          tweet.id,
          tweet.author_id || null,
          handle || null,
          tweet.text,
          tweet.created_at,
          hasMedia,
          mediaType,
          pm?.like_count || 0,
          pm?.retweet_count || 0,
        );
        count++;
      }
      return count;
    });

    const count = insertAll();
    this.log.info("Bookmarks stored", { count });
    return count;
  }
}
