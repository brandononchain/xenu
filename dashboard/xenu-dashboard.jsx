import { useState, useEffect, useRef, useCallback } from "react";

const XG = "#00FF88";
const API = "http://localhost:3400";
const mono = "'JetBrains Mono', monospace";
const sans = "'Space Grotesk', sans-serif";

// ─── API Layer ──────────────────────────────────────────

async function api(path) {
  try {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function apiPost(path) {
  try {
    const res = await fetch(`${API}${path}`, { method: "POST" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await api(path);
    setData(result);
    setLoading(false);
  }, [path]);
  useEffect(() => { refresh(); }, deps);
  return { data, loading, refresh };
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Shared Components ──────────────────────────────────

function GlitchText({ children }) {
  return <span style={{ textShadow: `0 0 10px ${XG}44, 0 0 20px ${XG}22` }}>{children}</span>;
}

function StatCard({ label, value, sub, pulse = false }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "16px 16px", position: "relative", overflow: "hidden", minWidth: 0,
    }}>
      {pulse && <div style={{ position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: "50%", background: XG, animation: "pulse 2s ease-in-out infinite" }} />}
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: mono }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 6, fontFamily: sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: XG, marginTop: 4, fontFamily: mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <h3 style={{
      fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
      color: "rgba(255,255,255,0.35)", fontFamily: mono,
      margin: "0 0 16px 0", padding: "0 0 8px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>{children}</h3>
  );
}

function InsightBox({ children }) {
  return (
    <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,255,136,0.04)", borderRadius: 8, border: "1px solid rgba(0,255,136,0.08)" }}>
      <span style={{ fontSize: 11, color: XG, fontFamily: mono, lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function Card({ children, style: s = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "20px 16px", ...s,
    }}>{children}</div>
  );
}

function Loader() {
  return <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: mono, padding: 20, textAlign: "center" }}>Loading...</div>;
}

function EmptyState({ msg }) {
  return <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: mono, padding: 20, textAlign: "center" }}>{msg || "No data yet — run collectors first"}</div>;
}

function HeatmapBar({ data }) {
  if (!data || !data.length) return <EmptyState msg="No posting data" />;
  const max = Math.max(...data.map(d => d.count));
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
      {data.map((d, i) => {
        const intensity = max > 0 ? d.count / max : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: "100%", height: `${Math.max(4, intensity * 60)}px`,
              background: `rgba(0, 255, 136, ${0.15 + intensity * 0.7})`,
              borderRadius: 3, transition: "all 0.3s ease",
            }} />
            {i % 6 === 0 && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>{d.hour}h</span>}
          </div>
        );
      })}
    </div>
  );
}

function MiniLineChart({ data, dataKey, color = XG, height = 60 }) {
  if (!data || data.length < 2) return <EmptyState msg="Not enough data points" />;
  const values = data.map(d => d[dataKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 320;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${height} ${points} ${w},${height}`;
  const gradId = `grad-${dataKey}-${color.replace('#', '')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VoiceMeter({ label, value }) {
  const pct = typeof value === "number" ? (value > 1 ? value : value * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: mono, width: 80, flexShrink: 0, textTransform: "capitalize" }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: `linear-gradient(90deg, ${XG}44, ${XG})`, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: XG, fontFamily: mono, width: 30, textAlign: "right", flexShrink: 0 }}>{Math.round(pct)}</span>
    </div>
  );
}

function BarRow({ label, value, maxValue, color = XG, suffix = "", labelWidth = 80 }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: mono, width: labelWidth, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: `linear-gradient(90deg, ${color}44, ${color})`, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono, width: 40, textAlign: "right", flexShrink: 0 }}>{value}{suffix}</span>
    </div>
  );
}

function CollectorRow({ name, status, records, lastRun }) {
  const sc = { success: XG, running: "#FFAA00", error: "#FF4444", partial: "#FFAA00" };
  const statusColor = sc[status] || "rgba(255,255,255,0.3)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 100 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, boxShadow: status === "running" ? `0 0 8px ${statusColor}` : "none", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#fff", fontFamily: mono, textTransform: "capitalize" }}>{name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>{fmtNum(records)}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: mono }}>{timeAgo(lastRun)}</span>
      </div>
    </div>
  );
}

// ─── Profile Dropdown ───────────────────────────────────

