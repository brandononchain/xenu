import { config } from "../config.js";
import { saveTokens, loadTokens } from "../db/index.js";
import { createLogger } from "../logger.js";
import crypto from "crypto";

const log = createLogger("x-api");

const API_BASE = "https://api.x.com/2";
const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";

// ─── Types ──────────────────────────────────────────────

export interface XApiResponse<T> {
  data: T;
  meta?: {
    result_count?: number;
    next_token?: string;
    newest_id?: string;
    oldest_id?: string;
  };
  includes?: {
    users?: XUser[];
    tweets?: XTweet[];
    media?: XMedia[];
  };
}

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author_id?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: { type: "replied_to" | "quoted" | "retweeted"; id: string }[];
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count: number;
    bookmark_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: { tag: string }[];
    mentions?: { username: string; id: string }[];
    urls?: { expanded_url: string }[];
  };
  attachments?: {
    media_keys?: string[];
  };
  lang?: string;
}

export interface XUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified?: boolean;
  verified_type?: string;
  profile_image_url?: string;
  created_at?: string;
  location?: string;
}

export interface XMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
}

// ─── Rate Limiter ───────────────────────────────────────

interface RateLimit {
  remaining: number;
  reset: number;
  limit: number;
}

const rateLimits = new Map<string, RateLimit>();

function checkRateLimit(endpoint: string): boolean {
  const rl = rateLimits.get(endpoint);
  if (!rl) return true;
  if (Date.now() > rl.reset * 1000) return true;
  if (rl.remaining <= 1) {
    const waitMs = (rl.reset * 1000) - Date.now();
    log.warn("Rate limit approaching", { endpoint, remaining: rl.remaining, waitMs });
    return false;
  }
  return true;
}

function updateRateLimit(endpoint: string, headers: Headers) {
  const remaining = headers.get("x-rate-limit-remaining");
  const reset = headers.get("x-rate-limit-reset");
  const limit = headers.get("x-rate-limit-limit");
  if (remaining && reset) {
    rateLimits.set(endpoint, {
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
      limit: limit ? parseInt(limit, 10) : 0,
    });
  }
}

// ─── Token Management ───────────────────────────────────

let currentTokens: { accessToken: string; refreshToken: string; expiresAt: number } | null = null;

function loadCurrentTokens() {
  if (currentTokens && currentTokens.expiresAt > Date.now() / 1000 + 300) {
    return currentTokens;
  }
  const stored = loadTokens();
  if (stored) {
    currentTokens = stored;
    return stored;
  }
  return null;
}

async function refreshAccessToken(): Promise<boolean> {
  const tokens = loadCurrentTokens();
  if (!tokens?.refreshToken) {
    log.error("No refresh token available — re-authorize required");
    return false;
  }

  log.info("Refreshing access token...");

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: config.x.clientId,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error("Token refresh failed", { status: res.status, body: err });
      return false;
    }

    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };

    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    saveTokens(data.access_token, data.refresh_token, expiresAt, data.scope);
    currentTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    log.info("Token refreshed successfully", { expiresIn: data.expires_in });
    return true;
  } catch (err) {
    log.error("Token refresh error", { error: String(err) });
    return false;
  }
}

async function getValidToken(): Promise<string | null> {
  let tokens = loadCurrentTokens();
  if (!tokens) return null;

  // Refresh if within 5 minutes of expiry
  if (tokens.expiresAt < Date.now() / 1000 + 300) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    tokens = loadCurrentTokens();
  }

  return tokens?.accessToken || null;
}

// ─── OAuth 2.0 PKCE Auth Flow ──────────────────────────

let pkceState: { codeVerifier: string; state: string } | null = null;

export function generateAuthUrl(): { url: string; codeVerifier: string; state: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  const scopes = [
    "tweet.read", "users.read", "follows.read", "like.read",
    "bookmark.read", "list.read", "offline.access",
  ];

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.x.clientId,
    redirect_uri: config.x.callbackUrl,
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  pkceState = { codeVerifier, state };

  return {
    url: `${AUTH_URL}?${params.toString()}`,
    codeVerifier,
    state,
  };
}

