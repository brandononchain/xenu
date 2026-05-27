"use client";

import { useState, useEffect, useCallback } from "react";
import { api, apiPost, apiDelete, fmtNum, timeAgo } from "@/lib/api";

function useApi<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await api<T>(path);
    setData(result);
    setLoading(false);
  }, [path]);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, refresh };
}

// ── Shared Components ────────────────────────────────

function StatCard({ label, value, sub, pulse }: { label: string; value: string | number; sub?: string | null; pulse?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      {pulse && <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-[#00FF88] animate-[pulse_2s_ease-in-out_infinite]" />}
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1.5 truncate font-sans text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 truncate font-mono text-[11px] text-[#00FF88]">{sub}</div>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 border-b border-white/[0.06] pb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-white/35">{children}</h3>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 ${className}`}>{children}</div>;
}

function Empty({ msg }: { msg?: string }) {
  return <div className="p-5 text-center font-mono text-[11px] text-white/20">{msg || "No data yet — run collectors first"}</div>;
}

function BarRow({ label, value, max, color = "#00FF88", labelW = 80 }: { label: string; value: number; max: number; color?: string; labelW?: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 truncate font-mono text-[11px] text-white/40" style={{ width: labelW }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${color}44, ${color})` }} />
      </div>
      <span className="shrink-0 w-10 text-right font-mono text-[10px] text-white/40">{value}</span>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const pct = value > 1 ? value : value * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 w-20 capitalize font-mono text-[11px] text-white/40">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#00FF8844] to-[#00FF88]" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="shrink-0 w-8 text-right font-mono text-[11px] text-[#00FF88]">{Math.round(pct)}</span>
    </div>
  );
}

function TweetCard({ tweet }: { tweet: any }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
      <p className="mb-2 break-words text-[12px] leading-relaxed text-white/70">{tweet.text?.substring(0, 200)}</p>
      <div className="flex flex-wrap gap-3">
        <span className="font-mono text-[10px] text-white/30">♥ {tweet.likes || 0}</span>
        <span className="font-mono text-[10px] text-white/30">↻ {tweet.retweets || 0}</span>
        <span className="font-mono text-[10px] text-white/30">👁 {fmtNum(tweet.impressions)}</span>
        <span className="ml-auto hidden font-mono text-[10px] text-white/15 sm:inline">{tweet.tweet_type}</span>
      </div>
    </div>
  );
}

function Insight({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-lg border border-[#00FF8814] bg-[#00FF8808] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#00FF88]">{children}</div>;
}

// ── Tab: Overview ────────────────────────────────────

function OverviewTab() {
  const { data: status } = useApi<any>("/api/status");
  const { data: audience } = useApi<any>("/api/audience");
  const { data: tweets } = useApi<any>("/api/tweets?limit=5&type=original");

  const counts = status?.counts || {};
  const total = status?.totalDataPoints || 0;
  const aud = audience?.data || [];
  const topTweets = tweets?.data || [];
  const latest = aud[0];
  const prev = aud[7] || aud[aud.length - 1];
  const delta = latest && prev ? latest.followers - prev.followers : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Followers" value={latest ? fmtNum(latest.followers) : "—"} sub={delta != null ? `${delta >= 0 ? "+" : ""}${delta} recent` : null} pulse />
        <StatCard label="Tweets" value={fmtNum(counts.tweets)} sub="Collected" />
        <StatCard label="Mentions" value={fmtNum(counts.mentions)} sub="Tracked" />
        <StatCard label="Data Points" value={fmtNum(total)} sub={`${Object.keys(counts).length} sources`} pulse />
      </div>
      {topTweets.length > 0 ? (
        <Card>
          <SectionHeader>Recent Tweets</SectionHeader>
          <div className="space-y-2.5">{topTweets.map((t: any, i: number) => <TweetCard key={i} tweet={t} />)}</div>
        </Card>
      ) : (
        <Empty msg="No tweets collected yet. Authorize and run collectors to start." />
      )}
    </div>
  );
}

// ── Tab: Behavior ────────────────────────────────────

function BehaviorTab() {
  const { data: cp } = useApi<any>("/api/patterns?type=content_type");
  const { data: hp } = useApi<any>("/api/patterns?type=hashtag");
  const { data: rp } = useApi<any>("/api/patterns?type=reply_chain");
  const { data: tp } = useApi<any>("/api/patterns?type=posting_time");

  const typePerf = cp?.data?.find((p: any) => p.pattern_key === "performance")?.pattern_value || [];
  const hashFreq = hp?.data?.find((p: any) => p.pattern_key === "frequency")?.pattern_value || [];
  const replyDepth = rp?.data?.find((p: any) => p.pattern_key === "depth_distribution")?.pattern_value || {};
  const peakHours = tp?.data?.find((p: any) => p.pattern_key === "peak_hours")?.pattern_value || [];
  const maxEng = Math.max(...typePerf.map((t: any) => t.engagementRate || 0), 1);

  return (
    <div className="space-y-5">
      {typePerf.length > 0 ? (
        <Card>
          <SectionHeader>Content Type Performance</SectionHeader>
          <div className="space-y-2.5">
            {typePerf.sort((a: any, b: any) => (b.engagementRate || 0) - (a.engagementRate || 0)).map((ct: any, i: number) => (
              <BarRow key={i} label={ct.type} value={ct.engagementRate || 0} max={maxEng} />
            ))}
          </div>
        </Card>
      ) : <Empty msg="Run analysis to see content type performance" />}
      {hashFreq.length > 0 && (
        <Card>
          <SectionHeader>Hashtag Performance</SectionHeader>
          <div className="space-y-2">{hashFreq.slice(0, 10).map((h: any, i: number) => <BarRow key={i} label={`#${h.tag}`} value={h.count} max={hashFreq[0]?.count || 1} color="#00AAFF" labelW={100} />)}</div>
        </Card>
      )}
      {replyDepth.distribution && (
        <Card>
          <SectionHeader>Reply Chain Depth</SectionHeader>
          <div className="space-y-2">
            {Object.entries(replyDepth.distribution).map(([d, c]: any, i: number) => (
              <BarRow key={i} label={`Depth ${d}`} value={c} max={Math.max(...Object.values(replyDepth.distribution) as number[])} color="#AA66FF" labelW={60} />
            ))}
          </div>
          <p className="mt-2.5 font-mono text-[10px] text-white/25">Avg: {replyDepth.avgDepth} · Max: {replyDepth.maxDepth} · {replyDepth.totalConversations} conversations</p>
        </Card>
      )}
      {peakHours.length > 0 && <Insight>PEAK HOURS: {peakHours.map((h: any) => `${h.hour}:00 (${h.count})`).join(", ")}</Insight>}
    </div>
  );
}

// ── Tab: Network ─────────────────────────────────────

function NetworkTab() {
  const { data: eg } = useApi<any>("/api/engagement-graph");
  const { data: ch } = useApi<any>("/api/following/changes");
  const { data: ep } = useApi<any>("/api/patterns?type=engagement_target");

  const targets = eg?.data || [];
  const changes = ch?.data || [];
  const clusters = ep?.data?.find((p: any) => p.pattern_key === "clusters")?.pattern_value;
  const maxA = Math.max(...targets.map((t: any) => t.total_actions || 0), 1);

  return (
    <div className="space-y-5">
      {targets.length > 0 ? (
        <Card>
          <SectionHeader>Top Engagement Targets</SectionHeader>
          <div className="space-y-2">{targets.slice(0, 15).map((t: any, i: number) => <BarRow key={i} label={`@${t.handle}`} value={t.total_actions} max={maxA} labelW={110} />)}</div>
        </Card>
      ) : <Empty msg="No engagement data yet" />}
      {clusters && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Deep Relations" value={clusters.deepRelationships} sub={clusters.deepHandles?.slice(0, 3).join(", ")} />
          <StatCard label="One-Sided" value={clusters.oneSided} sub="You engage, they don't" />
        </div>
      )}
      {changes.length > 0 && (
        <Card>
          <SectionHeader>Recent Follow/Unfollow Activity</SectionHeader>
          <div className="space-y-1.5">
            {changes.slice(0, 10).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2.5 border-b border-white/[0.03] py-1.5">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.change_type === "follow" ? "bg-[#00FF88]" : "bg-red-500"}`} />
                <span className="font-mono text-[11px] text-white/60">{c.change_type === "follow" ? "Followed" : "Unfollowed"}</span>
                <span className="font-mono text-[11px] text-white">@{c.user_handle || c.user_id}</span>
                <span className="ml-auto font-mono text-[10px] text-white/20">{timeAgo(c.detected_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Voice ───────────────────────────────────────

function VoiceTab() {
  const { data: voice } = useApi<any>("/api/voice");
  const metrics: any = {};
  if (voice?.data) voice.data.forEach((m: any) => (metrics[m.metric] = m.value));
  const tone = metrics.tone || {};
  const vocab = metrics.vocabulary || {};
  const emoji = metrics.emoji_rate || {};
  const avgLen = metrics.avg_length || {};

  if (!Object.keys(metrics).length) return <Empty msg="Run analysis engine to generate voice fingerprint" />;

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader>Voice Fingerprint</SectionHeader>
        <div className="space-y-3">{["directness", "technical", "hype", "sarcasm"].map((k) => <Meter key={k} label={k} value={tone[k] || 0} />)}</div>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <SectionHeader>Top Vocabulary</SectionHeader>
          {vocab.topWords ? (
            <div className="flex flex-wrap gap-1.5">{vocab.topWords.slice(0, 15).map((w: any, i: number) => <span key={i} className="rounded-full border border-[#00FF8820] bg-[#00FF8810] px-2.5 py-0.5 font-mono text-[11px] text-[#00FF88]">{w.word || w}</span>)}</div>
          ) : <Empty msg="Not computed" />}
        </Card>
        <Card>
          <SectionHeader>Writing Metrics</SectionHeader>
          <div className="space-y-2.5">
            {([["Avg length", `${avgLen.average || "—"} chars`], ["Words/tweet", vocab.avgWordsPerTweet || "—"], ["Emoji rate", `${emoji.pctWithEmoji || 0}%`], ["Lexical diversity", vocab.lexicalDiversity || "—"]] as [string, any][]).map(([l, v], i) => (
              <div key={i} className="flex justify-between"><span className="font-mono text-[11px] text-white/40">{l}</span><span className="font-mono text-[11px] text-white">{v}</span></div>
            ))}
          </div>
        </Card>
      </div>
      {emoji.topEmojis?.length > 0 && (
        <Card>
          <SectionHeader>Top Emojis</SectionHeader>
          <div className="flex flex-wrap gap-3">{emoji.topEmojis.slice(0, 8).map((e: any, i: number) => <div key={i} className="text-center"><div className="text-2xl">{e.emoji}</div><div className="mt-1 font-mono text-[9px] text-white/30">{e.count}x</div></div>)}</div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Signals ─────────────────────────────────────

function SignalsTab() {
  const { data: sentiment } = useApi<any>("/api/sentiment");
  const summary = sentiment?.summary || [];
  const recent = sentiment?.recent || [];
  const total = summary.reduce((s: number, r: any) => s + r.count, 0);
  const pos = summary.find((s: any) => s.sentiment === "positive")?.count || 0;
  const neu = summary.find((s: any) => s.sentiment === "neutral")?.count || 0;
  const neg = summary.find((s: any) => s.sentiment === "negative")?.count || 0;
  const pp = total > 0 ? Math.round((pos / total) * 100) : 0;
  const np = total > 0 ? Math.round((neu / total) * 100) : 0;
  const ngp = total > 0 ? Math.round((neg / total) * 100) : 0;

  if (total === 0) return <Empty msg="No sentiment data — run sentiment collector with ANTHROPIC_API_KEY set" />;

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader>Mention Sentiment</SectionHeader>
        <div className="mb-3.5 flex flex-wrap gap-4">
          {[{ l: "Positive", v: pp, c: "#00FF88" }, { l: "Neutral", v: np, c: "rgba(255,255,255,0.4)" }, { l: "Negative", v: ngp, c: "#FF4444" }].map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm" style={{ background: s.c }} />
              <span className="font-mono text-[12px] font-semibold" style={{ color: s.c }}>{s.v}%</span>
              <span className="font-mono text-[10px] text-white/30">{s.l}</span>
            </div>
          ))}
        </div>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {pp > 0 && <div style={{ width: `${pp}%` }} className="rounded-l-full bg-[#00FF88]" />}
          {np > 0 && <div style={{ width: `${np}%` }} className="bg-white/10" />}
          {ngp > 0 && <div style={{ width: `${ngp}%` }} className="rounded-r-full bg-red-500" />}
        </div>
        <p className="mt-2 font-mono text-[10px] text-white/20">{total} mentions analyzed</p>
      </Card>
      {recent.length > 0 && (
        <Card>
          <SectionHeader>Recent Analyzed Mentions</SectionHeader>
          <div className="space-y-2">
            {recent.slice(0, 8).map((m: any, i: number) => {
              const sc = m.sentiment === "positive" ? "#00FF88" : m.sentiment === "negative" ? "#FF4444" : "rgba(255,255,255,0.3)";
              return (
                <div key={i} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="font-mono text-[11px] text-white">@{m.author_handle || "?"}</span>
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: sc }} />
                    <span className="font-mono text-[10px]" style={{ color: sc }}>{m.sentiment}</span>
                    <span className="ml-auto font-mono text-[9px] text-white/15">{timeAgo(m.created_at)}</span>
                  </div>
                  <p className="break-words text-[11px] leading-relaxed text-white/50">{m.text?.substring(0, 140)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Scan ────────────────────────────────────────

function ScanTab() {
  const [handle, setHandle] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const loadProfiles = useCallback(async () => {
    const res = await api<any>("/api/scans");
    setProfiles(res?.data || []);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  async function doScan() {
    if (!handle.trim()) return;
    setScanning(true);
    setScanResult(null);
    const res = await apiPost<any>(`/api/scan/${handle.replace(/^@/, "")}`);
    setScanResult(res);
    setScanning(false);
    if (res?.scan?.userId) await loadProfile(res.scan.userId);
    loadProfiles();
  }

  async function loadProfile(userId: string) {
    const res = await api<any>(`/api/scans/${userId}`);
    if (res?.profile) setSelected(res);
  }

  async function deleteScan(userId: string) {
    await apiDelete(`/api/scans/${userId}`);
    setSelected(null);
    loadProfiles();
  }

  const p = selected?.profile;
  const patterns = selected?.patterns || [];
  const voice = selected?.voice || [];
  const topTweets = selected?.topTweets || [];
  const gp = (type: string, key: string) => patterns.find((x: any) => x.pattern_type === type && x.pattern_key === key)?.pattern_value;
  const gv = (metric: string) => voice.find((x: any) => x.metric === metric)?.value;
  const perf = gp("content_perf", "summary");
  const typePerf = gp("content_type", "performance") || [];
  const tone = gv("tone") || {};
  const vocab = gv("vocabulary") || {};
  const avgLen = gv("avg_length") || {};
  const emoji = gv("emoji_rate") || {};
  const hashFreq = gp("hashtag", "frequency") || [];
  const peakHours = gp("posting_time", "peak_hours") || [];
  const velocity = gp("velocity", "analysis");
  const threads = gp("threads", "analysis");

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader>Scan External Profile</SectionHeader>
        <div className="flex flex-wrap gap-2.5">
          <input value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} placeholder="@handle" className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 font-mono text-[13px] text-white outline-none focus:border-[#00FF8840]" />
          <button onClick={doScan} disabled={scanning || !handle.trim()} className="rounded-lg bg-[#00FF88] px-5 py-2.5 font-mono text-[12px] font-semibold text-[#050505] disabled:cursor-wait disabled:opacity-40">{scanning ? "Scanning..." : "Scan"}</button>
        </div>
        {scanning && <p className="mt-3 font-mono text-[11px] text-white/30">Fetching tweets and running analysis... 15-30 seconds.</p>}
        {scanResult && !scanning && (
          <div className={`mt-3 rounded-lg border px-3.5 py-2.5 font-mono text-[11px] ${scanResult.scan?.status === "complete" ? "border-[#00FF8814] bg-[#00FF8808] text-[#00FF88]" : "border-red-500/10 bg-red-500/[0.04] text-red-400"}`}>
            {scanResult.scan?.status === "complete" ? `Collected ${scanResult.scan?.tweetsCollected} tweets, ${scanResult.analysis?.patterns || 0} patterns in ${(scanResult.durationMs / 1000).toFixed(1)}s` : `Error: ${scanResult.scan?.error || "Unknown"}`}
          </div>
        )}
      </Card>

      {profiles.length > 0 && (
        <Card>
          <SectionHeader>Scanned Profiles ({profiles.length})</SectionHeader>
          <div className="space-y-1.5">
            {profiles.map((pr: any, i: number) => (
              <div key={i} onClick={() => loadProfile(pr.user_id)} className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border p-2.5 transition-all ${p?.user_id === pr.user_id ? "border-[#00FF8820] bg-[#00FF880A]" : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <div className="min-w-[100px] flex-1">
                  <div className="font-mono text-[12px] text-white">@{pr.handle}</div>
                  <div className="font-mono text-[10px] text-white/30">{pr.name}</div>
                </div>
                <span className="font-mono text-[10px] text-white/30">{fmtNum(pr.followers)} followers</span>
                <span className="font-mono text-[9px] text-white/15">{timeAgo(pr.last_scanned)}</span>
                <div className={`h-1.5 w-1.5 rounded-full ${pr.status === "complete" ? "bg-[#00FF88]" : pr.status === "scanning" ? "bg-yellow-400" : "bg-red-500"}`} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {p && (
        <>
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{p.name}</div>
                <div className="font-mono text-[12px] text-white/40">@{p.handle}</div>
                {p.bio && <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-white/50">{p.bio}</p>}
              </div>
              <button onClick={() => deleteScan(p.user_id)} className="rounded-md border border-red-500/15 bg-red-500/[0.04] px-3 py-1.5 font-mono text-[10px] text-red-400">Delete</button>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Followers" value={fmtNum(p.followers)} />
              <StatCard label="Following" value={fmtNum(p.following)} />
              <StatCard label="Tweets" value={fmtNum(p.tweet_count)} />
              <StatCard label="Collected" value={fmtNum(selected?.tweetCount)} />
            </div>
          </Card>
          {perf && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Avg Likes" value={perf.avgLikes} />
              <StatCard label="Avg RTs" value={perf.avgRetweets} />
              <StatCard label="Avg Impressions" value={fmtNum(perf.avgImpressions)} />
              <StatCard label="Eng Rate" value={`${perf.overallEngRate}%`} sub={`${perf.totalTweets} tweets`} />
            </div>
          )}
          {velocity && <Insight>VELOCITY: {velocity.trend?.toUpperCase()} · Like ratio: {velocity.ratio?.likes}x · Stage: {velocity.stage}{velocity.breakouts?.length ? ` · ${velocity.breakouts.length} breakouts` : ""}</Insight>}
          {threads && <Insight>THREADS: {threads.threadCount} threads ({threads.threadPct}%) · Avg: {threads.avgThreadLength} tweets · Multiplier: {threads.threadMultiplier?.likes}x likes</Insight>}
          {tone.directness != null && (
            <Card>
              <SectionHeader>Voice Fingerprint</SectionHeader>
              <div className="space-y-2.5">{["directness", "technical", "hype", "sarcasm"].map((k) => <Meter key={k} label={k} value={tone[k] || 0} />)}</div>
            </Card>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {typePerf.length > 0 && (
              <Card>
                <SectionHeader>Content Types</SectionHeader>
                <div className="space-y-2">{typePerf.sort((a: any, b: any) => (b.engagementRate || 0) - (a.engagementRate || 0)).map((ct: any, i: number) => <BarRow key={i} label={ct.type} value={ct.engagementRate || 0} max={Math.max(...typePerf.map((t: any) => t.engagementRate || 0))} labelW={60} />)}</div>
              </Card>
            )}
            {hashFreq.length > 0 && (
              <Card>
                <SectionHeader>Top Hashtags</SectionHeader>
                <div className="space-y-2">{hashFreq.slice(0, 8).map((h: any, i: number) => <BarRow key={i} label={`#${h.tag}`} value={h.count} max={hashFreq[0]?.count || 1} color="#00AAFF" labelW={90} />)}</div>
              </Card>
            )}
          </div>
          {vocab.topWords?.length > 0 && (
            <Card>
              <SectionHeader>Top Vocabulary</SectionHeader>
              <div className="flex flex-wrap gap-1.5">{vocab.topWords.slice(0, 15).map((w: any, i: number) => <span key={i} className="rounded-full border border-[#00FF8820] bg-[#00FF8810] px-2.5 py-0.5 font-mono text-[10px] text-[#00FF88]">{w.word || w}</span>)}</div>
            </Card>
          )}
          {topTweets.length > 0 && (
            <Card>
              <SectionHeader>Top Tweets by Likes</SectionHeader>
              <div className="space-y-2">{topTweets.map((t: any, i: number) => <TweetCard key={i} tweet={t} />)}</div>
            </Card>
          )}
          {peakHours.length > 0 && <Insight>PEAK HOURS: {peakHours.map((h: any) => `${h.hour}:00 UTC (${h.count})`).join(", ")}</Insight>}
        </>
      )}
    </div>
  );
}

// ── Tab: Collectors ──────────────────────────────────

function CollectorsTab() {
  const { data: status, refresh } = useApi<any>("/api/status");
  const [triggering, setTriggering] = useState<string | null>(null);

  const collectors = status?.collectors || [];
  const counts = status?.counts || {};

  async function trigger(name: string) {
    setTriggering(name);
    await apiPost(`/api/collect/${name}`);
    setTriggering(null);
    refresh();
  }

  async function triggerAnalysis() {
    setTriggering("analyze");
    await apiPost("/api/analyze/all");
    setTriggering(null);
    refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader>Collector Status</SectionHeader>
        <div className="space-y-1.5">
          {collectors.length > 0 ? collectors.map((c: any, i: number) => {
            const color = c.status === "success" ? "bg-[#00FF88]" : c.status === "error" ? "bg-red-500" : "bg-yellow-400";
            return (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
                  <span className="font-mono text-[12px] capitalize text-white">{c.collector}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-white/40">{fmtNum(c.records_collected)}</span>
                  <span className="font-mono text-[10px] text-white/25">{timeAgo(c.finished_at || c.started_at)}</span>
                </div>
              </div>
            );
          }) : <Empty msg="No collectors have run yet" />}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <SectionHeader>Record Counts</SectionHeader>
          <div className="space-y-2">{Object.entries(counts).map(([k, v]: any, i) => (
            <div key={i} className="flex justify-between border-b border-white/[0.03] py-1"><span className="font-mono text-[11px] capitalize text-white/40">{k.replace(/_/g, " ")}</span><span className="font-mono text-[11px] text-white">{fmtNum(v)}</span></div>
          ))}</div>
        </Card>
        <Card>
          <SectionHeader>Manual Triggers</SectionHeader>
          <div className="space-y-1.5">
            {["all", "timeline", "engagement", "mentions", "audience", "following", "bookmarks", "sentiment"].map((n) => (
              <button key={n} onClick={() => trigger(n)} disabled={triggering != null} className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left font-mono text-[11px] capitalize text-white/50 transition-all hover:bg-[#00FF8808] hover:text-[#00FF88] disabled:cursor-wait disabled:opacity-50">
                {triggering === n ? `Running ${n}...` : `▶ ${n}`}
              </button>
            ))}
            <div className="my-1 h-px bg-white/[0.06]" />
            <button onClick={triggerAnalysis} disabled={triggering != null} className="w-full rounded-md border border-[#00FF8820] bg-[#00FF8808] px-3 py-2 text-left font-mono text-[11px] text-[#00FF88] transition-all hover:bg-[#00FF8815] disabled:cursor-wait disabled:opacity-50">
              {triggering === "analyze" ? "Running..." : "⚡ Run Analysis Engine"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "behavior", label: "Behavior" },
  { id: "network", label: "Network" },
  { id: "voice", label: "Voice" },
  { id: "signals", label: "Signals" },
  { id: "scan", label: "Scan" },
  { id: "collectors", label: "Collectors" },
];

export default function Dashboard() {
  const [tab, setTab] = useState("overview");
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    api<any>("/auth/status").then((r) => setAuth(r?.authenticated || false));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed -top-52 -right-52 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,255,136,0.05),transparent_70%)]" />
      <div className="pointer-events-none fixed -bottom-72 -left-24 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,170,255,0.04),transparent_70%)]" />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#050505]/85 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00FF8833] bg-gradient-to-br from-[#00FF8822] to-[#00FF8808] text-base">𝕏</div>
          <span className="text-base font-bold" style={{ textShadow: "0 0 10px rgba(0,255,136,0.27)" }}>Xenu</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${auth ? "bg-[#00FF88] shadow-[0_0_8px_#00FF88]" : auth === false ? "bg-red-500" : "bg-white/20"}`} />
          <a href="/docs" className="font-mono text-[11px] text-white/40 hover:text-[#00FF88]">Docs</a>
        </div>
      </header>

      {/* Auth banner */}
      {auth === false && (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-6 py-2.5 font-mono text-[11px]">
          <span className="text-red-400">Not authenticated. </span>
          <a href="/auth/login" className="text-[#00FF88] hover:underline">Connect your X account →</a>
        </div>
      )}

      {/* Tabs */}
      <nav className="flex gap-0 overflow-x-auto border-b border-white/[0.06] px-6 scrollbar-none">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 border-b-2 px-4 py-3 font-mono text-[11px] tracking-wide transition-all ${tab === t.id ? "border-[#00FF88] text-[#00FF88]" : "border-transparent text-white/30 hover:text-white/50"}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="px-6 py-6 pb-16">
        {tab === "overview" && <OverviewTab />}
        {tab === "behavior" && <BehaviorTab />}
        {tab === "network" && <NetworkTab />}
        {tab === "voice" && <VoiceTab />}
        {tab === "signals" && <SignalsTab />}
        {tab === "scan" && <ScanTab />}
        {tab === "collectors" && <CollectorsTab />}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-white/[0.04] bg-[#050505]/90 px-6 py-2 backdrop-blur-xl">
        <span className="font-mono text-[10px] text-white/20">xenu v0.1.0</span>
        <span className={`font-mono text-[10px] ${auth ? "text-[#00FF8866]" : "text-red-400/40"}`}>{auth ? "connected" : auth === false ? "disconnected" : "..."}</span>
      </footer>
    </div>
  );
}
