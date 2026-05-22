import { BaseAnalyzer } from "./base.js";

interface EngagementRow {
  action_type: string;
  target_user_id: string | null;
  target_user_handle: string | null;
}

interface MentionRow {
  author_id: string;
  author_handle: string | null;
  author_followers: number;
  likes: number;
}

export class EngagementGraphAnalyzer extends BaseAnalyzer {
  name = "engagement_graph";

  protected async analyze(): Promise<number> {
    let patterns = 0;

    // ── 1. Outbound engagement targets ──────────────────────
    const outbound = this.db.prepare(`
      SELECT
        target_user_handle as handle,
        target_user_id as user_id,
        COUNT(*) as total,
        SUM(CASE WHEN action_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN action_type = 'reply' THEN 1 ELSE 0 END) as replies,
        SUM(CASE WHEN action_type = 'retweet' THEN 1 ELSE 0 END) as retweets,
        SUM(CASE WHEN action_type = 'quote' THEN 1 ELSE 0 END) as quotes,
        MIN(detected_at) as first_engagement,
        MAX(detected_at) as last_engagement
      FROM engagements
      WHERE target_user_handle IS NOT NULL
      GROUP BY target_user_handle
      HAVING total >= 2
      ORDER BY total DESC
      LIMIT 50
    `).all() as {
      handle: string; user_id: string; total: number;
      likes: number; replies: number; retweets: number; quotes: number;
      first_engagement: string; last_engagement: string;
    }[];

    if (outbound.length === 0) {
      this.log.info("No outbound engagement data yet");
      return 0;
    }

    // ── 2. Inbound engagement (mentions from others) ────────
    const inbound = this.db.prepare(`
      SELECT
        author_handle as handle,
        author_id as user_id,
        COUNT(*) as mentions,
        SUM(author_followers) / COUNT(*) as avg_followers,
        AVG(CASE WHEN sentiment_score IS NOT NULL THEN sentiment_score ELSE 0 END) as avg_sentiment
      FROM mentions
      WHERE author_handle IS NOT NULL
      GROUP BY author_handle
      HAVING mentions >= 1
    `).all() as {
      handle: string; user_id: string; mentions: number;
      avg_followers: number; avg_sentiment: number;
    }[];

    const inboundMap = new Map(inbound.map(r => [r.handle, r]));

    // ── 3. Compute reciprocity scores ───────────────────────
    const engagementTargets = outbound.map(out => {
      const inb = inboundMap.get(out.handle);
      const outScore = out.total;
      const inScore = inb?.mentions || 0;

      // Reciprocity: ratio of inbound to outbound engagement
      // 1.0 = perfectly balanced, < 1 = you engage more, > 1 = they engage more
      const reciprocity = outScore > 0 ? Math.round((inScore / outScore) * 100) / 100 : 0;

      // Engagement depth: weighted score (replies/quotes worth more than likes)
      const depth = out.likes * 1 + out.replies * 3 + out.retweets * 2 + out.quotes * 4;

      // Relationship strength: composite of frequency, depth, and reciprocity
      const strength = Math.round(
        (Math.log2(out.total + 1) * 20 + Math.log2(depth + 1) * 15 + Math.min(reciprocity, 2) * 30)
      );

      return {
        handle: out.handle,
        user_id: out.user_id,
        outbound: {
          total: out.total,
          likes: out.likes,
          replies: out.replies,
          retweets: out.retweets,
          quotes: out.quotes,
        },
        inbound: {
          mentions: inScore,
          avgFollowers: inb ? Math.round(inb.avg_followers) : 0,
          avgSentiment: inb ? Math.round(inb.avg_sentiment * 100) / 100 : 0,
        },
        reciprocity,
        depth,
        strength,
        firstEngagement: out.first_engagement,
        lastEngagement: out.last_engagement,
      };
    });

    // Sort by strength
    engagementTargets.sort((a, b) => b.strength - a.strength);

    this.savePattern("engagement_target", "ranked", engagementTargets, 0.85, outbound.length);
    patterns++;

    // ── 4. Engagement clusters ──────────────────────────────
    // Categorize by engagement pattern
    const clusters = {
      deepRelationships: engagementTargets.filter(t => t.reciprocity > 0.5 && t.outbound.total >= 5),
      oneSided: engagementTargets.filter(t => t.reciprocity < 0.1 && t.outbound.total >= 3),
      casual: engagementTargets.filter(t => t.outbound.total < 3),
      highValue: engagementTargets.filter(t => t.inbound.avgFollowers > 5000),
    };

    this.savePattern("engagement_target", "clusters", {
      deepRelationships: clusters.deepRelationships.length,
      oneSided: clusters.oneSided.length,
      casual: clusters.casual.length,
      highValue: clusters.highValue.length,
      deepHandles: clusters.deepRelationships.slice(0, 10).map(t => t.handle),
      oneSidedHandles: clusters.oneSided.slice(0, 10).map(t => t.handle),
      highValueHandles: clusters.highValue.slice(0, 10).map(t => t.handle),
    }, 0.8, engagementTargets.length);
    patterns++;

    // ── 5. Engagement preferences ───────────────────────────
    const totalActions = outbound.reduce((s, o) => s + o.total, 0);
    const totalLikes = outbound.reduce((s, o) => s + o.likes, 0);
    const totalReplies = outbound.reduce((s, o) => s + o.replies, 0);
    const totalRTs = outbound.reduce((s, o) => s + o.retweets, 0);
    const totalQuotes = outbound.reduce((s, o) => s + o.quotes, 0);

    this.savePattern("engagement_target", "preferences", {
      totalActions,
      breakdown: {
        likes: { count: totalLikes, pct: Math.round((totalLikes / totalActions) * 100) },
        replies: { count: totalReplies, pct: Math.round((totalReplies / totalActions) * 100) },
        retweets: { count: totalRTs, pct: Math.round((totalRTs / totalActions) * 100) },
        quotes: { count: totalQuotes, pct: Math.round((totalQuotes / totalActions) * 100) },
      },
      uniqueTargets: outbound.length,
      avgActionsPerTarget: Math.round((totalActions / outbound.length) * 10) / 10,
    }, 0.9, totalActions);
    patterns++;

    // ── 6. Engagement velocity ──────────────────────────────
    const recentEngagements = this.db.prepare(`
      SELECT
        DATE(detected_at) as date,
        COUNT(*) as actions,
        COUNT(DISTINCT target_user_handle) as unique_targets
      FROM engagements
      WHERE detected_at > datetime('now', '-30 days')
      GROUP BY DATE(detected_at)
      ORDER BY date
    `).all() as { date: string; actions: number; unique_targets: number }[];

    if (recentEngagements.length > 0) {
      const avgDaily = recentEngagements.reduce((s, d) => s + d.actions, 0) / recentEngagements.length;
      this.savePattern("engagement_target", "velocity", {
        dailyAvg: Math.round(avgDaily * 10) / 10,
        dailyData: recentEngagements,
        activeDays: recentEngagements.length,
      }, 0.85, recentEngagements.length);
      patterns++;
    }

    return patterns;
  }
}
