import { BaseCollector } from "./base.js";
import { getDb } from "../db/index.js";
import { config } from "../config.js";

export class SentimentCollector extends BaseCollector {
  name = "sentiment";

  protected async collect(): Promise<number> {
    if (!config.anthropicApiKey) {
      this.log.info("No ANTHROPIC_API_KEY set — skipping sentiment analysis");
      return 0;
    }

    const db = getDb();

    // Get unanalyzed mentions
    const unanalyzed = db.prepare(`
      SELECT tweet_id, text, author_handle
      FROM mentions
      WHERE sentiment IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `).all() as { tweet_id: string; text: string; author_handle: string | null }[];

    if (!unanalyzed.length) {
      this.log.info("No unanalyzed mentions");
      return 0;
    }

    // Batch analyze via Claude
    const batchText = unanalyzed.map((m, i) =>
      `[${i}] @${m.author_handle || "unknown"}: ${m.text}`
    ).join("\n");

    const prompt = `Analyze the sentiment of each tweet below. Each tweet mentions or is directed at a specific user.

Return ONLY a JSON array where each element has:
- "index": the number in brackets
- "sentiment": one of "positive", "neutral", "negative"
- "score": float from -1.0 (very negative) to 1.0 (very positive)

Tweets:
${batchText}

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
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.log.error("Claude API error", { status: response.status, body: err });
        return 0;
      }

      const data = await response.json() as {
        content: { type: string; text: string }[];
      };

      const text = data.content.find(c => c.type === "text")?.text || "";
      const cleaned = text.replace(/```json|```/g, "").trim();

      let results: { index: number; sentiment: string; score: number }[];
      try {
        results = JSON.parse(cleaned);
      } catch {
        this.log.error("Failed to parse sentiment response", { text: cleaned.substring(0, 200) });
        return 0;
      }

      const update = db.prepare(`
        UPDATE mentions SET sentiment = ?, sentiment_score = ? WHERE tweet_id = ?
      `);

      const updateAll = db.transaction(() => {
        let count = 0;
        for (const result of results) {
          if (result.index >= 0 && result.index < unanalyzed.length) {
            const mention = unanalyzed[result.index];
            update.run(result.sentiment, result.score, mention.tweet_id);
            count++;
          }
        }
        return count;
      });

      const count = updateAll();
      this.log.info("Sentiment analysis complete", { analyzed: count, total: unanalyzed.length });
      return count;
    } catch (err) {
      this.log.error("Sentiment analysis failed", { error: String(err) });
      return 0;
    }
  }
}
