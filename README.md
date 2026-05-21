# Xenu

Autonomous X (Twitter) intelligence agent. Observes, learns, and replicates your X behavior.

## Phase 1 — Observer

Xenu watches your X profile and collects data across 7 dimensions:

| Collector | Schedule | What it captures |
|-----------|----------|------------------|
| Timeline | Every 6h | Your tweets, threads, replies, quotes with full metrics |
| Engagement | Every 6h | Tweets you like, building an engagement graph |
| Mentions | Every 6h | Who mentions you, reply chains, conversation depth |
| Bookmarks | Every 6h | What you save — reveals content you truly value |
| Sentiment | Every 6h | AI-powered sentiment analysis on your mentions |
| Following | Daily | Your following graph with diff detection (new follows/unfollows) |
| Audience | Daily | Follower count, following count, listed count over time |

## Setup

### 1. X Developer Account

1. Go to [developer.x.com](https://developer.x.com)
2. Create a Project → Create an App
3. Enable **OAuth 2.0** with Type: **Confidential Client** and PKCE
4. Set callback URL: `http://localhost:3400/auth/callback`
5. Enable pay-per-use billing
6. Note your **Client ID** and **Client Secret**

### 2. Find Your User ID

Your numeric X user ID (not your handle). Find it at [tweeterid.com](https://tweeterid.com).

### 3. Install & Configure

```bash
git clone <repo-url> xenu
cd xenu
npm install
cp .env.example .env
```

Edit `.env`:
```
X_CLIENT_ID=your_client_id
X_CLIENT_SECRET=your_client_secret
X_USER_ID=your_numeric_id
X_USER_HANDLE=brandononchain
```

Optional: Add `ANTHROPIC_API_KEY` for sentiment analysis on mentions.

### 4. Initialize Database

```bash
npm run db:init
```

### 5. Start Server & Authorize

```bash
npm run dev
```

Then open: `http://localhost:3400/auth/login`

This returns an auth URL. Open it in your browser, authorize Xenu, and you'll be redirected back. Tokens are saved to the database automatically.

### 6. Run Collectors

Collectors run automatically on cron (every 6h / daily). To run manually:

```bash
# Run all collectors
npm run collect

# Run a specific collector
npm run collect:timeline
npm run collect:engagement
npm run collect:following
npm run collect:mentions
npm run collect:bookmarks
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /auth/login` | Generate OAuth authorization URL |
| `GET /auth/callback` | OAuth callback (automatic) |
| `GET /auth/status` | Check if authenticated |
| `GET /api/status` | System status, collector runs, record counts |
| `GET /api/tweets?limit=50&type=original` | Your tweets |
| `GET /api/engagements?limit=50` | Your engagement actions |
| `GET /api/mentions?limit=50` | Tweets mentioning you |
| `GET /api/audience` | Audience metrics over time |
| `GET /api/following/changes` | Follow/unfollow log |
| `GET /api/bookmarks` | Your bookmarks |
| `GET /api/sentiment` | Mention sentiment breakdown |
| `GET /api/engagement-graph` | Top engagement targets |
| `POST /api/collect/:name` | Trigger a collector (`all`, `timeline`, etc.) |

## Stack

- **Runtime:** Node.js 20+ / TypeScript
- **Database:** SQLite via better-sqlite3
- **API Client:** Custom X API v2 wrapper (OAuth 2.0 PKCE)
- **Server:** Hono
- **Scheduler:** cron
- **Sentiment:** Claude API (optional)

## Cost

X API pay-per-use: ~$75-100/mo for Phase 1 read volume.
Claude API for sentiment: negligible (~$1-2/mo).

## Project Structure

```
xenu/
├── src/
│   ├── api/
│   │   └── x-client.ts        # X API v2 client with OAuth, rate limiting
│   ├── collectors/
│   │   ├── base.ts             # Base collector class
│   │   ├── timeline.ts         # Your tweets
│   │   ├── engagement.ts       # Your likes
│   │   ├── following.ts        # Following graph + diffs
│   │   ├── mentions.ts         # Mentions of you
│   │   ├── audience.ts         # Profile metrics
│   │   ├── bookmarks.ts        # Your bookmarks
│   │   ├── sentiment.ts        # AI sentiment on mentions
│   │   └── index.ts            # Registry + runner
│   ├── db/
│   │   ├── schema.ts           # Full SQLite schema
│   │   ├── index.ts            # Connection, helpers
│   │   ├── init.ts             # Initialize DB
│   │   └── reset.ts            # Reset DB
│   ├── server/
│   │   └── index.ts            # Hono server + cron + routes
│   ├── config.ts               # Environment config
│   ├── logger.ts               # Structured logger
│   ├── index.ts                # Entry point
│   └── run-collectors.ts       # Manual collection script
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```
