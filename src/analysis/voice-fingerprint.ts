import { BaseAnalyzer } from "./base.js";

interface TweetRow {
  id: string;
  text: string;
  tweet_type: string;
  likes: number;
  impressions: number;
}

export class VoiceFingerprintAnalyzer extends BaseAnalyzer {
  name = "voice_fingerprint";

  protected async analyze(): Promise<number> {
    // Only analyze original tweets and quotes (not retweets)
    const tweets = this.db.prepare(
      "SELECT id, text, tweet_type, likes, impressions FROM tweets WHERE tweet_type IN ('original', 'quote', 'reply') ORDER BY created_at DESC LIMIT 300"
    ).all() as TweetRow[];

    if (tweets.length < 10) {
      this.log.info("Not enough tweets for voice analysis", { count: tweets.length });
      return 0;
    }

    const originals = tweets.filter(t => t.tweet_type === "original" || t.tweet_type === "quote");
    const replies = tweets.filter(t => t.tweet_type === "reply");
    let metrics = 0;

    // ── 1. Length distribution ───────────────────────────────
    const lengths = originals.map(t => t.text.length);
    const avgLength = Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length);
    const medianLength = lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)];

    const lengthBuckets = {
      short: lengths.filter(l => l < 80).length,
      medium: lengths.filter(l => l >= 80 && l < 200).length,
      long: lengths.filter(l => l >= 200).length,
    };

    this.saveVoiceMetric("avg_length", {
      average: avgLength,
      median: medianLength,
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      distribution: lengthBuckets,
      sampleSize: originals.length,
    });
    metrics++;

    // ── 2. Vocabulary analysis ──────────────────────────────
    const allWords = originals
      .map(t => t.text.toLowerCase())
      .join(" ")
      .replace(/https?:\/\/\S+/g, "") // remove URLs
      .replace(/@\w+/g, "") // remove mentions
      .replace(/[^\w\s]/g, "") // remove punctuation
      .split(/\s+/)
      .filter(w => w.length > 2);

    const wordFreq: Record<string, number> = {};
    for (const w of allWords) wordFreq[w] = (wordFreq[w] || 0) + 1;

    const uniqueWords = Object.keys(wordFreq).length;
    const totalWords = allWords.length;
    const lexicalDiversity = Math.round((uniqueWords / totalWords) * 1000) / 1000;

    // Top words (excluding common stop words)
    const stopWords = new Set([
      "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
      "her", "was", "one", "our", "out", "has", "have", "been", "that", "this",
      "with", "will", "your", "from", "they", "been", "more", "when", "very",
      "what", "just", "about", "into", "than", "them", "then", "some", "also",
      "its", "like", "how", "get", "got", "going", "would", "could", "should",
      "make", "way", "too", "any", "know", "need", "want", "think", "see",
    ]);

    const topWords = Object.entries(wordFreq)
      .filter(([w]) => !stopWords.has(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({ word, count, freq: Math.round((count / totalWords) * 10000) / 100 }));

    this.saveVoiceMetric("vocabulary", {
      uniqueWords,
      totalWords,
      lexicalDiversity,
      topWords,
      avgWordsPerTweet: Math.round(totalWords / originals.length),
    });
    metrics++;

    // ── 3. Tone markers ─────────────────────────────────────
    const allTexts = tweets.map(t => t.text);

    const toneSignals = {
      questions: allTexts.filter(t => t.includes("?")).length,
      exclamations: allTexts.filter(t => t.includes("!")).length,
      allCaps: allTexts.filter(t => /[A-Z]{3,}/.test(t)).length,
      emojis: allTexts.filter(t => /[\u{1F600}-\u{1F9FF}]/u.test(t)).length,
      threads: allTexts.filter(t => /^(\d+[\.\)\/]|🧵)/.test(t)).length,
      links: allTexts.filter(t => /https?:\/\//.test(t)).length,
      hashtags: allTexts.filter(t => /#\w+/.test(t)).length,
      mentions: allTexts.filter(t => /@\w+/.test(t)).length,
    };

    const tonePcts: Record<string, number> = {};
    for (const [k, v] of Object.entries(toneSignals)) {
      tonePcts[k] = Math.round((v / allTexts.length) * 100);
    }

    // Directness score: short sentences, few hedging words, imperative mood
    const hedgeWords = ["maybe", "perhaps", "possibly", "might", "could", "seems", "apparently", "i think", "i guess", "i feel like"];
    const directWords = ["is", "will", "must", "need", "should", "build", "ship", "launch", "let's", "here's"];
    const lowerTexts = allTexts.map(t => t.toLowerCase());
    const hedgeCount = lowerTexts.filter(t => hedgeWords.some(h => t.includes(h))).length;
    const directCount = lowerTexts.filter(t => directWords.some(d => t.includes(d))).length;
    const directnessScore = Math.round(((directCount - hedgeCount) / allTexts.length + 0.5) * 100);

    // Technical score: code, acronyms, technical terms
    const techTerms = ["api", "sdk", "deploy", "ship", "stack", "infra", "protocol", "chain", "token", "contract", "node", "rust", "typescript", "solidity", "agent", "llm", "model", "vector", "embedding"];
    const techCount = lowerTexts.filter(t => techTerms.some(term => t.includes(term))).length;
    const technicalScore = Math.min(100, Math.round((techCount / allTexts.length) * 200));

    // Hype score: superlatives, excitement markers
    const hypeTerms = ["🔥", "🚀", "insane", "incredible", "massive", "huge", "game changer", "bullish", "lfg", "gm", "wagmi", "lets go"];
    const hypeCount = lowerTexts.filter(t => hypeTerms.some(h => t.includes(h))).length;
    const hypeScore = Math.min(100, Math.round((hypeCount / allTexts.length) * 200));

    // Sarcasm/wit indicators
    const sarcasmMarkers = ["lol", "lmao", "bruh", "imagine", "literally", "apparently", "somehow", "wild", "insane", "yeah no"];
    const sarcasmCount = lowerTexts.filter(t => sarcasmMarkers.some(m => t.includes(m))).length;
    const sarcasmScore = Math.min(100, Math.round((sarcasmCount / allTexts.length) * 200));

    this.saveVoiceMetric("tone", {
      signals: toneSignals,
      percentages: tonePcts,
      directness: Math.min(100, Math.max(0, directnessScore)),
      technical: technicalScore,
      hype: hypeScore,
      sarcasm: sarcasmScore,
      sampleSize: allTexts.length,
    });
    metrics++;

    // ── 4. Sentence structure ───────────────────────────────
    const sentenceLengths: number[] = [];
    const starterPatterns: Record<string, number> = {};

    for (const t of originals) {
      const sentences = t.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      for (const s of sentences) {
        const words = s.trim().split(/\s+/);
        sentenceLengths.push(words.length);

        // Track opening patterns
        if (words.length > 0) {
          const starter = words[0].toLowerCase();
          starterPatterns[starter] = (starterPatterns[starter] || 0) + 1;
        }
      }
    }

    const avgSentenceLength = sentenceLengths.length > 0
      ? Math.round(sentenceLengths.reduce((s, l) => s + l, 0) / sentenceLengths.length * 10) / 10
      : 0;

    const topStarters = Object.entries(starterPatterns)
      .filter(([w]) => w.length > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    this.saveVoiceMetric("structure", {
      avgSentenceLength,
      sentenceBuckets: {
        short: sentenceLengths.filter(l => l <= 5).length,
        medium: sentenceLengths.filter(l => l > 5 && l <= 15).length,
        long: sentenceLengths.filter(l => l > 15).length,
      },
      topStarters,
      avgSentencesPerTweet: originals.length > 0
        ? Math.round((sentenceLengths.length / originals.length) * 10) / 10
        : 0,
    });
    metrics++;

    // ── 5. Reply style (how you respond to others) ──────────
    if (replies.length >= 5) {
      const replyLengths = replies.map(t => t.text.length);
      const avgReplyLength = Math.round(replyLengths.reduce((s, l) => s + l, 0) / replyLengths.length);

      this.saveVoiceMetric("reply_style", {
        avgLength: avgReplyLength,
        count: replies.length,
        pctOfTotal: Math.round((replies.length / tweets.length) * 100),
        lengthVsOriginal: originals.length > 0
          ? Math.round((avgReplyLength / avgLength) * 100)
          : 0,
      });
      metrics++;
    }

    // ── 6. Emoji usage ──────────────────────────────────────
    const emojiRegex = /[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;
    const emojiCounts: Record<string, number> = {};
    let totalEmojis = 0;

    for (const t of allTexts) {
      const matches = t.match(emojiRegex);
      if (matches) {
        totalEmojis += matches.length;
        for (const e of matches) emojiCounts[e] = (emojiCounts[e] || 0) + 1;
      }
    }

    const topEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([emoji, count]) => ({ emoji, count }));

    this.saveVoiceMetric("emoji_rate", {
      totalEmojis,
      tweetsWithEmoji: allTexts.filter(t => emojiRegex.test(t)).length,
      pctWithEmoji: Math.round((allTexts.filter(t => emojiRegex.test(t)).length / allTexts.length) * 100),
      avgPerTweet: Math.round((totalEmojis / allTexts.length) * 100) / 100,
      topEmojis,
    });
    metrics++;

    return metrics;
  }
}
