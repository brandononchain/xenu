import { BaseAnalyzer } from "./base.js";

export class ReplyChainAnalyzer extends BaseAnalyzer {
  name = "reply_chains";

  protected async analyze(): Promise<number> {
    let patterns = 0;

    // ── 1. Reply depth analysis ─────────────────────────────
    // Count how deep your conversations go
    const replies = this.db.prepare(`
      SELECT
        conversation_id,
        COUNT(*) as depth,
        MIN(created_at) as first_reply,
        MAX(created_at) as last_reply,
        GROUP_CONCAT(DISTINCT in_reply_to_user_id) as reply_targets
      FROM tweets
      WHERE tweet_type = 'reply' AND conversation_id IS NOT NULL
      GROUP BY conversation_id
      ORDER BY depth DESC
    `).all() as {
      conversation_id: string;
      depth: number;
      first_reply: string;
      last_reply: string;
      reply_targets: string | null;
    }[];

    if (replies.length < 3) {
      this.log.info("Not enough reply chains", { count: replies.length });
      return 0;
    }

    // Depth distribution
    const depthDist: Record<number, number> = {};
    for (const r of replies) {
      const d = Math.min(r.depth, 10); // cap at 10+
      depthDist[d] = (depthDist[d] || 0) + 1;
    }

    const avgDepth = Math.round(replies.reduce((s, r) => s + r.depth, 0) / replies.length * 10) / 10;
    const maxDepth = Math.max(...replies.map(r => r.depth));

    this.savePattern("reply_chain", "depth_distribution", {
      avgDepth,
      maxDepth,
      totalConversations: replies.length,
      distribution: depthDist,
      deepConversations: replies.filter(r => r.depth >= 3).length,
    }, 0.85, replies.length);
    patterns++;

    // ── 2. Conversation duration ────────────────────────────
    const durations = replies
      .filter(r => r.depth >= 2)
      .map(r => {
        const start = new Date(r.first_reply).getTime();
        const end = new Date(r.last_reply).getTime();
        return (end - start) / (1000 * 60); // minutes
      });

    if (durations.length > 0) {
      const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);

      this.savePattern("reply_chain", "duration", {
        avgMinutes: avgDuration,
        medianMinutes: durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)],
        buckets: {
          under5min: durations.filter(d => d < 5).length,
          under30min: durations.filter(d => d >= 5 && d < 30).length,
          under1hour: durations.filter(d => d >= 30 && d < 60).length,
          over1hour: durations.filter(d => d >= 60).length,
        },
      }, 0.8, durations.length);
      patterns++;
    }

    // ── 3. Reply targets — who you reply to most ────────────
    const replyTargets = this.db.prepare(`
      SELECT
        in_reply_to_user_id as user_id,
        COUNT(*) as reply_count,
        COUNT(DISTINCT conversation_id) as conversations,
        AVG(likes) as avg_likes
      FROM tweets
      WHERE tweet_type = 'reply' AND in_reply_to_user_id IS NOT NULL
      GROUP BY in_reply_to_user_id
      ORDER BY reply_count DESC
      LIMIT 20
    `).all() as {
      user_id: string;
      reply_count: number;
      conversations: number;
      avg_likes: number;
    }[];

    // Try to resolve handles from following data
    const enriched = replyTargets.map(t => {
      const userInfo = this.db.prepare(
        "SELECT user_handle, user_name FROM following_snapshots WHERE user_id = ? ORDER BY snapshot_date DESC LIMIT 1"
      ).get(t.user_id) as { user_handle: string; user_name: string } | undefined;

      return {
        userId: t.user_id,
        handle: userInfo?.user_handle || null,
        name: userInfo?.user_name || null,
        replies: t.reply_count,
        conversations: t.conversations,
        avgLikesOnReplies: Math.round(t.avg_likes * 10) / 10,
      };
    });

    this.savePattern("reply_chain", "top_targets", enriched, 0.85, replyTargets.length);
    patterns++;

    // ── 4. Reply rate — how often you reply vs post original ─
    const totalTweets = (this.db.prepare("SELECT COUNT(*) as c FROM tweets WHERE tweet_type != 'retweet'").get() as any).c;
    const replyCount = (this.db.prepare("SELECT COUNT(*) as c FROM tweets WHERE tweet_type = 'reply'").get() as any).c;

    this.savePattern("reply_chain", "reply_rate", {
      totalNonRT: totalTweets,
      replies: replyCount,
      pct: Math.round((replyCount / totalTweets) * 100),
      ratio: totalTweets > replyCount
        ? `1 reply per ${Math.round((totalTweets - replyCount) / replyCount * 10) / 10} original tweets`
        : "More replies than originals",
    }, 0.9, totalTweets);
    patterns++;

    return patterns;
  }
}