function ProfileDropdown({ status }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const audience = status?.counts || {};
  const handle = "@brandononchain";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px",
        background: open ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, cursor: "pointer",
        transition: "all 0.2s ease",
      }}>
        <img src="https://api.dicebear.com/9.x/notionists/svg?seed=brandon&backgroundColor=0a0a0a" alt="" style={{ width: 24, height: 24, borderRadius: 6, background: "#111" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: mono, display: "var(--show-handle, none)" }}>{handle}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" style={{ opacity: 0.4, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
          <path d="M1 1L5 5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: "min(320px, 90vw)",
          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, overflow: "hidden", zIndex: 200,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,255,136,0.03)",
          animation: "fadeIn 0.15s ease",
        }}>
          <div style={{ height: 48, background: `linear-gradient(135deg, ${XG}12, #00AAFF08, transparent)`, position: "relative" }}>
            <div style={{ position: "absolute", bottom: -18, left: 16, width: 40, height: 40, borderRadius: 12, border: "3px solid #0a0a0a", overflow: "hidden", background: "#111" }}>
              <img src="https://api.dicebear.com/9.x/notionists/svg?seed=brandon&backgroundColor=0a0a0a" alt="" style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
          </div>
          <div style={{ padding: "24px 16px 12px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: sans }}>Brandon</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: mono, marginTop: 2 }}>{handle}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 8, lineHeight: 1.5 }}>CBDO @ALTABlockchain · Building @Lobstack_ai</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>
            {[
              { label: "Tweets", val: fmtNum(audience.tweets) },
              { label: "Engages", val: fmtNum(audience.engagements) },
              { label: "Mentions", val: fmtNum(audience.mentions) },
              { label: "Bookmarks", val: fmtNum(audience.bookmarks) },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: sans }}>{s.val}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: mono }}>Total data points: {fmtNum(status?.totalDataPoints)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Overview ──────────────────────────────────────

function OverviewTab() {
  const { data: status, loading: sLoad } = useApi("/api/status");
  const { data: audience } = useApi("/api/audience");
  const { data: tweets } = useApi("/api/tweets?limit=5&type=original");
  const { data: patterns } = useApi("/api/patterns?type=posting_time");

  if (sLoad) return <Loader />;

  const counts = status?.counts || {};
  const totalPoints = status?.totalDataPoints || 0;
  const audData = audience?.data || [];
  const topTweets = tweets?.data || [];
  const heatmapPattern = patterns?.data?.find(p => p.pattern_key === "heatmap");

  // Build posting hour data from heatmap pattern
  let hourData = [];
  if (heatmapPattern) {
    const hm = heatmapPattern.pattern_value;
    for (let h = 0; h < 24; h++) {
      let count = 0;
      for (let d = 0; d < 7; d++) count += (hm[`${d}-${h}`] || 0);
      hourData.push({ hour: h, count });
    }
  }

  // Latest audience for follower count
  const latestAud = audData.length > 0 ? audData[0] : null;
  const prevAud = audData.length > 7 ? audData[7] : audData[audData.length - 1];
  const followerDelta = latestAud && prevAud ? latestAud.followers - prevAud.followers : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="grid-4">
        <StatCard label="Followers" value={latestAud ? fmtNum(latestAud.followers) : "—"} sub={followerDelta != null ? `${followerDelta >= 0 ? "+" : ""}${followerDelta} recent` : null} pulse />
        <StatCard label="Tweets" value={fmtNum(counts.tweets)} sub="Collected" />
        <StatCard label="Mentions" value={fmtNum(counts.mentions)} sub="Tracked" />
        <StatCard label="Data Points" value={fmtNum(totalPoints)} sub={`${Object.keys(counts).length} sources`} pulse />
      </div>

      <div className="grid-2">
        <Card>
          <SectionHeader>Audience Growth</SectionHeader>
          <MiniLineChart data={[...audData].reverse()} dataKey="followers" height={70} />
          {audData.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {[...audData].reverse().filter((_, i) => i % Math.ceil(audData.length / 4) === 0).map((d, i) => (
                <span key={i} style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: mono }}>{d.date}</span>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionHeader>Following Count</SectionHeader>
          <MiniLineChart data={[...audData].reverse()} dataKey="following" color="#00AAFF" height={70} />
          {audData.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {[...audData].reverse().filter((_, i) => i % Math.ceil(audData.length / 4) === 0).map((d, i) => (
                <span key={i} style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: mono }}>{d.date}</span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {hourData.length > 0 && (
        <Card>
          <SectionHeader>Posting Activity by Hour (UTC)</SectionHeader>
          <HeatmapBar data={hourData} />
        </Card>
      )}

      {topTweets.length > 0 && (
        <Card>
          <SectionHeader>Recent Tweets</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topTweets.map((t, i) => (
              <div key={i} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, marginBottom: 8, wordBreak: "break-word" }}>{t.text?.substring(0, 200)}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>♥ {t.likes}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>↻ {t.retweets}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>👁 {fmtNum(t.impressions)}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: mono, marginLeft: "auto" }}>{t.tweet_type}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {topTweets.length === 0 && !sLoad && <EmptyState msg="No tweets collected yet. Authorize and run collectors to start." />}
    </div>
  );
}

// ─── Tab: Behavior ──────────────────────────────────────

function BehaviorTab() {
  const { data: contentPerf } = useApi("/api/patterns?type=content_type");
  const { data: hashPatterns } = useApi("/api/patterns?type=hashtag");
  const { data: replyPatterns } = useApi("/api/patterns?type=reply_chain");
  const { data: postingTime } = useApi("/api/patterns?type=posting_time");

  const typePerf = contentPerf?.data?.find(p => p.pattern_key === "performance")?.pattern_value || [];
  const hashFreq = hashPatterns?.data?.find(p => p.pattern_key === "frequency")?.pattern_value || [];
  const replyDepth = replyPatterns?.data?.find(p => p.pattern_key === "depth_distribution")?.pattern_value || {};
  const peakHours = postingTime?.data?.find(p => p.pattern_key === "peak_hours")?.pattern_value || [];

  const maxEng = Math.max(...typePerf.map(t => t.engagementRate || 0), 1);
  const maxHashEng = Math.max(...hashFreq.map(h => h.engagementRate || h.avgLikes || 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {typePerf.length > 0 ? (
        <Card>
          <SectionHeader>Content Type Performance</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {typePerf.sort((a, b) => (b.engagementRate || 0) - (a.engagementRate || 0)).map((ct, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: mono, width: 70, flexShrink: 0, textTransform: "capitalize" }}>{ct.type}</span>
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(ct.engagementRate / maxEng) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${XG}44, ${XG})`, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, color: XG, fontFamily: mono, width: 45, textAlign: "right", flexShrink: 0 }}>{ct.engagementRate}%</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: mono, width: 40, textAlign: "right", flexShrink: 0, display: "var(--show-detail, block)" }}>{ct.count}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : <EmptyState msg="Run analysis to see content type performance" />}

      {hashFreq.length > 0 && (
        <Card>
          <SectionHeader>Hashtag Performance</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hashFreq.slice(0, 10).map((h, i) => (
              <BarRow key={i} label={`#${h.tag}`} value={h.count} maxValue={hashFreq[0]?.count || 1} color="#00AAFF" suffix="" labelWidth={100} />
            ))}
          </div>
        </Card>
      )}

      {Object.keys(replyDepth).length > 0 && replyDepth.distribution && (
        <Card>
          <SectionHeader>Reply Chain Depth</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(replyDepth.distribution).map(([depth, count], i) => (
              <BarRow key={i} label={`Depth ${depth}`} value={count} maxValue={Math.max(...Object.values(replyDepth.distribution))} color="#AA66FF" labelWidth={60} />
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: mono }}>
            Avg: {replyDepth.avgDepth} · Max: {replyDepth.maxDepth} · {replyDepth.totalConversations} conversations
          </div>
        </Card>
      )}

      {peakHours.length > 0 && (
        <InsightBox>PEAK HOURS: {peakHours.map(h => `${h.hour}:00 (${h.count} tweets)`).join(", ")}</InsightBox>
      )}
    </div>
  );
}

// ─── Tab: Network ───────────────────────────────────────

function NetworkTab() {
  const { data: engGraph } = useApi("/api/engagement-graph");
  const { data: changes } = useApi("/api/following/changes");
  const { data: engPatterns } = useApi("/api/patterns?type=engagement_target");

  const targets = engGraph?.data || [];
  const followChanges = changes?.data || [];
  const clusters = engPatterns?.data?.find(p => p.pattern_key === "clusters")?.pattern_value;
  const maxActions = Math.max(...targets.map(t => t.total_actions || 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {targets.length > 0 ? (
        <Card>
          <SectionHeader>Top Engagement Targets</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {targets.slice(0, 15).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span style={{ fontSize: 11, color: "#fff", fontFamily: mono, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{t.handle}</span>
                <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(t.total_actions / maxActions) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${XG}44, ${XG})`, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono, width: 30, textAlign: "right", flexShrink: 0 }}>{t.total_actions}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : <EmptyState msg="No engagement data yet" />}

      {clusters && (
        <div className="grid-2">
          <StatCard label="Deep Relations" value={clusters.deepRelationships} sub={clusters.deepHandles?.slice(0, 3).join(", ")} />
          <StatCard label="One-Sided" value={clusters.oneSided} sub="You engage, they don't" />
        </div>
      )}

      {followChanges.length > 0 && (
        <Card>
          <SectionHeader>Recent Follow/Unfollow Activity</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {followChanges.slice(0, 10).map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.change_type === "follow" ? XG : "#FF4444", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: mono }}>{c.change_type === "follow" ? "Followed" : "Unfollowed"}</span>
                <span style={{ fontSize: 11, color: "#fff", fontFamily: mono }}>@{c.user_handle || c.user_id}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: mono, marginLeft: "auto" }}>{timeAgo(c.detected_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Voice ─────────────────────────────────────────

function VoiceTab() {
  const { data: voice } = useApi("/api/voice");

  const metrics = {};
  if (voice?.data) {
    for (const m of voice.data) metrics[m.metric] = m.value;
  }

  const tone = metrics.tone || {};
  const vocab = metrics.vocabulary || {};
  const emoji = metrics.emoji_rate || {};
  const structure = metrics.structure || {};
  const avgLen = metrics.avg_length || {};

  const hasData = Object.keys(metrics).length > 0;

  if (!hasData) return <EmptyState msg="Run analysis engine to generate voice fingerprint" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <SectionHeader>Voice Fingerprint</SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {["directness", "technical", "hype", "sarcasm"].map(key => (
            <VoiceMeter key={key} label={key} value={tone[key] || 0} />
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <SectionHeader>Top Vocabulary</SectionHeader>
          {vocab.topWords ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {vocab.topWords.slice(0, 15).map((w, i) => (
                <span key={i} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: `${XG}10`, border: `1px solid ${XG}20`, color: XG, fontFamily: mono }}>{w.word}</span>
              ))}
            </div>
          ) : <EmptyState msg="Not computed yet" />}
        </Card>

        <Card>
          <SectionHeader>Writing Metrics</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Avg length", `${avgLen.average || "—"} chars`],
              ["Median", `${avgLen.median || "—"} chars`],
              ["Words/tweet", `${vocab.avgWordsPerTweet || "—"}`],
              ["Emoji rate", `${emoji.pctWithEmoji || 0}%`],
              ["Sentences/tweet", `${structure.avgSentencesPerTweet || "—"}`],
              ["Lexical diversity", `${vocab.lexicalDiversity || "—"}`],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>{l}</span>
                <span style={{ fontSize: 11, color: "#fff", fontFamily: mono }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {emoji.topEmojis?.length > 0 && (
        <Card>
          <SectionHeader>Top Emojis</SectionHeader>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {emoji.topEmojis.slice(0, 8).map((e, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24 }}>{e.emoji}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: mono, marginTop: 4 }}>{e.count}x</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Signals ───────────────────────────────────────

function SignalsTab() {
  const { data: sentiment } = useApi("/api/sentiment");
  const { data: mentions } = useApi("/api/mentions?limit=10");

  const summary = sentiment?.summary || [];
  const recentMentions = sentiment?.recent || [];

  const totalSent = summary.reduce((s, r) => s + r.count, 0);
  const posCount = summary.find(s => s.sentiment === "positive")?.count || 0;
  const neuCount = summary.find(s => s.sentiment === "neutral")?.count || 0;
  const negCount = summary.find(s => s.sentiment === "negative")?.count || 0;
  const posPct = totalSent > 0 ? Math.round((posCount / totalSent) * 100) : 0;
  const neuPct = totalSent > 0 ? Math.round((neuCount / totalSent) * 100) : 0;
  const negPct = totalSent > 0 ? Math.round((negCount / totalSent) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {totalSent > 0 ? (
        <Card>
          <SectionHeader>Mention Sentiment</SectionHeader>
          <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Positive", val: posPct, color: XG },
              { label: "Neutral", val: neuPct, color: "rgba(255,255,255,0.4)" },
              { label: "Negative", val: negPct, color: "#FF4444" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span style={{ fontSize: 12, color: s.color, fontFamily: mono, fontWeight: 600 }}>{s.val}%</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {posPct > 0 && <div style={{ width: `${posPct}%`, background: XG, borderRadius: "4px 0 0 4px" }} />}
            {neuPct > 0 && <div style={{ width: `${neuPct}%`, background: "rgba(255,255,255,0.12)" }} />}
            {negPct > 0 && <div style={{ width: `${negPct}%`, background: "#FF4444", borderRadius: "0 4px 4px 0" }} />}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: mono, marginTop: 8 }}>{totalSent} mentions analyzed</div>
        </Card>
      ) : <EmptyState msg="No sentiment data — run sentiment collector with ANTHROPIC_API_KEY set" />}

      {recentMentions.length > 0 && (
        <Card>
          <SectionHeader>Recent Analyzed Mentions</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentMentions.slice(0, 8).map((m, i) => {
              const sentColor = m.sentiment === "positive" ? XG : m.sentiment === "negative" ? "#FF4444" : "rgba(255,255,255,0.3)";
              return (
                <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#fff", fontFamily: mono }}>@{m.author_handle || "?"}</span>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: sentColor }} />
                    <span style={{ fontSize: 10, color: sentColor, fontFamily: mono }}>{m.sentiment} ({m.sentiment_score?.toFixed(2)})</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", fontFamily: mono, marginLeft: "auto" }}>{timeAgo(m.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4, wordBreak: "break-word" }}>{m.text?.substring(0, 140)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Collectors ────────────────────────────────────

function CollectorsTab() {
  const { data: status, loading, refresh } = useApi("/api/status");
  const [triggering, setTriggering] = useState(null);

  const collectors = status?.collectors || [];
  const counts = status?.counts || {};

  async function triggerCollector(name) {
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

  if (loading) return <Loader />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <SectionHeader>Collector Status</SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {collectors.length > 0 ? collectors.map((c, i) => (
            <CollectorRow key={i} name={c.collector} status={c.status} records={c.records_collected} lastRun={c.finished_at || c.started_at} />
          )) : (
            <EmptyState msg="No collectors have run yet" />
          )}
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <SectionHeader>Record Counts</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(counts).map(([key, val], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: mono, textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 11, color: "#fff", fontFamily: mono }}>{fmtNum(val)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader>Manual Triggers</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["all", "timeline", "engagement", "mentions", "audience", "following", "bookmarks", "sentiment"].map(name => (
              <button key={name} onClick={() => triggerCollector(name)} disabled={triggering != null} style={{
                padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)",
                background: triggering === name ? `${XG}15` : "rgba(255,255,255,0.02)",
                color: triggering === name ? XG : "rgba(255,255,255,0.5)",
                fontSize: 11, fontFamily: mono, cursor: triggering ? "wait" : "pointer",
                textAlign: "left", textTransform: "capitalize", transition: "all 0.15s ease",
              }}>
                {triggering === name ? `Running ${name}...` : `▶ ${name}`}
              </button>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
            <button onClick={triggerAnalysis} disabled={triggering != null} style={{
              padding: "8px 12px", borderRadius: 6, border: `1px solid ${XG}20`,
              background: triggering === "analyze" ? `${XG}15` : `${XG}05`,
              color: XG, fontSize: 11, fontFamily: mono, cursor: triggering ? "wait" : "pointer",
              textAlign: "left", transition: "all 0.15s ease",
            }}>
              {triggering === "analyze" ? "Running analysis..." : "⚡ Run Analysis Engine"}
            </button>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader>Cron Schedule</SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { job: "Timeline + Engagement + Mentions + Bookmarks", freq: "Every 6h" },
            { job: "Sentiment Analysis", freq: "After collections" },
            { job: "Pattern Analysis", freq: "After collections" },
            { job: "Following Graph", freq: "Daily 6am" },
            { job: "Audience Snapshot", freq: "Daily 6am" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: mono }}>{s.job}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: mono }}>{s.freq}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Scanner (External Profile Intel) ──────────────

function ScanTab() {
  const [handle, setHandle] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const { data: scans, loading, refresh } = useApi("/api/scans");

  const profiles = scans?.data || [];

  async function runScan() {
    if (!handle.trim()) return;
    setScanning(true);
    setScanResult(null);
    setSelectedProfile(null);
    const res = await apiPost(`/api/scan/${handle.replace(/^@/, "")}`);
    setScanResult(res);
    setScanning(false);
    refresh();
    if (res?.scan?.userId) loadProfile(res.scan.userId);
  }

  async function loadProfile(userId) {
    const res = await api(`/api/scans/${userId}`);
    setSelectedProfile(res);
  }

  async function runCompare() {
    if (!compareA || !compareB) return;
    const res = await api(`/api/scans/compare/${compareA}/${compareB}`);
    setCompareResult(res);
  }

  async function handleDelete(userId) {
    await fetch(`${API}/api/scans/${userId}`, { method: "DELETE" });
    setSelectedProfile(null);
    refresh();
  }

  const selProfile = selectedProfile?.profile;
  const selPatterns = selectedProfile?.patterns || [];
  const selVoice = selectedProfile?.voice || [];
  const selTweets = selectedProfile?.topTweets || [];

  const getPattern = (type, key) => selPatterns.find(p => p.pattern_type === type && p.pattern_key === key)?.pattern_value;
  const getVoiceMetric = (metric) => selVoice.find(v => v.metric === metric)?.value;

  const perfSummary = getPattern("content_perf", "summary");
  const typePerf = getPattern("content_type", "performance") || [];
  const tone = getVoiceMetric("tone") || {};
  const vocab = getVoiceMetric("vocabulary") || {};
  const avgLen = getVoiceMetric("avg_length") || {};
  const emoji = getVoiceMetric("emoji_rate") || {};
  const hashFreq = getPattern("hashtag", "frequency") || [];
  const peakHours = getPattern("posting_time", "peak_hours") || [];
  const postFreq = getPattern("posting_frequency", "summary") || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Scan input */}
      <Card>
        <SectionHeader>Scan External Profile</SectionHeader>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={handle}
            onChange={e => setHandle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runScan()}
            placeholder="@handle"
            style={{
              flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
              color: "#fff", fontSize: 13, fontFamily: mono, outline: "none",
            }}
          />
          <button onClick={runScan} disabled={scanning || !handle.trim()} style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: scanning ? "wait" : "pointer",
            background: scanning ? `${XG}20` : XG, color: "#050505", fontSize: 12,
            fontFamily: mono, fontWeight: 600, transition: "all 0.2s ease",
            opacity: !handle.trim() ? 0.4 : 1,
          }}>
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </div>
        {scanning && (
          <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>
            Fetching tweets and running analysis... this takes 15-30 seconds.
          </div>
        )}
        {scanResult && !scanning && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: scanResult.scan?.status === "complete" ? "rgba(0,255,136,0.04)" : "rgba(255,68,68,0.04)", border: `1px solid ${scanResult.scan?.status === "complete" ? "rgba(0,255,136,0.08)" : "rgba(255,68,68,0.08)"}` }}>
            <span style={{ fontSize: 11, color: scanResult.scan?.status === "complete" ? XG : "#FF4444", fontFamily: mono }}>
              {scanResult.scan?.status === "complete"
                ? `Collected ${scanResult.scan?.tweetsCollected} tweets, computed ${scanResult.analysis?.patterns} patterns in ${(scanResult.durationMs / 1000).toFixed(1)}s`
                : `Error: ${scanResult.scan?.error || "Unknown error"}`}
            </span>
          </div>
        )}
      </Card>

      {/* Scanned profiles list */}
      {profiles.length > 0 && (
        <Card>
          <SectionHeader>Scanned Profiles ({profiles.length})</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {profiles.map((p, i) => (
              <div key={i} onClick={() => loadProfile(p.user_id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                background: selProfile?.user_id === p.user_id ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.02)",
                borderRadius: 8, border: selProfile?.user_id === p.user_id ? `1px solid ${XG}20` : "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer", transition: "all 0.15s ease", flexWrap: "wrap",
              }}>
                {p.profile_image_url && <img src={p.profile_image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />}
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 12, color: "#fff", fontFamily: mono }}>@{p.handle}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>{p.name}</div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>{fmtNum(p.followers)} followers</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", fontFamily: mono }}>{timeAgo(p.last_scanned)}</span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.status === "complete" ? XG : p.status === "scanning" ? "#FFAA00" : "#FF4444" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Compare feature */}
      {profiles.length >= 2 && (
        <Card>
          <SectionHeader>Compare Profiles</SectionHeader>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={compareA || ""} onChange={e => setCompareA(e.target.value)} style={{
              flex: 1, minWidth: 120, padding: "8px 12px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
              color: "#fff", fontSize: 11, fontFamily: mono, outline: "none",
            }}>
              <option value="">Profile A</option>
              {profiles.map(p => <option key={p.user_id} value={p.user_id}>@{p.handle}</option>)}
            </select>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: mono }}>vs</span>
            <select value={compareB || ""} onChange={e => setCompareB(e.target.value)} style={{
              flex: 1, minWidth: 120, padding: "8px 12px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
              color: "#fff", fontSize: 11, fontFamily: mono, outline: "none",
            }}>
              <option value="">Profile B</option>
              {profiles.map(p => <option key={p.user_id} value={p.user_id}>@{p.handle}</option>)}
            </select>
            <button onClick={runCompare} disabled={!compareA || !compareB || compareA === compareB} style={{
              padding: "8px 16px", borderRadius: 6, border: `1px solid ${XG}30`,
              background: `${XG}10`, color: XG, fontSize: 11, fontFamily: mono,
              cursor: !compareA || !compareB ? "not-allowed" : "pointer",
              opacity: !compareA || !compareB ? 0.4 : 1,
            }}>Compare</button>
          </div>

          {compareResult && (
            <div style={{ marginTop: 16 }}>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                {["a", "b"].map(side => {
                  const pr = compareResult.profiles[side];
                  const eng = compareResult.comparison?.engagementSummary?.[side];
                  const t = compareResult.comparison?.tone?.[side];
                  return (
                    <div key={side} style={{ padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: mono, marginBottom: 8 }}>@{pr?.handle}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>Followers</span>
                          <span style={{ fontSize: 10, color: "#fff", fontFamily: mono }}>{fmtNum(pr?.followers)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>Avg Likes</span>
                          <span style={{ fontSize: 10, color: "#fff", fontFamily: mono }}>{eng?.avgLikes || "—"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>Eng Rate</span>
                          <span style={{ fontSize: 10, color: XG, fontFamily: mono }}>{eng?.overallEngRate || "—"}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>Directness</span>
                          <span style={{ fontSize: 10, color: "#fff", fontFamily: mono }}>{t?.directness || "—"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>Hype</span>
                          <span style={{ fontSize: 10, color: "#fff", fontFamily: mono }}>{t?.hype || "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Selected profile detail */}
      {selProfile && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#fff", fontFamily: sans }}>{selProfile.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>@{selProfile.handle}</div>
                {selProfile.bio && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.5, maxWidth: 400 }}>{selProfile.bio}</div>}
              </div>
              <button onClick={() => handleDelete(selProfile.user_id)} style={{
                padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,68,68,0.15)",
                background: "rgba(255,68,68,0.04)", color: "#FF4444", fontSize: 10,
                fontFamily: mono, cursor: "pointer",
              }}>Delete</button>
            </div>
            <div className="grid-4">
              <StatCard label="Followers" value={fmtNum(selProfile.followers)} />
              <StatCard label="Following" value={fmtNum(selProfile.following)} />
              <StatCard label="Tweets" value={fmtNum(selProfile.tweet_count)} />
              <StatCard label="Collected" value={fmtNum(selectedProfile?.tweetCount)} />
            </div>
          </Card>

          {/* Engagement summary */}
          {perfSummary && (
            <div className="grid-4">
              <StatCard label="Avg Likes" value={perfSummary.avgLikes} />
              <StatCard label="Avg RTs" value={perfSummary.avgRetweets} />
              <StatCard label="Avg Impressions" value={fmtNum(perfSummary.avgImpressions)} />
              <StatCard label="Eng Rate" value={`${perfSummary.overallEngRate}%`} sub={perfSummary.totalTweets + " tweets"} />
            </div>
          )}

          {/* Voice fingerprint */}
          {tone.directness != null && (
            <Card>
              <SectionHeader>Voice Fingerprint</SectionHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {["directness", "technical", "hype", "sarcasm"].map(key => (
                  <VoiceMeter key={key} label={key} value={tone[key] || 0} />
                ))}
              </div>
            </Card>
          )}

          {/* Content types + hashtags */}
          <div className="grid-2">
            {typePerf.length > 0 && (
              <Card>
                <SectionHeader>Content Types</SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {typePerf.sort((a, b) => (b.engagementRate || 0) - (a.engagementRate || 0)).map((ct, i) => (
                    <BarRow key={i} label={ct.type} value={ct.engagementRate || 0} maxValue={Math.max(...typePerf.map(t => t.engagementRate || 0))} suffix="%" labelWidth={60} />
                  ))}
                </div>
              </Card>
            )}
            {hashFreq.length > 0 && (
              <Card>
                <SectionHeader>Top Hashtags</SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {hashFreq.slice(0, 8).map((h, i) => (
                    <BarRow key={i} label={`#${h.tag}`} value={h.count} maxValue={hashFreq[0]?.count || 1} color="#00AAFF" labelWidth={90} />
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Vocabulary + writing metrics */}
          <div className="grid-2">
            {vocab.topWords?.length > 0 && (
              <Card>
                <SectionHeader>Top Vocabulary</SectionHeader>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {vocab.topWords.slice(0, 15).map((w, i) => (
                    <span key={i} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, background: `${XG}10`, border: `1px solid ${XG}20`, color: XG, fontFamily: mono }}>{w.word}</span>
                  ))}
                </div>
              </Card>
            )}
            <Card>
              <SectionHeader>Writing Metrics</SectionHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Avg length", `${avgLen.average || "—"} chars`],
                  ["Words/tweet", `${vocab.avgWordsPerTweet || "—"}`],
                  ["Emoji rate", `${emoji.pctWithEmoji || 0}%`],
                  ["Tweets/day", `${postFreq.tweetsPerDay || "—"}`],
                  ["Diversity", `${vocab.lexicalDiversity || "—"}`],
                ].map(([l, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: mono }}>{l}</span>
                    <span style={{ fontSize: 10, color: "#fff", fontFamily: mono }}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Top tweets */}
          {selTweets.length > 0 && (
            <Card>
              <SectionHeader>Top Tweets by Likes</SectionHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selTweets.map((t, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 6, wordBreak: "break-word" }}>{t.text?.substring(0, 180)}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>♥ {t.likes}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>↻ {t.retweets}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>👁 {fmtNum(t.impressions)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {peakHours.length > 0 && (
            <InsightBox>PEAK POSTING HOURS: {peakHours.map(h => `${h.hour}:00 UTC (${h.count})`).join(", ")}</InsightBox>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────

export default function XenuDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: status } = useApi("/api/status");
  const { data: authStatus } = useApi("/auth/status");

  const authenticated = authStatus?.authenticated || false;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "behavior", label: "Behavior" },
    { id: "network", label: "Network" },
    { id: "voice", label: "Voice" },
    { id: "signals", label: "Signals" },
    { id: "scan", label: "Scan" },
    { id: "collectors", label: "Collectors" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: sans, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        :root { --show-handle: inline; --show-detail: block; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        @media (max-width: 768px) {
          :root { --show-handle: none; --show-detail: none; }
          .grid-4 { grid-template-columns: repeat(2, 1fr); }
          .grid-2 { grid-template-columns: 1fr; }
          .grid-3 { grid-template-columns: 1fr; }
          header { padding: 12px 16px !important; }
          nav { padding: 0 12px !important; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          nav::-webkit-scrollbar { display: none; }
          nav button { padding: 12px 14px !important; white-space: nowrap; flex-shrink: 0; }
          main { padding: 16px !important; }
          footer { padding: 8px 16px !important; }
        }
        @media (max-width: 480px) {
          .grid-4 { grid-template-columns: 1fr 1fr; gap: 8px; }
        }
      `}</style>

      {/* Ambient */}
      <div style={{ position: "fixed", top: -200, right: -200, width: 600, height: 600, background: `radial-gradient(circle, ${XG}08, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -300, left: -100, width: 500, height: 500, background: "radial-gradient(circle, #00AAFF06, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.01) 2px, rgba(0,255,136,0.01) 4px)" }} />

      {/* Header */}
      <header style={{
        padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 50, background: "rgba(5,5,5,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${XG}22, ${XG}08)`,
            border: `1px solid ${XG}33`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>𝕏</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em" }}>
            <GlitchText>Xenu</GlitchText>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: authenticated ? XG : "#FF4444",
            boxShadow: authenticated ? `0 0 8px ${XG}` : "none",
          }} />
          <ProfileDropdown status={status} />
        </div>
      </header>

      {/* Auth banner */}
      {!authenticated && (
        <div style={{ padding: "10px 24px", background: "rgba(255,68,68,0.06)", borderBottom: "1px solid rgba(255,68,68,0.1)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#FF4444", fontFamily: mono }}>Not authenticated.</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: mono }}>Visit {API}/auth/login to connect your X account.</span>
        </div>
      )}

      {/* Tabs */}
      <nav style={{ padding: "0 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 11, fontFamily: mono, letterSpacing: "0.05em",
            color: activeTab === tab.id ? XG : "rgba(255,255,255,0.3)",
            borderBottom: activeTab === tab.id ? `2px solid ${XG}` : "2px solid transparent",
            transition: "all 0.2s ease",
          }}>{tab.label}</button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: "24px 24px 64px", animation: "fadeIn 0.3s ease" }}>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "behavior" && <BehaviorTab />}
        {activeTab === "network" && <NetworkTab />}
        {activeTab === "voice" && <VoiceTab />}
        {activeTab === "signals" && <SignalsTab />}
        {activeTab === "scan" && <ScanTab />}
        {activeTab === "collectors" && <CollectorsTab />}
      </main>

      {/* Footer */}
      <footer style={{
        position: "fixed", bottom: 0, left: 0, right: 0, padding: "8px 24px",
        background: "rgba(5,5,5,0.9)", borderTop: "1px solid rgba(255,255,255,0.04)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        backdropFilter: "blur(20px)", zIndex: 50,
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: mono }}>xenu v0.1.0</span>
        <span style={{ fontSize: 10, color: authenticated ? `${XG}66` : "rgba(255,68,68,0.4)", fontFamily: mono }}>
          {authenticated ? "connected" : "disconnected"}
        </span>
      </footer>
    </div>
  );
}
