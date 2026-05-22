import { BaseAnalyzer } from "./base.js";

interface TweetRow {
  id: string;
  text: string;
  created_at: string;
  tweet_type: string;
  has_media: number;
  media_type: string | null;
  hashtags: string | null;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  bookmarks: number;
  quote_count: number;
}

export class PostingPatternAnalyzer extends BaseAnalyzer {
  name = "posting_patterns";

  protected async analyze(): Promise<number> {
    const tweets = this.db.prepare(
      "SELECT * FROM tweets WHERE tweet_type != 'retweet' ORDER BY created_at DESC LIMIT 500"
    ).all() as TweetRow[];

    if (tweets.length < 5) {
      this.log.info("Not enough tweets for pattern analysis", { count: tweets.length });
      return 0;
    }

    let patterns = 0;

    // ── 1. Posting time heatmap (hour × day) ────────────────
    const heatmap: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};

    for (const t of tweets) {
      const d = new Date(t.created_at);
      const hour = d.getUTCHours();
      const day = d.getUTCDay(); // 0=Sun
      const key = `${day}-${hour}`;
      heatmap[key] = (heatmap[key] || 0) + 1;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    // Find peak hours
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h, c]) => ({ hour: parseInt(h), count: c }));

    // Find peak days
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const peakDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([d, c]) => ({ day: dayNames[parseInt(d)], dayIndex: parseInt(d), count: c }));

    this.savePattern("posting_time", "heatmap", heatmap, 0.8, tweets.length);
    this.savePattern("posting_time", "peak_hours", peakHours, 0.8, tweets.length);
    this.savePattern("posting_time", "peak_days", peakDays, 0.8, tweets.length);
    patterns += 3;

    // ── 2. Content type performance ─────────────────────────
    const typeMetrics: Record<string, { count: number; totalLikes: number; totalRT: number; totalImpressions: number; totalReplies: number }> = {};

    for (const t of tweets) {
      const type = t.tweet_type;
      if (!typeMetrics[type]) typeMetrics[type] = { count: 0, totalLikes: 0, totalRT: 0, totalImpressions: 0, totalReplies: 0 };
      typeMetrics[type].count++;
      typeMetrics[type].totalLikes += t.likes;
      typeMetrics[type].totalRT += t.retweets;
      typeMetrics[type].totalImpressions += t.impressions;
      typeMetrics[type].totalReplies += t.replies;
    }

    const typePerformance = Object.entries(typeMetrics).map(([type, m]) => ({
      type,
      count: m.count,
      pct: Math.round((m.count / tweets.length) * 100),
      avgLikes: Math.round(m.totalLikes / m.count * 10) / 10,
      avgRT: Math.round(m.totalRT / m.count * 10) / 10,
      avgImpressions: Math.round(m.totalImpressions / m.count * 10) / 10,
      avgReplies: Math.round(m.totalReplies / m.count * 10) / 10,
      engagementRate: m.totalImpressions > 0
        ? Math.round(((m.totalLikes + m.totalRT + m.totalReplies) / m.totalImpressions) * 10000) / 100
        : 0,
    }));

    this.savePattern("content_type", "performance", typePerformance, 0.85, tweets.length);
    patterns++;

    // ── 3. Media vs text performance ────────────────────────
    const withMedia = tweets.filter(t => t.has_media);
    const textOnly = tweets.filter(t => !t.has_media);

    const mediaPerformance = {
      withMedia: {
        count: withMedia.length,
        avgLikes: withMedia.length ? Math.round(withMedia.reduce((s, t) => s + t.likes, 0) / withMedia.length * 10) / 10 : 0,
        avgImpressions: withMedia.length ? Math.round(withMedia.reduce((s, t) => s + t.impressions, 0) / withMedia.length) : 0,
      },
      textOnly: {
        count: textOnly.length,
        avgLikes: textOnly.length ? Math.round(textOnly.reduce((s, t) => s + t.likes, 0) / textOnly.length * 10) / 10 : 0,
        avgImpressions: textOnly.length ? Math.round(textOnly.reduce((s, t) => s + t.impressions, 0) / textOnly.length) : 0,
      },
      mediaTypes: {} as Record<string, number>,
    };

    for (const t of withMedia) {
      if (t.media_type) {
        mediaPerformance.mediaTypes[t.media_type] = (mediaPerformance.mediaTypes[t.media_type] || 0) + 1;
      }
    }

    this.savePattern("content_type", "media_performance", mediaPerformance, 0.8, tweets.length);
    patterns++;

    // ── 4. Posting frequency ────────────────────────────────
    if (tweets.length >= 2) {
      const dates = tweets.map(t => new Date(t.created_at).getTime()).sort((a, b) => a - b);
      const spanDays = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
      const tweetsPerDay = spanDays > 0 ? Math.round((tweets.length / spanDays) * 10) / 10 : tweets.length;

      // Compute daily counts for variance
      const dailyCounts: Record<string, number> = {};
      for (const t of tweets) {
        const day = t.created_at.split("T")[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      }
      const counts = Object.values(dailyCounts);
      const avgDaily = counts.reduce((s, c) => s + c, 0) / counts.length;
      const variance = counts.reduce((s, c) => s + (c - avgDaily) ** 2, 0) / counts.length;

      this.savePattern("posting_frequency", "summary", {
        tweetsPerDay,
        avgDailyCount: Math.round(avgDaily * 10) / 10,
        stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
        totalDays: Math.round(spanDays),
        totalTweets: tweets.length,
      }, 0.9, tweets.length);
      patterns++;
    }

    // ── 5. Top performing tweets ────────────────────────────
    const topByLikes = [...tweets]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        text: t.text.substring(0, 140),
        type: t.tweet_type,
        likes: t.likes,
        retweets: t.retweets,
        impressions: t.impressions,
        created_at: t.created_at,
      }));

    const topByEngRate = [...tweets]
      .filter(t => t.impressions > 100)
      .map(t => ({
        ...t,
        engRate: (t.likes + t.retweets + t.replies) / t.impressions,
      }))
      .sort((a, b) => b.engRate - a.engRate)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        text: t.text.substring(0, 140),
        type: t.tweet_type,
        engagementRate: Math.round(t.engRate * 10000) / 100,
        likes: t.likes,
        impressions: t.impressions,
        created_at: t.created_at,
      }));

    this.savePattern("top_content", "by_likes", topByLikes, 0.95, tweets.length);
    this.savePattern("top_content", "by_engagement_rate", topByEngRate, 0.9, tweets.length);
    patterns += 2;

    return patterns;
  }
}
