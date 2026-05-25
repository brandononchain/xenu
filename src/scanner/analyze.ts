import { getDb } from "../db/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("scanner:analyze");

interface ScannedTweet {
  id: string;
  text: string;
  created_at: string;
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
}

function savePattern(db: any, userId: string, type: string, key: string, value: unknown, confidence: number, sampleSize: number) {
  db.prepare(`
    INSERT INTO scanned_patterns (user_id, pattern_type, pattern_key, pattern_value, confidence, sample_size, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, pattern_type, pattern_key) DO UPDATE SET
      pattern_value = excluded.pattern_value,
      confidence = excluded.confidence,
      sample_size = excluded.sample_size,
      computed_at = datetime('now')
  `).run(userId, type, key, JSON.stringify(value), confidence, sampleSize);
}

function saveVoice(db: any, userId: string, metric: string, value: unknown) {
  db.prepare(`
    INSERT INTO scanned_voice (user_id, metric, value, computed_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, metric) DO UPDATE SET
      value = excluded.value,
      computed_at = datetime('now')
  `).run(userId, metric, JSON.stringify(value));
}

export async function analyzeScannedProfile(userId: string): Promise<{ patterns: number }> {
  const db = getDb();
  const startTime = Date.now();
  let totalPatterns = 0;

  const tweets = db.prepare(
    "SELECT * FROM scanned_tweets WHERE user_id = ? AND tweet_type != 'retweet' ORDER BY created_at DESC LIMIT 500"
  ).all(userId) as ScannedTweet[];

  if (tweets.length < 5) {
    log.info("Not enough tweets for analysis", { userId, count: tweets.length });
    return { patterns: 0 };
  }

  log.info(`Analyzing ${tweets.length} tweets for ${userId}`);

  // ═══ 1. Posting Patterns ═══════════════════════════════

  const heatmap: Record<string, number> = {};
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};

  for (const t of tweets) {
    const d = new Date(t.created_at);
    const hour = d.getUTCHours();
    const day = d.getUTCDay();
    const key = `${day}-${hour}`;
    heatmap[key] = (heatmap[key] || 0) + 1;
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h, c]) => ({ hour: parseInt(h), count: c }));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const peakDays = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([d, c]) => ({ day: dayNames[parseInt(d)], dayIndex: parseInt(d), count: c }));

  savePattern(db, userId, "posting_time", "heatmap", heatmap, 0.8, tweets.length);
  savePattern(db, userId, "posting_time", "peak_hours", peakHours, 0.8, tweets.length);
  savePattern(db, userId, "posting_time", "peak_days", peakDays, 0.8, tweets.length);
  totalPatterns += 3;

  // ═══ 2. Content Type Performance ═══════════════════════

  const typeMetrics: Record<string, { count: number; totalLikes: number; totalRT: number; totalImpressions: number; totalReplies: number }> = {};
  for (const t of tweets) {
    if (!typeMetrics[t.tweet_type]) typeMetrics[t.tweet_type] = { count: 0, totalLikes: 0, totalRT: 0, totalImpressions: 0, totalReplies: 0 };
    typeMetrics[t.tweet_type].count++;
    typeMetrics[t.tweet_type].totalLikes += t.likes;
    typeMetrics[t.tweet_type].totalRT += t.retweets;
    typeMetrics[t.tweet_type].totalImpressions += t.impressions;
    typeMetrics[t.tweet_type].totalReplies += t.replies;
  }

  const typePerformance = Object.entries(typeMetrics).map(([type, m]) => ({
    type, count: m.count, pct: Math.round((m.count / tweets.length) * 100),
    avgLikes: Math.round(m.totalLikes / m.count * 10) / 10,
    avgRT: Math.round(m.totalRT / m.count * 10) / 10,
    avgImpressions: Math.round(m.totalImpressions / m.count),
    engagementRate: m.totalImpressions > 0
      ? Math.round(((m.totalLikes + m.totalRT + m.totalReplies) / m.totalImpressions) * 10000) / 100 : 0,
  }));

  savePattern(db, userId, "content_type", "performance", typePerformance, 0.85, tweets.length);
  totalPatterns++;

  // ═══ 3. Media vs text ══════════════════════════════════

  const withMedia = tweets.filter(t => t.has_media);
  const textOnly = tweets.filter(t => !t.has_media);
  savePattern(db, userId, "content_type", "media_performance", {
    withMedia: { count: withMedia.length, avgLikes: withMedia.length ? Math.round(withMedia.reduce((s, t) => s + t.likes, 0) / withMedia.length * 10) / 10 : 0 },
    textOnly: { count: textOnly.length, avgLikes: textOnly.length ? Math.round(textOnly.reduce((s, t) => s + t.likes, 0) / textOnly.length * 10) / 10 : 0 },
  }, 0.8, tweets.length);
  totalPatterns++;

  // ═══ 4. Top performing tweets ══════════════════════════

  const topByLikes = [...tweets].sort((a, b) => b.likes - a.likes).slice(0, 10).map(t => ({
    id: t.id, text: t.text.substring(0, 140), type: t.tweet_type,
    likes: t.likes, retweets: t.retweets, impressions: t.impressions, created_at: t.created_at,
  }));
  savePattern(db, userId, "top_content", "by_likes", topByLikes, 0.95, tweets.length);
  totalPatterns++;

  // ═══ 5. Posting frequency ══════════════════════════════

  if (tweets.length >= 2) {
    const dates = tweets.map(t => new Date(t.created_at).getTime()).sort((a, b) => a - b);
    const spanDays = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
    const tweetsPerDay = spanDays > 0 ? Math.round((tweets.length / spanDays) * 10) / 10 : tweets.length;
    savePattern(db, userId, "posting_frequency", "summary", {
      tweetsPerDay, totalDays: Math.round(spanDays), totalTweets: tweets.length,
    }, 0.9, tweets.length);
    totalPatterns++;
  }

  // ═══ 6. Hashtag analysis ═══════════════════════════════

  const tagStats: Record<string, { count: number; totalLikes: number }> = {};
  for (const tweet of tweets) {
    if (!tweet.hashtags) continue;
    let tags: string[];
    try { tags = JSON.parse(tweet.hashtags); } catch { continue; }
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      if (!tagStats[lower]) tagStats[lower] = { count: 0, totalLikes: 0 };
      tagStats[lower].count++;
      tagStats[lower].totalLikes += tweet.likes;
    }
  }

  const tagPerf = Object.entries(tagStats)
    .map(([tag, s]) => ({ tag, count: s.count, avgLikes: Math.round(s.totalLikes / s.count * 10) / 10 }))
    .sort((a, b) => b.count - a.count);

  if (tagPerf.length > 0) {
    savePattern(db, userId, "hashtag", "frequency", tagPerf.slice(0, 30), 0.8, tweets.length);
    totalPatterns++;
  }

  // ═══ 7. Reply chain depth ══════════════════════════════

  const allTweets = db.prepare(
    "SELECT conversation_id, tweet_type FROM scanned_tweets WHERE user_id = ? AND tweet_type = 'reply' AND conversation_id IS NOT NULL"
  ).all(userId) as { conversation_id: string; tweet_type: string }[];

  if (allTweets.length >= 3) {
    const convCounts: Record<string, number> = {};
    for (const t of allTweets) convCounts[t.conversation_id] = (convCounts[t.conversation_id] || 0) + 1;
    const depths = Object.values(convCounts);
    const avgDepth = Math.round(depths.reduce((s, d) => s + d, 0) / depths.length * 10) / 10;
    const depthDist: Record<number, number> = {};
    for (const d of depths) { const capped = Math.min(d, 10); depthDist[capped] = (depthDist[capped] || 0) + 1; }

    savePattern(db, userId, "reply_chain", "depth_distribution", {
      avgDepth, maxDepth: Math.max(...depths), totalConversations: depths.length, distribution: depthDist,
    }, 0.8, allTweets.length);
    totalPatterns++;
  }

  // ═══ 8. Content performance by time ════════════════════

  const hourPerf: Record<number, { likes: number; count: number }> = {};
  for (const t of tweets) {
    const hour = new Date(t.created_at).getUTCHours();
    if (!hourPerf[hour]) hourPerf[hour] = { likes: 0, count: 0 };
    hourPerf[hour].likes += t.likes;
    hourPerf[hour].count++;
  }

  const hourlyPerformance = Object.entries(hourPerf).map(([h, d]) => ({
    hour: parseInt(h), avgLikes: Math.round(d.likes / d.count * 10) / 10, count: d.count,
  })).sort((a, b) => a.hour - b.hour);

  savePattern(db, userId, "content_perf", "hourly_performance", hourlyPerformance, 0.75, tweets.length);
  totalPatterns++;

  // ═══ 9. Overall engagement summary ═════════════════════

  const totalEng = tweets.reduce((s, t) => s + t.likes + t.retweets + t.replies, 0);
  const totalImp = tweets.reduce((s, t) => s + t.impressions, 0);

  savePattern(db, userId, "content_perf", "summary", {
    totalTweets: tweets.length,
    avgLikes: Math.round(tweets.reduce((s, t) => s + t.likes, 0) / tweets.length * 10) / 10,
    avgRetweets: Math.round(tweets.reduce((s, t) => s + t.retweets, 0) / tweets.length * 10) / 10,
    avgReplies: Math.round(tweets.reduce((s, t) => s + t.replies, 0) / tweets.length * 10) / 10,
    avgImpressions: Math.round(tweets.reduce((s, t) => s + t.impressions, 0) / tweets.length),
    overallEngRate: totalImp > 0 ? Math.round((totalEng / totalImp) * 10000) / 100 : 0,
  }, 0.9, tweets.length);
  totalPatterns++;

  // ═══ 10. Voice Fingerprint ═════════════════════════════

  const originals = tweets.filter(t => t.tweet_type === "original" || t.tweet_type === "quote");
  const repliesList = tweets.filter(t => t.tweet_type === "reply");

  if (originals.length >= 5) {
    // Length
    const lengths = originals.map(t => t.text.length);
    const avgLength = Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length);
    saveVoice(db, userId, "avg_length", {
      average: avgLength,
      median: lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)],
      distribution: {
        short: lengths.filter(l => l < 80).length,
        medium: lengths.filter(l => l >= 80 && l < 200).length,
        long: lengths.filter(l => l >= 200).length,
      },
      sampleSize: originals.length,
    });
    totalPatterns++;

    // Vocabulary
    const allWords = originals.map(t => t.text.toLowerCase())
      .join(" ").replace(/https?:\/\/\S+/g, "").replace(/@\w+/g, "").replace(/[^\w\s]/g, "")
      .split(/\s+/).filter(w => w.length > 2);

    const wordFreq: Record<string, number> = {};
    for (const w of allWords) wordFreq[w] = (wordFreq[w] || 0) + 1;

    const stopWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "was", "one", "our", "out", "has", "have", "been", "that", "this", "with", "will", "your", "from", "they", "more", "when", "very", "what", "just", "about", "into", "than", "them", "then", "some", "also", "its", "like", "how", "get", "got", "going", "would", "could", "should", "make", "way", "too", "any", "know", "need", "want", "think", "see"]);

    const topWords = Object.entries(wordFreq)
      .filter(([w]) => !stopWords.has(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({ word, count }));

    saveVoice(db, userId, "vocabulary", {
      uniqueWords: Object.keys(wordFreq).length,
      totalWords: allWords.length,
      lexicalDiversity: Math.round((Object.keys(wordFreq).length / allWords.length) * 1000) / 1000,
      topWords,
      avgWordsPerTweet: Math.round(allWords.length / originals.length),
    });
    totalPatterns++;

    // Tone
    const allTexts = tweets.map(t => t.text);
    const lowerTexts = allTexts.map(t => t.toLowerCase());

    const hedgeWords = ["maybe", "perhaps", "possibly", "might", "could", "seems", "apparently", "i think", "i guess"];
    const directWords = ["is", "will", "must", "need", "should", "build", "ship", "launch", "let's", "here's"];
    const hedgeCount = lowerTexts.filter(t => hedgeWords.some(h => t.includes(h))).length;
    const directCount = lowerTexts.filter(t => directWords.some(d => t.includes(d))).length;
    const directnessScore = Math.min(100, Math.max(0, Math.round(((directCount - hedgeCount) / allTexts.length + 0.5) * 100)));

    const techTerms = ["api", "sdk", "deploy", "ship", "stack", "infra", "protocol", "chain", "token", "contract", "node", "rust", "typescript", "agent", "llm", "model"];
    const techCount = lowerTexts.filter(t => techTerms.some(term => t.includes(term))).length;
    const technicalScore = Math.min(100, Math.round((techCount / allTexts.length) * 200));

    const hypeTerms = ["🔥", "🚀", "insane", "incredible", "massive", "huge", "game changer", "bullish", "lfg", "wagmi"];
    const hypeCount = lowerTexts.filter(t => hypeTerms.some(h => t.includes(h))).length;
    const hypeScore = Math.min(100, Math.round((hypeCount / allTexts.length) * 200));

    const sarcasmMarkers = ["lol", "lmao", "bruh", "imagine", "literally", "apparently", "somehow", "wild"];
    const sarcasmCount = lowerTexts.filter(t => sarcasmMarkers.some(m => t.includes(m))).length;
    const sarcasmScore = Math.min(100, Math.round((sarcasmCount / allTexts.length) * 200));

    saveVoice(db, userId, "tone", {
      directness: directnessScore,
      technical: technicalScore,
      hype: hypeScore,
      sarcasm: sarcasmScore,
      sampleSize: allTexts.length,
    });
    totalPatterns++;

    // Emoji
    const emojiRegex = /[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu;
    const emojiCounts: Record<string, number> = {};
    let totalEmojis = 0;
    for (const t of allTexts) {
      const matches = t.match(emojiRegex);
      if (matches) { totalEmojis += matches.length; for (const e of matches) emojiCounts[e] = (emojiCounts[e] || 0) + 1; }
    }

    const topEmojis = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([emoji, count]) => ({ emoji, count }));

    saveVoice(db, userId, "emoji_rate", {
      totalEmojis,
      pctWithEmoji: Math.round((allTexts.filter(t => emojiRegex.test(t)).length / allTexts.length) * 100),
      avgPerTweet: Math.round((totalEmojis / allTexts.length) * 100) / 100,
      topEmojis,
    });
    totalPatterns++;

    // Reply style
    if (repliesList.length >= 3) {
      const replyLengths = repliesList.map(t => t.text.length);
      saveVoice(db, userId, "reply_style", {
        avgLength: Math.round(replyLengths.reduce((s, l) => s + l, 0) / replyLengths.length),
        count: repliesList.length,
        pctOfTotal: Math.round((repliesList.length / tweets.length) * 100),
      });
      totalPatterns++;
    }
  }

  const duration = Date.now() - startTime;
  log.info(`Analysis complete for ${userId}`, { patterns: totalPatterns, durationMs: duration });

  return { patterns: totalPatterns };
}
