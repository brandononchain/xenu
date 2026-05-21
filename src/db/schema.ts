export const SCHEMA = `
-- ─── Core tweet storage ────────────────────────────────
CREATE TABLE IF NOT EXISTS tweets (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  tweet_type TEXT NOT NULL DEFAULT 'original',  -- original, reply, retweet, quote
  in_reply_to_user_id TEXT,
  in_reply_to_tweet_id TEXT,
  conversation_id TEXT,
  thread_id TEXT,
  has_media INTEGER DEFAULT 0,
  media_type TEXT,  -- photo, video, animated_gif
  media_urls TEXT,  -- JSON array
  hashtags TEXT,    -- JSON array
  mentions TEXT,    -- JSON array
  urls TEXT,        -- JSON array
  lang TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  collected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Engagement actions you take ───────────────────────
CREATE TABLE IF NOT EXISTS engagements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,  -- like, retweet, reply, quote, follow, unfollow
  target_tweet_id TEXT,
  target_user_id TEXT,
  target_user_handle TEXT,
  target_tweet_text TEXT,
  detected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Liked tweets (what you like) ──────────────────────
CREATE TABLE IF NOT EXISTS liked_tweets (
  tweet_id TEXT PRIMARY KEY,
  author_id TEXT,
  author_handle TEXT,
  text TEXT,
  created_at TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  collected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Following graph snapshots ─────────────────────────
CREATE TABLE IF NOT EXISTS following_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_handle TEXT,
  user_name TEXT,
  user_bio TEXT,
  user_followers INTEGER DEFAULT 0,
  user_following INTEGER DEFAULT 0,
  user_verified INTEGER DEFAULT 0,
  user_category TEXT,  -- builder, vc, media, protocol, degen, creator (Phase 2 auto-classify)
  UNIQUE(snapshot_date, user_id)
);

-- ─── Following diff log ───────────────────────────────
CREATE TABLE IF NOT EXISTS following_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_type TEXT NOT NULL,  -- follow, unfollow
  user_id TEXT NOT NULL,
  user_handle TEXT,
  user_name TEXT,
  detected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Mentions (tweets that mention you) ────────────────
CREATE TABLE IF NOT EXISTS mentions (
  tweet_id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  author_handle TEXT,
  author_name TEXT,
  author_followers INTEGER DEFAULT 0,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  in_reply_to_tweet_id TEXT,
  conversation_id TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  sentiment TEXT,        -- positive, neutral, negative
  sentiment_score REAL,  -- -1.0 to 1.0
  collected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Audience metrics over time ────────────────────────
CREATE TABLE IF NOT EXISTS audience_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  listed_count INTEGER DEFAULT 0,
  collected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Bookmarked tweets ────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  tweet_id TEXT PRIMARY KEY,
  author_id TEXT,
  author_handle TEXT,
  text TEXT,
  created_at TEXT,
  has_media INTEGER DEFAULT 0,
  media_type TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  collected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Computed patterns ─────────────────────────────────
CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT NOT NULL,  -- posting_time, content_type, topic, engagement_target, hashtag
  pattern_key TEXT NOT NULL,
  pattern_value TEXT NOT NULL,  -- JSON
  confidence REAL DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  computed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(pattern_type, pattern_key)
);

-- ─── Voice fingerprint ─────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric TEXT NOT NULL UNIQUE,  -- avg_length, vocabulary, tone, structure, emoji_rate
  value TEXT NOT NULL,  -- JSON
  computed_at TEXT DEFAULT (datetime('now'))
);

-- ─── Collector run log ─────────────────────────────────
CREATE TABLE IF NOT EXISTS collector_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collector TEXT NOT NULL,
  status TEXT NOT NULL,  -- success, error, partial
  records_collected INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_ms INTEGER
);

-- ─── OAuth token storage ──────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── Indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tweets_created ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_tweets_type ON tweets(tweet_type);
CREATE INDEX IF NOT EXISTS idx_tweets_conversation ON tweets(conversation_id);
CREATE INDEX IF NOT EXISTS idx_engagements_type ON engagements(action_type);
CREATE INDEX IF NOT EXISTS idx_engagements_user ON engagements(target_user_id);
CREATE INDEX IF NOT EXISTS idx_liked_author ON liked_tweets(author_id);
CREATE INDEX IF NOT EXISTS idx_mentions_author ON mentions(author_id);
CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_at);
CREATE INDEX IF NOT EXISTS idx_mentions_sentiment ON mentions(sentiment);
CREATE INDEX IF NOT EXISTS idx_following_snapshot ON following_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_collector_runs ON collector_runs(collector, started_at);
`;
