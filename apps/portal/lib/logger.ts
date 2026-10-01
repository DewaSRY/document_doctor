/**
 * Server-side structured logger (ADR-008 §8 "Logging").
 *
 * winston was dropped: it pulls Node stream/transport code into the Worker
 * bundle for no gain on Cloudflare, where Workers Logs collects whatever is
 * written to `console`. We keep the redaction rules and write one JSON line
 * per event.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "authorization",
  "cookie",
  "set-cookie",
  "x-revalidate-secret",
  "clientsecret",
  "client_secret",
]);

// Catches credential-shaped keys not covered verbatim above
// (e.g. "accessToken", "refresh_token", "x-api-key").
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /api[-_]?key/i,
  /credential/i,
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    SENSITIVE_KEYS.has(lower) ||
    SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(lower))
  );
}

export function maskSensitiveData(
  data: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof data !== "object" || data === null) return data;
  if (seen.has(data)) return "[Circular]";
  seen.add(data);
  try {
    if (Array.isArray(data))
      return data.map((item) => maskSensitiveData(item, seen));
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      masked[key] = isSensitiveKey(key)
        ? "[REDACTED]"
        : maskSensitiveData(value, seen);
    }
    return masked;
  } finally {
    seen.delete(data);
  }
}

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  return LEVELS[configured] ?? LEVELS.info;
}

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < threshold()) return;
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(meta ? (maskSensitiveData(meta) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("error", message, meta),
};

export default logger;