export async function exchangeAuthCode(code: string, codeVerifier: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.x.callbackUrl,
      client_id: config.x.clientId,
      code_verifier: codeVerifier,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error("Auth code exchange failed", { status: res.status, body: err });
      return false;
    }

    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };

    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
    saveTokens(data.access_token, data.refresh_token, expiresAt, data.scope);
    currentTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    log.info("OAuth authorization complete", { scope: data.scope, expiresIn: data.expires_in });
    return true;
  } catch (err) {
    log.error("Auth exchange error", { error: String(err) });
    return false;
  }
}

export function getPkceState() { return pkceState; }

// ─── API Request Helper ────────────────────────────────

interface RequestOptions {
  params?: Record<string, string>;
  maxRetries?: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<XApiResponse<T> | null> {
  const { params = {}, maxRetries = 2 } = options;

  const token = await getValidToken();
  if (!token) {
    log.error("No valid token — cannot make API request", { endpoint });
    return null;
  }

  // Rate limit check
  if (!checkRateLimit(endpoint)) {
    const rl = rateLimits.get(endpoint)!;
    const waitMs = Math.max(0, (rl.reset * 1000) - Date.now()) + 1000;
    log.info("Waiting for rate limit reset", { endpoint, waitMs });
    await new Promise(r => setTimeout(r, waitMs));
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      updateRateLimit(endpoint, res.headers);

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
        log.warn("Rate limited (429)", { endpoint, waitMs, attempt });
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        return null;
      }

      if (res.status === 401) {
        log.warn("Unauthorized (401) — refreshing token", { endpoint });
        const refreshed = await refreshAccessToken();
        if (refreshed && attempt < maxRetries) continue;
        return null;
      }

      if (!res.ok) {
        const errBody = await res.text();
        log.error("API error", { endpoint, status: res.status, body: errBody });
        return null;
      }

      const data = await res.json();
      return data as XApiResponse<T>;
    } catch (err) {
      log.error("API request failed", { endpoint, attempt, error: String(err) });
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }

  return null;
}

// ─── Paginated Request ──────────────────────────────────

async function paginatedRequest<T>(
  endpoint: string,
  params: Record<string, string>,
  maxPages = 5
): Promise<{ items: T[]; includes: XApiResponse<T>["includes"] }> {
  const allItems: T[] = [];
  let allIncludes: XApiResponse<T>["includes"] = {};
  let nextToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const reqParams = { ...params };
    if (nextToken) reqParams.pagination_token = nextToken;

    const response = await apiRequest<T[]>(endpoint, { params: reqParams });
    if (!response?.data) break;

    const items = Array.isArray(response.data) ? response.data : [response.data];
    allItems.push(...items);

    // Merge includes
    if (response.includes) {
      if (response.includes.users) {
        allIncludes.users = [...(allIncludes.users || []), ...response.includes.users];
      }
      if (response.includes.tweets) {
        allIncludes.tweets = [...(allIncludes.tweets || []), ...response.includes.tweets];
      }
      if (response.includes.media) {
        allIncludes.media = [...(allIncludes.media || []), ...response.includes.media];
      }
    }

    nextToken = response.meta?.next_token;
    if (!nextToken) break;

    // Small delay between pages
    await new Promise(r => setTimeout(r, 500));
  }

  return { items: allItems, includes: allIncludes };
}

// ─── Public API Methods ─────────────────────────────────

const TWEET_FIELDS = "created_at,public_metrics,entities,referenced_tweets,conversation_id,in_reply_to_user_id,attachments,lang";
const USER_FIELDS = "created_at,description,public_metrics,verified,verified_type,profile_image_url,location";
const MEDIA_FIELDS = "type,url,preview_image_url";

/** Fetch your own tweets */
export async function getUserTweets(maxResults = 100, paginationToken?: string) {
  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    "expansions": "author_id,referenced_tweets.id,attachments.media_keys",
    "max_results": String(Math.min(maxResults, 100)),
  };
  if (paginationToken) params.pagination_token = paginationToken;

  return apiRequest<XTweet[]>(`/users/${config.x.userId}/tweets`, { params });
}

