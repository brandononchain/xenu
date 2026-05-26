import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { CronJob } from "cron";
import { config } from "../config.js";
import { getDb, closeDb } from "../db/index.js";
import {
  generateAuthUrl,
  exchangeAuthCode,
  getPkceState,
  checkAuth,
} from "../api/x-client.js";
import { runAllCollectors, runCollector, collectors } from "../collectors/index.js";
import { runAllAnalyzers, runAnalyzer, analyzers } from "../analysis/index.js";
import {
  fullScan,
  getScannedProfiles,
  getScanResults,
  getScanResultsByHandle,
  deleteScan,
  compareProfiles,
  runOverlapAnalysis,
  runSimilarityAnalysis,
} from "../scanner/index.js";
import {
  addToWatchList,
  removeFromWatchList,
  getWatchList,
  updateWatchInterval,
  toggleWatch,
  processWatchList,
  startBatchScan,
  getBatchJobStatus,
  listBatchJobs,
  getDeltas,
} from "../scanner/watch.js";
import { createLogger } from "../logger.js";
import docsRouter from "../docs/index.js";

const log = createLogger("server");
const app = new Hono();

// ─── Middleware ──────────────────────────────────────────

app.use("*", cors());

// ─── Doc Center ─────────────────────────────────────────

app.route("/docs", docsRouter);

// ─── Auth Routes ────────────────────────────────────────

app.get("/auth/login", (c) => {
  const { url, codeVerifier, state } = generateAuthUrl();
  log.info("Auth URL generated — redirect user to authorize");
  return c.json({ url, codeVerifier, state, instructions: "Open this URL in your browser to authorize Xenu" });
});

app.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  const pkce = getPkceState();
  if (!pkce) {
    return c.json({ error: "No PKCE state — call /auth/login first" }, 400);
  }

  if (state && state !== pkce.state) {
    return c.json({ error: "State mismatch" }, 400);
  }

  const success = await exchangeAuthCode(code, pkce.codeVerifier);
  if (success) {
    return c.html(`
      <html><body style="background:#050505;color:#00FF88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
        <h1>✓ Xenu Authorized</h1>
        <p>OAuth tokens saved. You can close this tab.</p>
        <p style="color:#666;margin-top:20px">Collectors will begin on next scheduled cycle.</p>
      </body></html>
    `);
  }

  return c.json({ error: "Token exchange failed" }, 500);
});

app.get("/auth/status", async (c) => {
  const isValid = await checkAuth();
  return c.json({ authenticated: isValid });
});

// ─── API Routes ─────────────────────────────────────────

