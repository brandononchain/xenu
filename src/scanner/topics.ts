import { createLogger } from "../logger.js";
import { config } from "../config.js";
import type Database from "better-sqlite3";

const log = createLogger("scanner:topics");

const TOPIC_CATEGORIES = [
  "product_launch",    // shipping, launching, releasing
  "technical",         // code, architecture, infrastructure, debugging
  "opinion",           // hot takes, predictions, commentary
  "industry_news",     // reacting to news, events, announcements
  "community",         // gm, engagement bait, shoutouts, collabs
  "educational",       // threads teaching something, how-tos, explainers
  "personal",          // life updates, behind-the-scenes, stories
  "promotion",         // promoting own products/services, CTAs
  "meme_culture",      // jokes, memes, humor, ironic posts
  "hiring_biz",        // job posts, hiring, partnerships, BD
] as const;

type TopicCategory = typeof TOPIC_CATEGORIES[number];

interface TweetForClassification {
  id: string;
  text: string;
}

export interface TopicAnalysis {
  distribution: { topic: TopicCategory; count: number; pct: number }[];
  topicPerformance: { topic: TopicCategory; count: number; avgLikes: number; avgImpressions: number; engRate: number }[];
  crossoverTopics: { pair: [string, string]; count: number }[];
  totalClassified: number;
}

export async function analyzeTopics(db: Database.Database, userId: string): Promise<TopicAnalysis | null> {
  if (!config.anthropicApiKey) {
    log.info("No ANTHROPIC_API_KEY — skipping topic clustering");
    return null;
  }

  // Get tweets that haven't been classified yet or all tweets
  const tweets = db.prepare(`
    SELECT id, text FROM scanned_tweets
    WHERE user_id = ? AND tweet_type IN ('original', 'quote') AND LENGTH(text) > 20
    ORDER BY created_at DESC LIMIT 200
  `).all(userId) as TweetForClassification[];

  if (tweets.length < 10) {
    log.info("Not enough tweets for topic analysis", { count: tweets.length });
    return null;
  }

  // Batch classify in groups of 40
  const allClassifications: { id: string; topics: TopicCategory[] }[] = [];
  const batchSize = 40;

  for (let i = 0; i < tweets.length; i += batchSize) {
    const batch = tweets.slice(i, i + batchSize);
    const results = await classifyBatch(batch);
    if (results) allClassifications.push(...results);

    // Rate limit between batches
    if (i + batchSize < tweets.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (allClassifications.length === 0) return null;

  // Build topic distribution
  const topicCounts: Record<string, number> = {};
  for (const cat of TOPIC_CATEGORIES) topicCounts[cat] = 0;
  for (const c of allClassifications) {
    for (const t of c.topics) {
      if (topicCounts[t] !== undefined) topicCounts[t]++;
    }
  }

  const total = allClassifications.length;
  const distribution = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic: topic as TopicCategory, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  // Now compute per-topic performance using the classifications
  const classMap = new Map(allClassifications.map(c => [c.id, c.topics]));

  const tweetMetrics = db.prepare(`
    SELECT id, likes, retweets, replies, impressions FROM scanned_tweets WHERE user_id = ? AND id IN (${allClassifications.map(() => "?").join(",")})
  `).all(userId, ...allClassifications.map(c => c.id)) as { id: string; likes: number; retweets: number; replies: number; impressions: number }[];

  const metricsMap = new Map(tweetMetrics.map(t => [t.id, t]));

  const topicPerf: Record<string, { likes: number; rt: number; replies: number; imp: number; count: number }> = {};
  for (const cat of TOPIC_CATEGORIES) topicPerf[cat] = { likes: 0, rt: 0, replies: 0, imp: 0, count: 0 };

  for (const c of allClassifications) {
    const m = metricsMap.get(c.id);
    if (!m) continue;
    for (const topic of c.topics) {
      if (!topicPerf[topic]) continue;
      topicPerf[topic].likes += m.likes;
      topicPerf[topic].rt += m.retweets;
      topicPerf[topic].replies += m.replies;
      topicPerf[topic].imp += m.impressions;
      topicPerf[topic].count++;
    }
  }

  const topicPerformance = Object.entries(topicPerf)
    .filter(([_, v]) => v.count > 0)
    .map(([topic, v]) => ({
      topic: topic as TopicCategory,
      count: v.count,
      avgLikes: Math.round(v.likes / v.count * 10) / 10,
      avgImpressions: Math.round(v.imp / v.count),
      engRate: v.imp > 0 ? Math.round(((v.likes + v.rt + v.replies) / v.imp) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.engRate - a.engRate);

  // Crossover: which topics co-occur
  const pairCounts: Record<string, number> = {};
  for (const c of allClassifications) {
    if (c.topics.length < 2) continue;
    for (let i = 0; i < c.topics.length; i++) {
      for (let j = i + 1; j < c.topics.length; j++) {
        const pair = [c.topics[i], c.topics[j]].sort().join("+");
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
    }
  }

  const crossoverTopics = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pair, count]) => ({ pair: pair.split("+") as [string, string], count }));

  log.info("Topic analysis complete", { userId, classified: allClassifications.length, topTopics: distribution.slice(0, 3).map(d => d.topic) });

  return {
    distribution,
    topicPerformance,
    crossoverTopics,
    totalClassified: allClassifications.length,
  };
}

async function classifyBatch(tweets: TweetForClassification[]): Promise<{ id: string; topics: TopicCategory[] }[] | null> {
  const batchText = tweets.map((t, i) => `[${i}] ${t.text.substring(0, 200)}`).join("\n");

  const prompt = `Classify each tweet into 1-2 topic categories from this list:
${TOPIC_CATEGORIES.join(", ")}

Rules:
- Assign the 1-2 MOST relevant categories
- Every tweet gets at least 1 category
- Return ONLY a JSON array

Tweets:
${batchText}

Return JSON array where each element is: {"index": number, "topics": ["category1", "category2"]}
Return only the JSON array, no other text.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      log.error("Claude API error in topic classification", { status: response.status });
      return null;
    }

    const data = await response.json() as { content: { type: string; text: string }[] };
    const text = data.content.find(c => c.type === "text")?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let results: { index: number; topics: string[] }[];
    try {
      results = JSON.parse(cleaned);
    } catch {
      log.error("Failed to parse topic classification response");
      return null;
    }

    return results
      .filter(r => r.index >= 0 && r.index < tweets.length)
      .map(r => ({
        id: tweets[r.index].id,
        topics: r.topics.filter(t => TOPIC_CATEGORIES.includes(t as TopicCategory)) as TopicCategory[],
      }))
      .filter(r => r.topics.length > 0);
  } catch (err) {
    log.error("Topic classification failed", { error: String(err) });
    return null;
  }
}
