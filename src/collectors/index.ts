import { BaseCollector } from "./base.js";
import { TimelineCollector } from "./timeline.js";
import { EngagementCollector } from "./engagement.js";
import { FollowingCollector } from "./following.js";
import { MentionsCollector } from "./mentions.js";
import { AudienceCollector } from "./audience.js";
import { BookmarksCollector } from "./bookmarks.js";
import { SentimentCollector } from "./sentiment.js";

export const collectors: Record<string, BaseCollector> = {
  timeline: new TimelineCollector(),
  engagement: new EngagementCollector(),
  following: new FollowingCollector(),
  mentions: new MentionsCollector(),
  audience: new AudienceCollector(),
  bookmarks: new BookmarksCollector(),
  sentiment: new SentimentCollector(),
};

export type CollectorName = keyof typeof collectors;

export async function runCollector(name: string) {
  const collector = collectors[name];
  if (!collector) throw new Error(`Unknown collector: ${name}`);
  return collector.run();
}

export async function runAllCollectors() {
  const results: Record<string, { collected: number; errors: string[] }> = {};

  // Run in order: audience first (cheapest), then data collectors, then analysis
  const order: string[] = [
    "audience",
    "timeline",
    "engagement",
    "following",
    "mentions",
    "bookmarks",
    "sentiment", // runs after mentions so it has data to analyze
  ];

  for (const name of order) {
    results[name] = await runCollector(name);
    // Small delay between collectors to be gentle on rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}
