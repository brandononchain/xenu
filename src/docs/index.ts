import { Hono } from "hono";

const docs = new Hono();

// ─── Styles & Layout ────────────────────────────────────

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #050505; color: #e0e0e0; font-family: 'Inter', -apple-system, sans-serif; line-height: 1.7; }
a { color: #00FF88; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'JetBrains Mono', monospace; font-size: 0.88em; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: #00FF88; }
pre { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; overflow-x: auto; margin: 16px 0; }
pre code { background: none; padding: 0; color: #ccc; font-size: 13px; }
h1 { font-size: 32px; font-weight: 700; color: #fff; margin-bottom: 8px; letter-spacing: -0.03em; }
h2 { font-size: 22px; font-weight: 600; color: #fff; margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
h3 { font-size: 16px; font-weight: 600; color: #fff; margin: 28px 0 8px; }
p { margin: 10px 0; color: rgba(255,255,255,0.7); }
table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
th { text-align: left; padding: 10px 12px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; border-bottom: 1px solid rgba(255,255,255,0.08); }
td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.65); }
tr:hover td { background: rgba(255,255,255,0.02); }
ul, ol { margin: 10px 0 10px 24px; }
li { margin: 6px 0; color: rgba(255,255,255,0.65); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: 'JetBrains Mono', monospace; font-weight: 500; }
.get { background: rgba(0,170,255,0.12); color: #00AAFF; }
.post { background: rgba(0,255,136,0.12); color: #00FF88; }
.delete { background: rgba(255,68,68,0.12); color: #FF4444; }
.patch { background: rgba(255,170,0,0.12); color: #FFAA00; }
.container { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
.nav { position: sticky; top: 0; z-index: 50; background: rgba(5,5,5,0.92); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 24px; }
.nav-inner { max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 56px; }
.nav-logo { font-size: 16px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
.nav-logo span { color: #00FF88; }
.nav-links { display: flex; gap: 4px; flex-wrap: wrap; }
.nav-links a { padding: 6px 12px; border-radius: 6px; font-size: 12px; color: rgba(255,255,255,0.4); font-family: 'JetBrains Mono', monospace; transition: all 0.15s; }
.nav-links a:hover, .nav-links a.active { color: #00FF88; background: rgba(0,255,136,0.06); text-decoration: none; }
.hero-sub { font-size: 15px; color: rgba(255,255,255,0.4); margin-bottom: 32px; }
.card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin: 12px 0; }
.card h3 { margin-top: 0; }
.endpoint { margin: 24px 0; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
.endpoint-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.endpoint-path { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #fff; }
.param-table { font-size: 13px; }
.param-table td:first-child { font-family: 'JetBrains Mono', monospace; color: #00FF88; white-space: nowrap; }
@media (max-width: 640px) {
  h1 { font-size: 24px; }
  h2 { font-size: 18px; }
  .container { padding: 24px 16px 60px; }
  .nav-links { display: none; }
  pre { padding: 14px; font-size: 12px; }
  table { font-size: 12px; }
  th, td { padding: 8px; }
}
`;

function layout(title: string, activePage: string, content: string): string {
  const pages = [
    { slug: "", label: "Home" },
    { slug: "quickstart", label: "Quickstart" },
    { slug: "api", label: "API" },
    { slug: "scanner", label: "Scanner" },
    { slug: "analysis", label: "Analysis" },
    { slug: "watch", label: "Watch List" },
    { slug: "architecture", label: "Architecture" },
  ];

  const navLinks = pages.map(p =>
    `<a href="/docs${p.slug ? '/' + p.slug : ''}" class="${activePage === p.slug ? 'active' : ''}">${p.label}</a>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Xenu Docs</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="nav">
  <div class="nav-inner">
    <a href="/docs" class="nav-logo" style="text-decoration:none">𝕏 <span>Xenu</span> Docs</a>
    <div class="nav-links">${navLinks}</div>
  </div>
</div>
<div class="container">${content}</div>
</body>
</html>`;
}

// ─── Pages ──────────────────────────────────────────────

docs.get("/", (c) => {
  return c.html(layout("Documentation", "", `
<h1>Xenu Documentation</h1>
<p class="hero-sub">Autonomous X intelligence agent. Observe, analyze, and scan any public profile.</p>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px">
  <a href="/docs/quickstart" class="card" style="text-decoration:none">
    <h3>Quickstart</h3>
    <p>Set up Xenu, connect your X account, and run your first scan in 5 minutes.</p>
  </a>
  <a href="/docs/api" class="card" style="text-decoration:none">
    <h3>API Reference</h3>
    <p>All 34 endpoints with parameters, responses, and examples.</p>
  </a>
  <a href="/docs/scanner" class="card" style="text-decoration:none">
    <h3>Scanner</h3>
    <p>Scan any public X profile. Thread detection, topic clustering, voice fingerprinting.</p>
  </a>
  <a href="/docs/analysis" class="card" style="text-decoration:none">
    <h3>Analysis Engine</h3>
    <p>6 analyzers compute 30+ patterns from your collected data.</p>
  </a>
  <a href="/docs/watch" class="card" style="text-decoration:none">
    <h3>Watch List & Batch</h3>
    <p>Monitor profiles over time. Batch scan up to 50 handles. Change detection.</p>
  </a>
  <a href="/docs/architecture" class="card" style="text-decoration:none">
    <h3>Architecture</h3>
    <p>System design, data flow, database schema, and deployment.</p>
  </a>
</div>

<h2>Overview</h2>
<p>Xenu is a two-part system:</p>
<ul>
  <li><strong>Observer (Phase 1)</strong> — 7 collectors that run on cron, pulling data from your own X profile: tweets, engagements, mentions, following graph, audience metrics, bookmarks, and sentiment analysis.</li>
  <li><strong>Scanner</strong> — On-demand intelligence on any public X profile. Fetches tweets, runs full analysis pipeline (voice fingerprint, content performance, thread detection, topic clustering, engagement velocity, optimal timing), and stores results for comparison.</li>
</ul>

<h2>Stack</h2>
<table>
  <tr><td>Runtime</td><td>Node.js 20+ / TypeScript</td></tr>
  <tr><td>Database</td><td>SQLite via better-sqlite3 (20 tables)</td></tr>
  <tr><td>Server</td><td>Hono</td></tr>
  <tr><td>API</td><td>X API v2 (OAuth 2.0 PKCE)</td></tr>
  <tr><td>AI</td><td>Claude API (topic clustering, sentiment)</td></tr>
  <tr><td>Scheduler</td><td>cron</td></tr>
</table>
  `));
});

docs.get("/quickstart", (c) => {
  return c.html(layout("Quickstart", "quickstart", `
<h1>Quickstart</h1>
<p class="hero-sub">Get Xenu running and connected in 5 minutes.</p>

<h2>1. X Developer Account</h2>
<ol>
  <li>Go to <a href="https://developer.x.com" target="_blank">developer.x.com</a></li>
  <li>Create a Project, then create an App inside it</li>
  <li>Under <strong>User authentication settings</strong>, enable OAuth 2.0</li>
  <li>Set App type to <strong>Confidential client</strong></li>
  <li>Add callback URL: <code>http://localhost:3400/auth/callback</code></li>
  <li>Enable <strong>pay-per-use</strong> billing under your project settings</li>
  <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
</ol>

<h2>2. Find Your User ID</h2>
<p>Your numeric X user ID (not your handle). Find it at <a href="https://tweeterid.com" target="_blank">tweeterid.com</a>.</p>

<h2>3. Install &amp; Configure</h2>
<pre><code>git clone https://github.com/brandononchain/xenu.git
cd xenu
npm install
cp .env.example .env</code></pre>

<p>Edit <code>.env</code>:</p>
<pre><code>X_CLIENT_ID=your_client_id
X_CLIENT_SECRET=your_client_secret
X_USER_ID=your_numeric_id
X_USER_HANDLE=yourhandle

# Optional: enables topic clustering + sentiment analysis
ANTHROPIC_API_KEY=sk-ant-...</code></pre>

<h2>4. Initialize Database</h2>
<pre><code>npm run db:init</code></pre>

<h2>5. Start &amp; Authorize</h2>
<pre><code>npm run dev</code></pre>
<p>Open <a href="http://localhost:3400/auth/login">http://localhost:3400/auth/login</a>. This returns an authorization URL. Open it in your browser, approve Xenu, and you'll be redirected back. Tokens are stored in the database automatically and refresh on expiry.</p>

<h2>6. Run Your First Collection</h2>
<pre><code># Run all collectors
npm run collect

# Or trigger via API
curl -X POST http://localhost:3400/api/collect/all</code></pre>

<h2>7. Run Analysis</h2>
<pre><code># Run all analyzers
npm run analyze

# Or trigger via API
curl -X POST http://localhost:3400/api/analyze/all</code></pre>

<h2>8. Scan Another Profile</h2>
<pre><code>curl -X POST http://localhost:3400/api/scan/elonmusk</code></pre>

<h2>OAuth Scopes</h2>
<p>Xenu requests these scopes during authorization:</p>
<table>
  <tr><th>Scope</th><th>Purpose</th></tr>
  <tr><td><code>tweet.read</code></td><td>Read your tweets and timeline</td></tr>
  <tr><td><code>users.read</code></td><td>Read profile information</td></tr>
  <tr><td><code>follows.read</code></td><td>Read following/follower lists</td></tr>
  <tr><td><code>like.read</code></td><td>Read your liked tweets</td></tr>
  <tr><td><code>bookmark.read</code></td><td>Read your bookmarks</td></tr>
  <tr><td><code>list.read</code></td><td>Read list memberships</td></tr>
  <tr><td><code>offline.access</code></td><td>Refresh tokens without re-auth</td></tr>
</table>

<h2>Cost Estimate</h2>
<table>
  <tr><th>Activity</th><th>Monthly Cost</th></tr>
  <tr><td>Phase 1 collectors (your profile)</td><td>~$75-100</td></tr>
  <tr><td>Per profile scan</td><td>~$0.50-1.00</td></tr>
  <tr><td>Claude API (sentiment + topics)</td><td>~$1-5</td></tr>
  <tr><td>Watch list (20 profiles, weekly)</td><td>~$40-80</td></tr>
</table>
  `));
});

docs.get("/api", (c) => {
  return c.html(layout("API Reference", "api", `
<h1>API Reference</h1>
<p class="hero-sub">34 endpoints. All responses are JSON. Server runs on port 3400 by default.</p>

<h2>Authentication</h2>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/auth/login</span>
  </div>
  <p>Generate an OAuth 2.0 PKCE authorization URL. Returns the URL to redirect the user to X for authorization.</p>
  <pre><code>{ "url": "https://x.com/i/oauth2/authorize?...", "codeVerifier": "...", "state": "..." }</code></pre>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/auth/callback</span>
  </div>
  <p>OAuth callback handler. X redirects here after user approves. Exchanges the auth code for tokens and stores them in the database.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/auth/status</span>
  </div>
  <p>Check if the current OAuth tokens are valid.</p>
  <pre><code>{ "authenticated": true }</code></pre>
</div>

<h2>Status &amp; Data</h2>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/status</span>
  </div>
  <p>System status: latest collector runs, record counts, total data points.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/tweets</span>
  </div>
  <p>Your collected tweets.</p>
  <table class="param-table"><tr><th>Param</th><th>Type</th><th>Description</th></tr>
    <tr><td>limit</td><td>number</td><td>Max results (default 50)</td></tr>
    <tr><td>type</td><td>string</td><td>Filter: original, reply, quote, retweet</td></tr>
  </table>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/engagements</span>
  </div>
  <p>Your engagement actions (likes, replies, retweets, quotes).</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/mentions</span>
  </div>
  <p>Tweets that mention you.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/audience</span>
  </div>
  <p>Audience metrics over time (followers, following, tweet count, listed count). Up to 90 days.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/following/changes</span>
  </div>
  <p>Follow/unfollow activity log with timestamps.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/bookmarks</span>
  </div>
  <p>Your bookmarked tweets.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/sentiment</span>
  </div>
  <p>Mention sentiment breakdown (positive/neutral/negative counts, averages) plus 20 most recent analyzed mentions.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/engagement-graph</span>
  </div>
  <p>Top 20 engagement targets ranked by total actions, broken down by likes/replies/retweets/quotes.</p>
</div>

<h2>Analysis</h2>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/patterns</span>
  </div>
  <p>All computed patterns from the analysis engine.</p>
  <table class="param-table"><tr><th>Param</th><th>Type</th><th>Description</th></tr>
    <tr><td>type</td><td>string</td><td>Filter by pattern type: posting_time, content_type, hashtag, reply_chain, engagement_target, content_perf, top_content, posting_frequency</td></tr>
  </table>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/patterns/:type/:key</span>
  </div>
  <p>Get a specific pattern by type and key.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/voice</span>
  </div>
  <p>Your voice fingerprint: avg_length, vocabulary, tone, structure, emoji_rate, reply_style.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/collect/:name</span>
  </div>
  <p>Trigger a collector manually. Use <code>all</code> to run all collectors in sequence.</p>
  <p>Names: <code>all</code>, <code>timeline</code>, <code>engagement</code>, <code>mentions</code>, <code>audience</code>, <code>following</code>, <code>bookmarks</code>, <code>sentiment</code></p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/analyze/:name</span>
  </div>
  <p>Trigger an analyzer manually. Use <code>all</code> to run all analyzers.</p>
  <p>Names: <code>all</code>, <code>posting_patterns</code>, <code>content_performance</code>, <code>engagement_graph</code>, <code>voice_fingerprint</code>, <code>hashtag_clusters</code>, <code>reply_chains</code></p>
</div>

<h2>Scanner</h2>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/scan/:handle</span>
  </div>
  <p>Scan a public X profile. Fetches up to 500 tweets and runs full analysis pipeline: patterns, threads, topics, velocity, timing.</p>
  <pre><code>curl -X POST http://localhost:3400/api/scan/elonmusk</code></pre>
  <p>Response includes scan result, analysis count, thread analysis, topic analysis, velocity, timing, and duration.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scans</span>
  </div>
  <p>List all scanned profiles with metadata.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scans/:userId</span>
  </div>
  <p>Full scan results for a profile: patterns, voice, top tweets, tweet count.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scans/handle/:handle</span>
  </div>
  <p>Look up scan results by handle instead of user ID.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scans/compare/:userIdA/:userIdB</span>
  </div>
  <p>Side-by-side comparison of two scanned profiles: engagement, content types, tone, vocabulary, threads, topics, top tweets.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/scans/:userId/overlap</span>
  </div>
  <p>Run follower overlap analysis. Compares your followers with the scanned profile's followers. Returns shared followers, overlap %, and high-value shared accounts.</p>
  <p><em>Note: costs extra API reads (~$1-3).</em></p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scans/:userId/similarity</span>
  </div>
  <p>Content similarity score (0-100) comparing your voice fingerprint with the scanned profile. 5 dimensions: tone, vocabulary, structure, topics, timing.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scans/:userId/deltas</span>
  </div>
  <p>Change history from rescans: follower growth, engagement shifts, velocity changes, topic pivots.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge delete">DELETE</span>
    <span class="endpoint-path">/api/scans/:userId</span>
  </div>
  <p>Delete a scanned profile and all associated data (tweets, patterns, voice).</p>
</div>

<h2>Watch List</h2>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/watch</span>
  </div>
  <p>List all watched profiles with next scan time and profile metadata.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/watch/:userId</span>
  </div>
  <p>Add a scanned profile to the watch list.</p>
  <table class="param-table"><tr><th>Body</th><th>Type</th><th>Description</th></tr>
    <tr><td>handle</td><td>string</td><td>X handle</td></tr>
    <tr><td>interval</td><td>string</td><td>daily, weekly, biweekly, monthly (default: weekly)</td></tr>
  </table>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge patch">PATCH</span>
    <span class="endpoint-path">/api/watch/:userId</span>
  </div>
  <p>Update watch settings (interval, enabled/disabled).</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge delete">DELETE</span>
    <span class="endpoint-path">/api/watch/:userId</span>
  </div>
  <p>Remove a profile from the watch list.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/watch/process</span>
  </div>
  <p>Manually trigger watch list processing. Rescans all due profiles and computes change deltas. Also runs automatically daily at 6am.</p>
</div>

<h2>Batch Scan</h2>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge post">POST</span>
    <span class="endpoint-path">/api/scan/batch</span>
  </div>
  <p>Scan multiple profiles at once. Max 50 handles per batch. Processes asynchronously.</p>
  <pre><code>curl -X POST http://localhost:3400/api/scan/batch \\
  -H "Content-Type: application/json" \\
  -d '{"handles": ["elonmusk", "naval", "pmarca"]}'</code></pre>
  <p>Returns a <code>jobId</code> to track progress.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scan/batch/:jobId</span>
  </div>
  <p>Check batch job status: pending, running, complete, error. Includes per-handle results.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="badge get">GET</span>
    <span class="endpoint-path">/api/scan/batch</span>
  </div>
  <p>List recent batch jobs.</p>
</div>
  `));
});

docs.get("/scanner", (c) => {
  return c.html(layout("Scanner", "scanner", `
<h1>Scanner</h1>
<p class="hero-sub">Scan any public X profile without following them. Full intelligence in ~30 seconds.</p>

<h2>What You Get</h2>
<p>Every scan runs a 6-stage pipeline:</p>

<table>
  <tr><th>Stage</th><th>What it computes</th></tr>
  <tr><td>1. Collect</td><td>Fetches up to 500 public tweets via X API v2</td></tr>
  <tr><td>2. Analyze</td><td>Posting patterns, content type performance, hashtag frequency, reply chains, top tweets, engagement summary</td></tr>
  <tr><td>3. Threads</td><td>Reconstructs self-reply threads, computes thread vs single performance multiplier</td></tr>
  <tr><td>4. Topics</td><td>Classifies tweets into 10 categories via Claude API (requires ANTHROPIC_API_KEY)</td></tr>
  <tr><td>5. Velocity</td><td>Engagement acceleration/deceleration, breakout detection, growth stage</td></tr>
  <tr><td>6. Timing</td><td>Optimal posting windows, timezone inference, day-of-week performance</td></tr>
</table>

<h2>What You Can't Get</h2>
<ul>
  <li><strong>Likes</strong> — X made liked tweets private in 2024</li>
  <li><strong>Bookmarks</strong> — private, owner-only</li>
  <li><strong>DMs</strong> — private</li>
  <li><strong>Protected accounts</strong> — requires follow approval</li>
</ul>

<h2>Voice Fingerprint</h2>
<p>Every scan produces a voice fingerprint with these dimensions:</p>
<table>
  <tr><th>Metric</th><th>What it measures</th></tr>
  <tr><td>Directness (0-100)</td><td>Imperative mood, short sentences vs hedging language</td></tr>
  <tr><td>Technical (0-100)</td><td>Frequency of technical terms (api, sdk, deploy, protocol, etc.)</td></tr>
  <tr><td>Hype (0-100)</td><td>Superlatives, excitement markers, crypto-native language</td></tr>
  <tr><td>Sarcasm (0-100)</td><td>Ironic markers, casual dismissives, internet humor patterns</td></tr>
  <tr><td>Lexical Diversity</td><td>Unique words / total words ratio</td></tr>
  <tr><td>Emoji Rate</td><td>% of tweets containing emoji, top emoji list</td></tr>
  <tr><td>Avg Length</td><td>Characters per tweet (mean and median)</td></tr>
  <tr><td>Words Per Tweet</td><td>Average word count</td></tr>
</table>

<h2>Topic Categories</h2>
<p>When <code>ANTHROPIC_API_KEY</code> is set, tweets are classified into:</p>
<ul>
  <li><code>product_launch</code> — shipping, launching, releasing</li>
  <li><code>technical</code> — code, architecture, debugging</li>
  <li><code>opinion</code> — hot takes, predictions, commentary</li>
  <li><code>industry_news</code> — reacting to news and events</li>
  <li><code>community</code> — gm, engagement, shoutouts</li>
  <li><code>educational</code> — tutorials, explainers, how-tos</li>
  <li><code>personal</code> — life updates, behind-the-scenes</li>
  <li><code>promotion</code> — promoting products/services</li>
  <li><code>meme_culture</code> — jokes, memes, humor</li>
  <li><code>hiring_biz</code> — job posts, partnerships, BD</li>
</ul>

<h2>Engagement Velocity</h2>
<p>Measures whether a profile's engagement is accelerating or declining:</p>
<ul>
  <li><strong>Ratio</strong>: recent avg likes / historical avg likes. Above 1.0 = growing.</li>
  <li><strong>Trend slope</strong>: linear regression on weekly averages. Positive = accelerating.</li>
  <li><strong>Breakout detection</strong>: tweets with 3x+ average likes flagged as viral moments.</li>
  <li><strong>Stage</strong>: emerging, growing, established, declining, or viral_moment.</li>
</ul>

<h2>Content Similarity</h2>
<p>Compare any scanned profile against your own voice fingerprint. Returns a 0-100 score across 5 dimensions: tone, vocabulary, structure, topics, timing. Useful for finding collaboration targets or accounts that resonate with the same audience.</p>

<h2>Follower Overlap</h2>
<p>Cross-references your followers with a scanned profile's followers. Returns shared followers sorted by follower count, overlap percentage, and high-value shared accounts (1000+ followers). Costs ~$1-3 in extra API reads per analysis.</p>
  `));
});

docs.get("/analysis", (c) => {
  return c.html(layout("Analysis Engine", "analysis", `
<h1>Analysis Engine</h1>
<p class="hero-sub">6 analyzers compute 30+ patterns from your collected data.</p>

<h2>Analyzers</h2>

<div class="card">
  <h3>PostingPatterns</h3>
  <p>Computes posting time heatmap (hour × day), peak hours/days, content type performance breakdown, media vs text impact, posting frequency with standard deviation, and top 10 tweets by likes and engagement rate.</p>
  <p>Pattern types: <code>posting_time</code>, <code>content_type</code>, <code>posting_frequency</code>, <code>top_content</code></p>
</div>

<div class="card">
  <h3>EngagementGraph</h3>
  <p>Ranks engagement targets by reciprocity score (who you engage with vs who engages back). Clusters relationships into deep, one-sided, casual, and high-value. Tracks engagement velocity over 30 days.</p>
  <p>Pattern type: <code>engagement_target</code></p>
</div>

<div class="card">
  <h3>VoiceFingerprint</h3>
  <p>Analyzes tweet length distribution, vocabulary (lexical diversity, top 30 words), tone profile (directness/technical/hype/sarcasm scores 0-100), sentence structure patterns, reply style comparison, and emoji usage with top emoji list.</p>
  <p>Stored in: <code>voice_profile</code> table</p>
</div>

<div class="card">
  <h3>HashtagClusters</h3>
  <p>Hashtag frequency with per-tag performance, best performing by engagement rate, co-occurrence pairs (which tags you combo), and usage rate stats.</p>
  <p>Pattern type: <code>hashtag</code></p>
</div>

<div class="card">
  <h3>ReplyChains</h3>
  <p>Conversation depth distribution, duration buckets (under 5min, under 30min, etc.), top reply targets with handle resolution, and reply-to-original ratio.</p>
  <p>Pattern type: <code>reply_chain</code></p>
</div>

<div class="card">
  <h3>ContentPerformance</h3>
  <p>Length vs performance correlation, link penalty calculation, mention count impact, hourly and daily performance windows, bookmark-worthy content signals, and overall engagement summary.</p>
  <p>Pattern type: <code>content_perf</code></p>
</div>

<h2>Running Analysis</h2>
<pre><code># Run all analyzers
npm run analyze

# Via API
curl -X POST http://localhost:3400/api/analyze/all

# Run specific analyzer
curl -X POST http://localhost:3400/api/analyze/voice_fingerprint</code></pre>

<h2>Cron Schedule</h2>
<p>Analysis runs automatically after every 6-hour collection cycle. Collectors run first, then all 6 analyzers execute in sequence.</p>
  `));
});

docs.get("/watch", (c) => {
  return c.html(layout("Watch List & Batch", "watch", `
<h1>Watch List &amp; Batch Scan</h1>
<p class="hero-sub">Monitor profiles over time. Batch scan competitor sets. Detect changes.</p>

<h2>Watch List</h2>
<p>Add any scanned profile to a watch list with a configurable rescan interval. The daily cron job (6am) processes due profiles automatically.</p>

<h3>Adding a Profile</h3>
<pre><code># First scan the profile
curl -X POST http://localhost:3400/api/scan/naval

# Then add to watch list (weekly rescan)
curl -X POST http://localhost:3400/api/watch/USER_ID \\
  -H "Content-Type: application/json" \\
  -d '{"handle": "naval", "interval": "weekly"}'</code></pre>

<h3>Intervals</h3>
<table>
  <tr><th>Interval</th><th>Cost per profile</th></tr>
  <tr><td><code>daily</code></td><td>~$15-30/mo</td></tr>
  <tr><td><code>weekly</code></td><td>~$2-4/mo</td></tr>
  <tr><td><code>biweekly</code></td><td>~$1-2/mo</td></tr>
  <tr><td><code>monthly</code></td><td>~$0.50-1/mo</td></tr>
</table>

<h3>Change Detection</h3>
<p>After each rescan, Xenu snapshots the profile state and computes deltas:</p>
<ul>
  <li><strong>Followers</strong>: growth/decline percentage</li>
  <li><strong>Engagement</strong>: engagement rate and avg likes change</li>
  <li><strong>Velocity</strong>: trend shifts (accelerating → declining, etc.)</li>
  <li><strong>Topics</strong>: new topics appearing, old topics dropping off</li>
</ul>
<pre><code># View change history
curl http://localhost:3400/api/scans/USER_ID/deltas</code></pre>

<h2>Batch Scan</h2>
<p>Scan up to 50 profiles in a single API call. Processing is asynchronous with 5-second spacing between scans.</p>
<pre><code># Start batch
curl -X POST http://localhost:3400/api/scan/batch \\
  -H "Content-Type: application/json" \\
  -d '{"handles": ["elonmusk", "naval", "pmarca", "balaborz", "vaborz"]}'

# Returns: { "jobId": "a1b2c3d4", "total": 5, "status": "pending" }

# Check progress
curl http://localhost:3400/api/scan/batch/a1b2c3d4</code></pre>

<h3>Batch Job Status</h3>
<table>
  <tr><th>Status</th><th>Meaning</th></tr>
  <tr><td><code>pending</code></td><td>Job created, not started</td></tr>
  <tr><td><code>running</code></td><td>Scanning in progress</td></tr>
  <tr><td><code>complete</code></td><td>All handles processed</td></tr>
  <tr><td><code>error</code></td><td>Job-level failure</td></tr>
</table>
  `));
});

docs.get("/architecture", (c) => {
  return c.html(layout("Architecture", "architecture", `
<h1>Architecture</h1>
<p class="hero-sub">System design, data flow, and database schema.</p>

<h2>System Overview</h2>
<pre><code>┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   X API v2   │────▶│  Collectors   │────▶│   SQLite DB  │
│  (OAuth 2.0) │     │  (7 jobs)     │     │  (20 tables) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
┌──────────────┐     ┌──────────────┐             │
│  Claude API  │────▶│  Analysis    │─────────────┘
│  (optional)  │     │  Engine (6)  │
└──────────────┘     └──────────────┘
                                           ┌──────┴───────┐
┌──────────────┐     ┌──────────────┐     │  Hono Server  │
│  Dashboard   │◀───▶│  API Routes  │◀────│  (34 routes)  │
│  (React JSX) │     │  + Cron      │     │  + Cron Jobs  │
└──────────────┘     └──────────────┘     └──────────────┘
                     ┌──────────────┐
                     │   Scanner    │
                     │ (8 modules)  │
                     │ collect      │
                     │ analyze      │
                     │ threads      │
                     │ topics       │
                     │ velocity     │
                     │ timing       │
                     │ overlap      │
                     │ similarity   │
                     │ watch        │
                     └──────────────┘</code></pre>

<h2>Project Structure</h2>
<pre><code>xenu/
├── src/
│   ├── api/
│   │   └── x-client.ts          # X API v2 client, OAuth, rate limiting
│   ├── collectors/
│   │   ├── base.ts              # Base collector class
│   │   ├── timeline.ts          # Your tweets
│   │   ├── engagement.ts        # Your likes
│   │   ├── following.ts         # Following graph + diffs
│   │   ├── mentions.ts          # Mentions of you
│   │   ├── audience.ts          # Profile metrics
│   │   ├── bookmarks.ts         # Your bookmarks
│   │   ├── sentiment.ts         # AI sentiment on mentions
│   │   └── index.ts             # Registry + runner
│   ├── analysis/
│   │   ├── base.ts              # Base analyzer class
│   │   ├── posting-patterns.ts  # Time heatmap, content types
│   │   ├── engagement-graph.ts  # Reciprocity scoring
│   │   ├── voice-fingerprint.ts # Writing style DNA
│   │   ├── hashtag-clusters.ts  # Tag analysis
│   │   ├── reply-chains.ts      # Conversation depth
│   │   ├── content-performance.ts # Performance analytics
│   │   └── index.ts             # Registry + runner
│   ├── scanner/
│   │   ├── collect.ts           # Fetch public tweets
│   │   ├── analyze.ts           # Run analysis on scanned data
│   │   ├── threads.ts           # Thread detection
│   │   ├── topics.ts            # AI topic clustering
│   │   ├── velocity.ts          # Engagement acceleration
│   │   ├── timing.ts            # Optimal posting windows
│   │   ├── overlap.ts           # Follower overlap
│   │   ├── similarity.ts        # Voice similarity scoring
│   │   ├── watch.ts             # Watch list + batch + deltas
│   │   └── index.ts             # Pipeline orchestrator
│   ├── docs/
│   │   └── index.ts             # Doc center (this site)
│   ├── db/
│   │   ├── schema.ts            # 20-table schema
│   │   ├── index.ts             # Connection + helpers
│   │   ├── init.ts / reset.ts   # Lifecycle
│   ├── server/
│   │   └── index.ts             # Hono server + cron
│   ├── config.ts                # Environment config
│   ├── logger.ts                # Structured logger
│   └── index.ts                 # Entry point
├── dashboard/
│   └── xenu-dashboard.jsx       # React dashboard
└── package.json, tsconfig.json, README.md</code></pre>

<h2>Database Schema (20 Tables)</h2>

<h3>Core (Your Profile)</h3>
<table>
  <tr><th>Table</th><th>Purpose</th></tr>
  <tr><td><code>tweets</code></td><td>Your tweets with full metrics</td></tr>
  <tr><td><code>engagements</code></td><td>Your engagement actions</td></tr>
  <tr><td><code>liked_tweets</code></td><td>Tweets you liked</td></tr>
  <tr><td><code>following_snapshots</code></td><td>Daily following graph</td></tr>
  <tr><td><code>following_changes</code></td><td>Follow/unfollow log</td></tr>
  <tr><td><code>mentions</code></td><td>Tweets mentioning you</td></tr>
  <tr><td><code>audience_metrics</code></td><td>Daily follower/following counts</td></tr>
  <tr><td><code>bookmarks</code></td><td>Your bookmarks</td></tr>
  <tr><td><code>patterns</code></td><td>Computed analysis patterns</td></tr>
  <tr><td><code>voice_profile</code></td><td>Your voice fingerprint</td></tr>
  <tr><td><code>collector_runs</code></td><td>Collector execution log</td></tr>
  <tr><td><code>oauth_tokens</code></td><td>OAuth 2.0 token storage</td></tr>
</table>

<h3>Scanner (External Profiles)</h3>
<table>
  <tr><th>Table</th><th>Purpose</th></tr>
  <tr><td><code>scanned_profiles</code></td><td>Profile registry + status</td></tr>
  <tr><td><code>scanned_tweets</code></td><td>Collected tweets per profile</td></tr>
  <tr><td><code>scanned_patterns</code></td><td>Per-profile analysis patterns</td></tr>
  <tr><td><code>scanned_voice</code></td><td>Per-profile voice fingerprint</td></tr>
  <tr><td><code>watch_list</code></td><td>Rescan scheduling</td></tr>
  <tr><td><code>scan_deltas</code></td><td>Change detection between rescans</td></tr>
  <tr><td><code>batch_jobs</code></td><td>Batch scan job tracking</td></tr>
</table>

<h2>Cron Schedule</h2>
<table>
  <tr><th>Schedule</th><th>Jobs</th></tr>
  <tr><td>Every 6 hours</td><td>Timeline, engagement, mentions, bookmarks, sentiment collectors → all analyzers</td></tr>
  <tr><td>Daily 6am</td><td>Audience, following collectors → watch list rescans</td></tr>
</table>

<h2>Deployment</h2>
<p>Xenu runs as a single Node.js process with SQLite for persistence. Deploy on any VPS or PaaS that supports persistent disk:</p>
<ul>
  <li><strong>Railway</strong> — attach a volume to <code>/data</code>, set <code>DB_PATH=/data/xenu.db</code></li>
  <li><strong>Fly.io</strong> — use a persistent volume</li>
  <li><strong>VPS</strong> — pm2 or systemd process manager</li>
</ul>
<p>For subdomain docs, use a reverse proxy (nginx/Caddy):</p>
<pre><code># Caddy example
docs.xenu.app {
    reverse_proxy localhost:3400
    rewrite * /docs{uri}
}</code></pre>
  `));
});

export default docs;
