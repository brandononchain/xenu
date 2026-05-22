import { BaseAnalyzer } from "./base.js";
import { PostingPatternAnalyzer } from "./posting-patterns.js";
import { EngagementGraphAnalyzer } from "./engagement-graph.js";
import { VoiceFingerprintAnalyzer } from "./voice-fingerprint.js";
import { HashtagAnalyzer } from "./hashtag-clusters.js";
import { ReplyChainAnalyzer } from "./reply-chains.js";
import { ContentPerformanceAnalyzer } from "./content-performance.js";

export const analyzers: Record<string, BaseAnalyzer> = {
  posting_patterns: new PostingPatternAnalyzer(),
  engagement_graph: new EngagementGraphAnalyzer(),
  voice_fingerprint: new VoiceFingerprintAnalyzer(),
  hashtag_clusters: new HashtagAnalyzer(),
  reply_chains: new ReplyChainAnalyzer(),
  content_performance: new ContentPerformanceAnalyzer(),
};

export async function runAnalyzer(name: string) {
  const analyzer = analyzers[name];
  if (!analyzer) throw new Error(`Unknown analyzer: ${name}`);
  return analyzer.run();
}

export async function runAllAnalyzers() {
  const results: Record<string, { patterns: number }> = {};

  const order = [
    "posting_patterns",
    "content_performance",
    "engagement_graph",
    "voice_fingerprint",
    "hashtag_clusters",
    "reply_chains",
  ];

  for (const name of order) {
    results[name] = await runAnalyzer(name);
  }

  return results;
}
