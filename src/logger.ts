const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const CURRENT_LEVEL: Level = (process.env.LOG_LEVEL as Level) || "info";

function log(level: Level, component: string, msg: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[CURRENT_LEVEL]) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${component}]`;
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  const line = `${prefix} ${msg}${payload}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(component: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", component, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", component, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", component, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", component, msg, data),
  };
}
