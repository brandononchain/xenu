import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export const config = {
  x: {
    clientId: optional("X_CLIENT_ID"),
    clientSecret: optional("X_CLIENT_SECRET"),
    callbackUrl: optional("X_CALLBACK_URL", "http://localhost:3400/auth/callback"),
    userId: optional("X_USER_ID"),
    userHandle: optional("X_USER_HANDLE", "brandononchain"),
  },
  tokens: {
    get accessToken() { return process.env.X_ACCESS_TOKEN || ""; },
    get refreshToken() { return process.env.X_REFRESH_TOKEN || ""; },
    get expiresAt() { return parseInt(process.env.X_TOKEN_EXPIRES_AT || "0", 10); },
  },
  server: {
    port: parseInt(optional("PORT", "3400"), 10),
  },
  db: {
    path: optional("DB_PATH", "./data/xenu.db"),
  },
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
};

export type Config = typeof config;
