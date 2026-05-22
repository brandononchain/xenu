import { BaseAnalyzer } from "./base.js";

interface TweetRow {
  id: string;
  text: string;
  tweet_type: string;
  has_media: number;
  media_type: string | null;
  hashtags: string | null;
  mentions: string | null;
  urls: string | null;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  bookmarks: number;
  quote_count: number;
  created_at: string;
}

export class ContentPerformanceAnalyzer extends BaseAnalyzer {
  name = "content_performance";

  protected async analyze(): Promise<number> {
    const tweets = this.db.prepare(
      "SELECT * FROM tweets WHERE tweet_type != 'retweet' ORDER BY created_at DESC LIMIT 500"
    ).all() as TweetRow[];

    if (tweets.length < 10) {
      this.log.info("Not enough tweets for content analysis", { count: tweets.length });
      return 0;
    }

    let patterns = 0;

    // ── 1. Length vs performance correlation ─────────────────
    const lengthBuckets = [
      { label: "micro", min: 0, max: 50 },
      { label: "short", min: 50, max: 100 },
      { label: "medium", min: 100, max: 200 },
      { label: "long", min: 200, max: 280 },
    ];

    const lengthPerf = lengthBuckets.map(bucket => {
      const inBucket = tweets.filter(t => t.text.length >= bucket.min && t.text.length < bucket.max);
      if (inBucket.length === 0) return { ...bucket, count: 0, avgLikes: 0, avgImpressions: 0, engRate: 0 };

      const totalEng = inBucket.reduce((s, t) => s + t.likes + t.retweets + t.replies, 0);
      const totalImp = inBucket.reduce((s, t) => s + t.impressions, 0);

      return {
        ...bucket,
        count: inBucket.length,
        avgLikes: Math.round(inBucket.reduce((s, t) => s + t.likes, 0) / inBucket.length * 10) / 10,
        avgImpressions: Math.round(inBucket.reduce((s, t) => s + t.impressions, 0) / inBucket.length),
        engRate: totalImp > 0 ? Math.round((totalEng / totalImp) * 10000) / 100 : 0,
      };
    });

    this.savePattern("content_perf", "length_vs_performance", lengthPerf, 0.8, tweets.length);
    patterns++;

    // ── 2. Link vs no-link performance ──────────────────────
    const withLinks = tweets.filter(t => t.urls && JSON.parse(t.urls).length > 0);
    const noLinks = tweets.filter(t => !t.urls || JSON.parse(t.urls).length === 0);

    const linkPerf = {
      withLinks: this.aggregatePerf(withLinks),
      noLinks: this.aggregatePerf(noLinks),
      linkPenalty: 0,
    };

    if (linkPerf.withLinks.avgImpressions > 0 && linkPerf.noLinks.avgImpressions > 0) {
      linkPerf.linkPenalty = Math.round(
        ((linkPerf.noLinks.avgImpressions - linkPerf.withLinks.avgImpressions) / linkPerf.noLinks.avgImpressions) * 100
      );
    }

    this.savePattern("content_perf", "link_impact", linkPerf, 0.8, tweets.length);
    patterns++;

    // ── 3. Mention count vs performance ─────────────────────
    const mentionBuckets = [
      { label: "none", filter: (t: TweetRow) => !t.mentions || JSON.parse(t.mentions).length === 0 },
      { label: "1_mention", filter: (t: TweetRow) => t.mentions && JSON.parse(t.mentions).length === 1 },
      { label: "2plus_mentions", filter: (t: TweetRow) => t.mentions && JSON.parse(t.mentions).length >= 2 },
    ];

    const mentionPerf = mentionBuckets.map(b => ({
      label: b.label,
      ...this.aggregatePerf(tweets.filter(b.filter)),
    }));

    this.savePattern("content_perf", "mention_impact", mentionPerf, 0.75, tweets.length);
    patterns++;

    // ── 4. Time of day performance ──────────────────────────
    const hourPerf: Record<number, { tweets: TweetRow[] }> = {};
    for (const t of tweets) {
      const hour = new Date(t.created_at).getUTCHours();
      if (!hourPerf[hour]) hourPerf[hour] = { tweets: [] };
      hourPerf[hour].tweets.push(t);
    }

    const hourlyPerformance = Object.entries(hourPerf)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        ...this.aggregatePerf(data.tweets),
      }))
      .sort((a, b) => a.hour - b.hour);

    // Find optimal posting windows
    const bestHours = [...hourlyPerformance]
      .filter(h => h.count >= 3)
      .sort((a, b) => b.engRate - a.engRate)
      .slice(0, 5);

    this.savePattern("content_perf", "hourly_performance", {
      hourly: hourlyPerformance,
      bestHours: bestHours.map(h => ({ hour: h.hour, engRate: h.engRate, avgImpressions: h.avgImpressions })),
    }, 0.75, tweets.length);
    patterns++;

    // ── 5. Day of week performance ──────────────────────────
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayPerf: Record<number, TweetRow[]> = {};
    for (const t of tweets) {
      const day = new Date(t.created_at).getUTCDay();
      if (!dayPerf[day]) dayPerf[day] = [];
      dayPerf[day].push(t);
    }

    const dailyPerformance = Object.entries(dayPerf)
      .map(([day, tws]) => ({
        day: dayNames[parseInt(day)],
        dayIndex: parseInt(day),
        ...this.aggregatePerf(tws),
      }))
      .sort((a, b) => a.dayIndex - b.dayIndex);

    this.savePattern("content_perf", "daily_performance", dailyPerformance, 0.75, tweets.length);
    patterns++;

    // ── 6. Bookmark-worthy content signals ──────────────────
    const bookmarked = tweets.filter(t => t.bookmarks > 0).sort((a, b) => b.bookmarks - a.bookmarks);

    if (bookmarked.length >= 3) {
      const bookmarkSignals = {
        totalBookmarked: bookmarked.length,
        pctBookmarked: Math.round((bookmarked.length / tweets.length) * 100),
        avgLength: Math.round(bookmarked.reduce((s, t) => s + t.text.length, 0) / bookmarked.length),
        hasMedia: Math.round((bookmarked.filter(t => t.has_media).length / bookmarked.length) * 100),
        hasLinks: Math.round((bookmarked.filter(t => t.urls && JSON.parse(t.urls).length > 0).length / bookmarked.length) * 100),
        topBookmarked: bookmarked.slice(0, 5).map(t => ({
          id: t.id,
          text: t.text.substring(0, 140),
          bookmarks: t.bookmarks,
          likes: t.likes,
          type: t.tweet_type,
        })),
      };

      this.savePattern("content_perf", "bookmark_signals", bookmarkSignals, 0.8, bookmarked.length);
      patterns++;
    }

    // ── 7. Overall engagement summary ───────────────────────
    const totalEng = tweets.reduce((s, t) => s + t.likes + t.retweets + t.replies, 0);
    const totalImp = tweets.reduce((s, t) => s + t.impressions, 0);

    this.savePattern("content_perf", "summary", {
      totalTweets: tweets.length,
      avgLikes: Math.round(tweets.reduce((s, t) => s + t.likes, 0) / tweets.length * 10) / 10,
      avgRetweets: Math.round(tweets.reduce((s, t) => s + t.retweets, 0) / tweets.length * 10) / 10,
      avgReplies: Math.round(tweets.reduce((s, t) => s + t.replies, 0) / tweets.length * 10) / 10,
      avgImpressions: Math.round(tweets.reduce((s, t) => s + t.impressions, 0) / tweets.length),
      avgBookmarks: Math.round(tweets.reduce((s, t) => s + t.bookmarks, 0) / tweets.length * 10) / 10,
      overallEngRate: totalImp > 0 ? Math.round((totalEng / totalImp) * 10000) / 100 : 0,
    }, 0.9, tweets.length);
    patterns++;

    return patterns;
  }

  private aggregatePerf(tweets: TweetRow[]) {
    if (tweets.length === 0) return { count: 0, avgLikes: 0, avgImpressions: 0, engRate: 0 };

    const totalEng = tweets.reduce((s, t) => s + t.likes + t.retweets + t.replies, 0);
    const totalImp = tweets.reduce((s, t) => s + t.impressions, 0);

    return {
      count: tweets.length,
      avgLikes: Math.round(tweets.reduce((s, t) => s + t.likes, 0) / tweets.length * 10) / 10,
      avgImpressions: Math.round(totalImp / tweets.length),
      engRate: totalImp > 0 ? Math.round((totalEng / totalImp) * 10000) / 100 : 0,
    };
  }
}
