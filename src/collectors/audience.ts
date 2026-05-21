import { BaseCollector } from "./base.js";
import { getMe } from "../api/x-client.js";
import { getDb } from "../db/index.js";

export class AudienceCollector extends BaseCollector {
  name = "audience";

  protected async collect(): Promise<number> {
    const response = await getMe();
    if (!response?.data) {
      this.log.warn("Could not fetch user profile");
      return 0;
    }

    const user = response.data;
    const pm = user.public_metrics;
    if (!pm) {
      this.log.warn("No public metrics on profile");
      return 0;
    }

    const db = getDb();
    const today = new Date().toISOString().split("T")[0];

    db.prepare(`
      INSERT INTO audience_metrics (date, followers, following, tweet_count, listed_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        followers = excluded.followers,
        following = excluded.following,
        tweet_count = excluded.tweet_count,
        listed_count = excluded.listed_count,
        collected_at = datetime('now')
    `).run(
      today,
      pm.followers_count,
      pm.following_count,
      pm.tweet_count,
      pm.listed_count,
    );

    this.log.info("Audience snapshot stored", {
      date: today,
      followers: pm.followers_count,
      following: pm.following_count,
    });

    return 1;
  }
}
