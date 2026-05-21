import { BaseCollector } from "./base.js";
import { getFollowing } from "../api/x-client.js";
import { getDb } from "../db/index.js";

export class FollowingCollector extends BaseCollector {
  name = "following";

  protected async collect(): Promise<number> {
    const { items: following } = await getFollowing(1000);
    if (!following.length) {
      this.log.info("No following data returned");
      return 0;
    }

    const db = getDb();
    const today = new Date().toISOString().split("T")[0];

    // Get previous snapshot for diff
    const prevSnapshot = db.prepare(`
      SELECT DISTINCT user_id FROM following_snapshots
      WHERE snapshot_date = (
        SELECT MAX(snapshot_date) FROM following_snapshots WHERE snapshot_date < ?
      )
    `).all(today) as { user_id: string }[];

    const prevIds = new Set(prevSnapshot.map(r => r.user_id));
    const currentIds = new Set(following.map(u => u.id));

    // Detect new follows
    const newFollows = following.filter(u => !prevIds.has(u.id));
    // Detect unfollows
    const unfollowed = [...prevIds].filter(id => !currentIds.has(id));

    // Insert snapshot
    const insertSnapshot = db.prepare(`
      INSERT INTO following_snapshots (snapshot_date, user_id, user_handle, user_name, user_bio, user_followers, user_following, user_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_date, user_id) DO UPDATE SET
        user_handle = excluded.user_handle,
        user_name = excluded.user_name,
        user_followers = excluded.user_followers,
        user_following = excluded.user_following
    `);

    const insertChange = db.prepare(`
      INSERT INTO following_changes (change_type, user_id, user_handle, user_name)
      VALUES (?, ?, ?, ?)
    `);

    const insertAll = db.transaction(() => {
      // Store full snapshot
      for (const user of following) {
        insertSnapshot.run(
          today,
          user.id,
          user.username,
          user.name,
          user.description || null,
          user.public_metrics?.followers_count || 0,
          user.public_metrics?.following_count || 0,
          user.verified ? 1 : 0,
        );
      }

      // Log new follows
      for (const user of newFollows) {
        insertChange.run("follow", user.id, user.username, user.name);
      }

      // Log unfollows (we only have the IDs, not the user data)
      for (const userId of unfollowed) {
        // Try to get handle from previous snapshot
        const prev = db.prepare(
          "SELECT user_handle, user_name FROM following_snapshots WHERE user_id = ? ORDER BY snapshot_date DESC LIMIT 1"
        ).get(userId) as { user_handle: string; user_name: string } | undefined;
        insertChange.run("unfollow", userId, prev?.user_handle || null, prev?.user_name || null);
      }

      return following.length;
    });

    const count = insertAll();

    if (newFollows.length > 0 || unfollowed.length > 0) {
      this.log.info("Following changes detected", {
        newFollows: newFollows.length,
        unfollows: unfollowed.length,
        newHandles: newFollows.slice(0, 5).map(u => u.username),
      });
    }

    this.log.info("Following snapshot stored", { count, date: today });
    return count;
  }
}