app.get("/api/status", (c) => {
  const db = getDb();

  // Get latest collector runs
  const latestRuns = db.prepare(`
    SELECT collector, status, records_collected, started_at, finished_at, duration_ms, error_message
    FROM collector_runs
    WHERE id IN (
      SELECT MAX(id) FROM collector_runs GROUP BY collector
    )
    ORDER BY collector
  `).all();

  // Get record counts
  const counts = {
    tweets: (db.prepare("SELECT COUNT(*) as c FROM tweets").get() as any).c,
    engagements: (db.prepare("SELECT COUNT(*) as c FROM engagements").get() as any).c,
    liked_tweets: (db.prepare("SELECT COUNT(*) as c FROM liked_tweets").get() as any).c,
    mentions: (db.prepare("SELECT COUNT(*) as c FROM mentions").get() as any).c,
    following: (db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM following_snapshots").get() as any).c,
    bookmarks: (db.prepare("SELECT COUNT(*) as c FROM bookmarks").get() as any).c,
    audience_snapshots: (db.prepare("SELECT COUNT(*) as c FROM audience_metrics").get() as any).c,
  };

  return c.json({
    version: "0.1.0",
    collectors: latestRuns,
    counts,
    totalDataPoints: Object.values(counts).reduce((a, b) => a + b, 0),
  });
});

app.get("/api/tweets", (c) => {
  const db = getDb();
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const type = c.req.query("type");

  let query = "SELECT * FROM tweets";
  const params: any[] = [];
  if (type) {
    query += " WHERE tweet_type = ?";
    params.push(type);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const tweets = db.prepare(query).all(...params);
  return c.json({ data: tweets, count: tweets.length });
});

app.get("/api/engagements", (c) => {
  const db = getDb();
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const engagements = db.prepare(
    "SELECT * FROM engagements ORDER BY detected_at DESC LIMIT ?"
  ).all(limit);
  return c.json({ data: engagements, count: engagements.length });
});

app.get("/api/mentions", (c) => {
  const db = getDb();
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const mentions = db.prepare(
    "SELECT * FROM mentions ORDER BY created_at DESC LIMIT ?"
  ).all(limit);
  return c.json({ data: mentions, count: mentions.length });
});

app.get("/api/audience", (c) => {
  const db = getDb();
  const metrics = db.prepare(
    "SELECT * FROM audience_metrics ORDER BY date DESC LIMIT 90"
  ).all();
  return c.json({ data: metrics });
});

app.get("/api/following/changes", (c) => {
  const db = getDb();
  const changes = db.prepare(
    "SELECT * FROM following_changes ORDER BY detected_at DESC LIMIT 100"
  ).all();
  return c.json({ data: changes });
});

app.get("/api/bookmarks", (c) => {
  const db = getDb();
  const bookmarks = db.prepare(
    "SELECT * FROM bookmarks ORDER BY collected_at DESC LIMIT 50"
  ).all();
  return c.json({ data: bookmarks });
});

app.get("/api/sentiment", (c) => {
  const db = getDb();
  const summary = db.prepare(`
    SELECT
      sentiment,
      COUNT(*) as count,
      AVG(sentiment_score) as avg_score
    FROM mentions
    WHERE sentiment IS NOT NULL
    GROUP BY sentiment
  `).all();

  const recent = db.prepare(`
    SELECT tweet_id, text, author_handle, sentiment, sentiment_score, created_at
    FROM mentions
    WHERE sentiment IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  return c.json({ summary, recent });
});

app.get("/api/engagement-graph", (c) => {
  const db = getDb();

  // Top engagement targets by action count
  const targets = db.prepare(`
    SELECT
      target_user_handle as handle,
      target_user_id as user_id,
      COUNT(*) as total_actions,
      SUM(CASE WHEN action_type = 'like' THEN 1 ELSE 0 END) as likes,
      SUM(CASE WHEN action_type = 'reply' THEN 1 ELSE 0 END) as replies,
      SUM(CASE WHEN action_type = 'retweet' THEN 1 ELSE 0 END) as retweets,
      SUM(CASE WHEN action_type = 'quote' THEN 1 ELSE 0 END) as quotes
    FROM engagements
    WHERE target_user_handle IS NOT NULL
    GROUP BY target_user_handle
    ORDER BY total_actions DESC
    LIMIT 20
  `).all();

  return c.json({ data: targets });
});

// ─── Manual Collector Triggers ──────────────────────────

app.post("/api/collect/:name", async (c) => {
  const name = c.req.param("name");
  if (name === "all") {
    const results = await runAllCollectors();
    return c.json({ results });
  }
  if (!collectors[name]) {
    return c.json({ error: `Unknown collector: ${name}` }, 400);
  }
  const result = await runCollector(name);
  return c.json({ collector: name, ...result });
});

// ─── Analysis Routes ────────────────────────────────────

app.get("/api/patterns", (c) => {
  const db = getDb();
  const type = c.req.query("type");

  let query = "SELECT * FROM patterns";
  const params: any[] = [];
  if (type) {
    query += " WHERE pattern_type = ?";
    params.push(type);
  }
  query += " ORDER BY computed_at DESC";

  const patterns = db.prepare(query).all(...params);
  // Parse JSON values
  const parsed = (patterns as any[]).map(p => ({
    ...p,
    pattern_value: JSON.parse(p.pattern_value),
  }));
  return c.json({ data: parsed, count: parsed.length });
});

app.get("/api/patterns/:type/:key", (c) => {
  const db = getDb();
  const { type, key } = c.req.param();
  const pattern = db.prepare(
    "SELECT * FROM patterns WHERE pattern_type = ? AND pattern_key = ?"
  ).get(type, key) as any;

  if (!pattern) return c.json({ error: "Pattern not found" }, 404);
  return c.json({ ...pattern, pattern_value: JSON.parse(pattern.pattern_value) });
});

app.get("/api/voice", (c) => {
  const db = getDb();
  const metrics = db.prepare("SELECT * FROM voice_profile ORDER BY metric").all() as any[];
  const parsed = metrics.map(m => ({ ...m, value: JSON.parse(m.value) }));
  return c.json({ data: parsed });
});

app.post("/api/analyze/:name", async (c) => {
  const name = c.req.param("name");
  if (name === "all") {
    const results = await runAllAnalyzers();
    return c.json({ results });
  }
  if (!analyzers[name]) {
    return c.json({ error: `Unknown analyzer: ${name}. Available: ${Object.keys(analyzers).join(", ")}` }, 400);
  }
  const result = await runAnalyzer(name);
  return c.json({ analyzer: name, ...result });
});

// ─── Scanner Routes (External Profile Intel) ────────────

/** Scan a public profile: fetch tweets + run analysis */
app.post("/api/scan/:handle", async (c) => {
  const handle = c.req.param("handle");
  if (!handle || handle.length < 2) {
    return c.json({ error: "Invalid handle" }, 400);
  }
  log.info("Scan requested", { handle });
  const result = await fullScan(handle);
  return c.json(result);
});

/** List all scanned profiles */
app.get("/api/scans", (c) => {
  const profiles = getScannedProfiles();
  return c.json({ data: profiles, count: profiles.length });
});

/** Get full scan results for a profile (by user ID) */
app.get("/api/scans/:userId", (c) => {
  const userId = c.req.param("userId");
  const results = getScanResults(userId);
  if (!results.profile) return c.json({ error: "Profile not found" }, 404);
  return c.json(results);
});

/** Get scan results by handle */
app.get("/api/scans/handle/:handle", (c) => {
  const handle = c.req.param("handle");
  const results = getScanResultsByHandle(handle);
  if (!results) return c.json({ error: "Profile not scanned" }, 404);
  return c.json(results);
});

/** Compare two scanned profiles */
app.get("/api/scans/compare/:userIdA/:userIdB", (c) => {
  const { userIdA, userIdB } = c.req.param();
  const comparison = compareProfiles(userIdA, userIdB);
  if (!comparison) return c.json({ error: "One or both profiles not found" }, 404);
  return c.json(comparison);
});

/** Delete a scanned profile */
app.delete("/api/scans/:userId", (c) => {
  const userId = c.req.param("userId");
  deleteScan(userId);
  return c.json({ deleted: true, userId });
});

/** Run follower overlap analysis (separate — costs extra API reads) */
app.post("/api/scans/:userId/overlap", async (c) => {
  const userId = c.req.param("userId");
  log.info("Overlap analysis requested", { userId });
  const result = await runOverlapAnalysis(userId);
  if (!result) return c.json({ error: "Could not compute overlap — ensure your account has followers data" }, 400);
  return c.json(result);
});

/** Run content similarity scoring */
app.get("/api/scans/:userId/similarity", (c) => {
  const userId = c.req.param("userId");
  const result = runSimilarityAnalysis(userId);
  if (!result) return c.json({ error: "Could not compute similarity — ensure both profiles have voice data" }, 400);
  return c.json(result);
});

/** Get change deltas for a scanned profile */
app.get("/api/scans/:userId/deltas", (c) => {
  const userId = c.req.param("userId");
  const deltas = getDeltas(userId);
  return c.json({ data: deltas, count: deltas.length });
});

// ─── Watch List Routes ──────────────────────────────────

app.get("/api/watch", (c) => {
  const list = getWatchList();
  return c.json({ data: list, count: list.length });
});

app.post("/api/watch/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({})) as { handle?: string; interval?: string };
  const handle = body.handle || userId;
  const interval = (body.interval || "weekly") as "daily" | "weekly" | "biweekly" | "monthly";
  addToWatchList(handle, userId, interval);
  return c.json({ added: true, userId, interval });
});

app.delete("/api/watch/:userId", (c) => {
  const userId = c.req.param("userId");
  removeFromWatchList(userId);
  return c.json({ removed: true, userId });
});

app.patch("/api/watch/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({})) as { interval?: string; enabled?: boolean };
  if (body.interval) updateWatchInterval(userId, body.interval as any);
  if (body.enabled !== undefined) toggleWatch(userId, body.enabled);
  return c.json({ updated: true, userId });
});

app.post("/api/watch/process", async (c) => {
  const result = await processWatchList();
  return c.json(result);
});

// ─── Batch Scan Routes ──────────────────────────────────

app.post("/api/scan/batch", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { handles?: string[] };
  if (!body.handles || !Array.isArray(body.handles) || body.handles.length === 0) {
    return c.json({ error: "Provide handles array" }, 400);
  }
  if (body.handles.length > 50) {
    return c.json({ error: "Max 50 handles per batch" }, 400);
  }
  const jobId = await startBatchScan(body.handles);
  return c.json({ jobId, total: body.handles.length, status: "pending" });
});

app.get("/api/scan/batch/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const status = getBatchJobStatus(jobId);
  if (!status) return c.json({ error: "Job not found" }, 404);
  return c.json(status);
});

app.get("/api/scan/batch", (c) => {
  const jobs = listBatchJobs();
  return c.json({ data: jobs });
});

// ─── Cron Jobs ──────────────────────────────────────────

let cronJobs: CronJob[] = [];

function setupCronJobs() {
  // Every 6 hours: timeline, engagement, mentions, bookmarks, sentiment → then analyze
  const sixHourJob = new CronJob("0 */6 * * *", async () => {
    log.info("Cron: 6-hour collection cycle");
    for (const name of ["timeline", "engagement", "mentions", "bookmarks"]) {
      await runCollector(name);
      await new Promise(r => setTimeout(r, 2000));
    }
    // Sentiment runs after mentions
    await runCollector("sentiment");

    // Run analysis after fresh data
    log.info("Cron: Running analysis engine");
    await runAllAnalyzers();
  });

  // Daily at 6am: following, audience, watch list rescans
  const dailyJob = new CronJob("0 6 * * *", async () => {
    log.info("Cron: Daily collection cycle");
    await runCollector("audience");
    await new Promise(r => setTimeout(r, 2000));
    await runCollector("following");

    // Process watch list rescans
    log.info("Cron: Processing watch list");
    await processWatchList();
  });

  cronJobs = [sixHourJob, dailyJob];
  cronJobs.forEach(job => job.start());

  log.info("Cron jobs scheduled", {
    sixHour: "0 */6 * * * (timeline, engagement, mentions, bookmarks, sentiment, analysis)",
    daily: "0 6 * * * (following, audience, watch list rescans)",
  });
}

// ─── Start Server ───────────────────────────────────────

export function startServer() {
  // Initialize DB
  getDb();

  // Setup cron
  setupCronJobs();

  // Start HTTP server
  serve({
    fetch: app.fetch,
    port: config.server.port,
    hostname: "0.0.0.0",
  });

  log.info(`
  ═══════════════════════════════════════
     Xenu v0.1.0 — Observer Agent
  ═══════════════════════════════════════
     Server:    http://localhost:${config.server.port}
     Auth:      http://localhost:${config.server.port}/auth/login
     Docs:      http://localhost:${config.server.port}/docs
     Status:    http://localhost:${config.server.port}/api/status
  ═══════════════════════════════════════
  `);
}

// ─── Cleanup ────────────────────────────────────────────

process.on("SIGINT", () => {
  log.info("Shutting down...");
  cronJobs.forEach(job => job.stop());
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cronJobs.forEach(job => job.stop());
  closeDb();
  process.exit(0);
});