/** Fetch paginated user tweets */
export async function getAllUserTweets(maxPages = 5) {
  return paginatedRequest<XTweet>(`/users/${config.x.userId}/tweets`, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    "expansions": "author_id,referenced_tweets.id,attachments.media_keys",
    "max_results": "100",
  }, maxPages);
}

/** Fetch your liked tweets */
export async function getLikedTweets(maxResults = 100) {
  return paginatedRequest<XTweet>(`/users/${config.x.userId}/liked_tweets`, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "expansions": "author_id",
    "max_results": String(Math.min(maxResults, 100)),
  }, 3);
}

/** Fetch your following list */
export async function getFollowing(maxResults = 1000) {
  return paginatedRequest<XUser>(`/users/${config.x.userId}/following`, {
    "user.fields": USER_FIELDS,
    "max_results": String(Math.min(maxResults, 1000)),
  }, 10);
}

/** Fetch your followers (sample) */
export async function getFollowers(maxPages = 3) {
  return paginatedRequest<XUser>(`/users/${config.x.userId}/followers`, {
    "user.fields": USER_FIELDS,
    "max_results": "1000",
  }, maxPages);
}

/** Search recent tweets mentioning you */
export async function getMentions(maxResults = 100) {
  return paginatedRequest<XTweet>(`/users/${config.x.userId}/mentions`, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "expansions": "author_id,in_reply_to_user_id",
    "max_results": String(Math.min(maxResults, 100)),
  }, 3);
}

/** Fetch your bookmarks */
export async function getBookmarks(maxResults = 100) {
  return paginatedRequest<XTweet>(`/users/${config.x.userId}/bookmarks`, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "expansions": "author_id,attachments.media_keys",
    "media.fields": MEDIA_FIELDS,
    "max_results": String(Math.min(maxResults, 100)),
  }, 3);
}

/** Fetch your user profile (for audience metrics) */
export async function getMe() {
  return apiRequest<XUser>(`/users/${config.x.userId}`, {
    params: { "user.fields": USER_FIELDS },
  });
}

/** Check if auth is valid */
export async function checkAuth(): Promise<boolean> {
  const token = await getValidToken();
  if (!token) return false;
  const me = await getMe();
  return !!me?.data;
}

// ─── Public Profile Scanning Methods ────────────────────

/** Look up a user by handle */
export async function getUserByHandle(handle: string) {
  const clean = handle.replace(/^@/, "");
  return apiRequest<XUser>(`/users/by/username/${clean}`, {
    params: { "user.fields": USER_FIELDS },
  });
}

/** Fetch any user's public tweets by user ID */
export async function getPublicUserTweets(userId: string, maxPages = 5) {
  return paginatedRequest<XTweet>(`/users/${userId}/tweets`, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    "expansions": "author_id,referenced_tweets.id,attachments.media_keys",
    "max_results": "100",
    "exclude": "retweets",
  }, maxPages);
}

/** Fetch any user's followers (sample) */
export async function getPublicFollowers(userId: string, maxPages = 2) {
  return paginatedRequest<XUser>(`/users/${userId}/followers`, {
    "user.fields": USER_FIELDS,
    "max_results": "1000",
  }, maxPages);
}

/** Fetch any user's following list */
export async function getPublicFollowing(userId: string, maxPages = 2) {
  return paginatedRequest<XUser>(`/users/${userId}/following`, {
    "user.fields": USER_FIELDS,
    "max_results": "1000",
  }, maxPages);
}

/** Fetch any user's mentions (requires recent search) */
export async function getPublicMentions(handle: string, maxPages = 3) {
  const clean = handle.replace(/^@/, "");
  return paginatedRequest<XTweet>(`/tweets/search/recent`, {
    "query": `@${clean} -is:retweet`,
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "expansions": "author_id",
    "max_results": "100",
  }, maxPages);
}
