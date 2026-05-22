import { BaseAnalyzer } from "./base.js";

interface TweetRow {
  hashtags: string | null;
  likes: number;
  retweets: number;
  impressions: number;
  created_at: string;
}

export class HashtagAnalyzer extends BaseAnalyzer {
  name = "hashtag_clusters";

  protected async analyze(): Promise<number> {
    const tweets = this.db.prepare(
      "SELECT hashtags, likes, retweets, impressions, created_at FROM tweets WHERE hashtags IS NOT NULL ORDER BY created_at DESC LIMIT 500"
    ).all() as TweetRow[];

    if (tweets.length < 3) {
      this.log.info("Not enough hashtagged tweets", { count: tweets.length });
      return 0;
    }

    let patterns = 0;

    // ── 1. Hashtag frequency ────────────────────────────────
    const tagStats: Record<string, {
      count: number;
      totalLikes: number;
      totalRT: number;
      totalImpressions: number;
      dates: string[];
    }> = {};

    for (const tweet of tweets) {
      let tags: string[];
      try {
        tags = JSON.parse(tweet.hashtags!);
      } catch {
        continue;
      }

      for (const tag of tags) {
        const lower = tag.toLowerCase();
        if (!tagStats[lower]) {
          tagStats[lower] = { count: 0, totalLikes: 0, totalRT: 0, totalImpressions: 0, dates: [] };
        }
        tagStats[lower].count++;
        tagStats[lower].totalLikes += tweet.likes;
        tagStats[lower].totalRT += tweet.retweets;
        tagStats[lower].totalImpressions += tweet.impressions;
        tagStats[lower].dates.push(tweet.created_at);
      }
    }

    const tagPerformance = Object.entries(tagStats)
      .map(([tag, s]) => ({
        tag,
        count: s.count,
        avgLikes: Math.round(s.totalLikes / s.count * 10) / 10,
        avgRT: Math.round(s.totalRT / s.count * 10) / 10,
        avgImpressions: Math.round(s.totalImpressions / s.count),
        engagementRate: s.totalImpressions > 0
          ? Math.round(((s.totalLikes + s.totalRT) / s.totalImpressions) * 10000) / 100
          : 0,
        firstUsed: s.dates.sort()[0],
        lastUsed: s.dates.sort().pop(),
      }))
      .sort((a, b) => b.count - a.count);

    this.savePattern("hashtag", "frequency", tagPerformance.slice(0, 30), 0.85, tweets.length);
    patterns++;

    // ── 2. Best performing hashtags ──────────────────────────
    const bestByEngagement = [...tagPerformance]
      .filter(t => t.count >= 2)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 15);

    this.savePattern("hashtag", "best_performing", bestByEngagement, 0.8, tweets.length);
    patterns++;

    // ── 3. Co-occurrence clusters ───────────────────────────
    const coOccurrence: Record<string, Record<string, number>> = {};

    for (const tweet of tweets) {
      let tags: string[];
      try {
        tags = JSON.parse(tweet.hashtags!).map((t: string) => t.toLowerCase());
      } catch {
        continue;
      }

      if (tags.length < 2) continue;

      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const [a, b] = [tags[i], tags[j]].sort();
          if (!coOccurrence[a]) coOccurrence[a] = {};
          coOccurrence[a][b] = (coOccurrence[a][b] || 0) + 1;
        }
      }
    }

    const pairs = Object.entries(coOccurrence)
      .flatMap(([a, partners]) =>
        Object.entries(partners).map(([b, count]) => ({ tags: [a, b], count }))
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    this.savePattern("hashtag", "co_occurrence", pairs, 0.75, tweets.length);
    patterns++;

    // ── 4. Hashtag usage rate ───────────────────────────────
    const totalTweets = (this.db.prepare("SELECT COUNT(*) as c FROM tweets WHERE tweet_type != 'retweet'").get() as any).c;
    const hashtaggedCount = tweets.length;

    this.savePattern("hashtag", "usage_rate", {
      totalTweets,
      withHashtags: hashtaggedCount,
      pct: Math.round((hashtaggedCount / totalTweets) * 100),
      avgTagsPerPost: Math.round(
        tweets.reduce((s, t) => {
          try { return s + JSON.parse(t.hashtags!).length; } catch { return s; }
        }, 0) / tweets.length * 10
      ) / 10,
      uniqueTags: Object.keys(tagStats).length,
    }, 0.9, totalTweets);
    patterns++;

    return patterns;
  }
}
