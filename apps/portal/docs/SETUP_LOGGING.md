# Server-Side Logging

Structured, PII-redacting logging for every outgoing API call, built on
[winston](https://github.com/winstonjs/winston).

Files:
- [lib/logger.ts](../lib/logger.ts) — the logger itself: format, level,
  redaction.
- [lib/api/api-interceptor.ts](../lib/api/api-interceptor.ts) — the only
  current caller. Logs request start, response success, and response
  failure for every Axios call made from the server.

## Why this shape

Request/response logs routinely carry secrets (`Authorization` headers,
session cookies, request bodies with card numbers or emails). Rather than
trust every call site to remember to scrub before logging, redaction is
built into the logger itself — anything logged through `logger` is masked
automatically, so a call site can pass a raw Axios config or error object
without thinking about it.

## Where it's called from

`ApiInterceptor` ([api-interceptor.ts](../lib/api/api-interceptor.ts)) logs
at three points, **server-side only** (`typeof window === "undefined"` —
there's no server-only log sink to send browser logs to, so client-side
requests aren't logged at all):

- **Request start** (`setupRequestInterceptors`) — method, path, body,
  params, headers, plus device info (see below).
- **Response success** — same shape, plus `status` and `duration_ms`
  (computed from `config.metadata.startTime`, stamped on every request by
  `generateRequestId()`).
- **Response failure** — same shape at `logger.error` level, plus
  `status: "network_error"` when there's no HTTP response at all.

Every request gets a `requestId` (`crypto.randomUUID()`, or a
timestamp+random fallback) attached as `config.metadata` and the
`X-Request-Id` header, so request/success/failure log lines for the same
call can be correlated by `requestId`.

`getRequestDeviceInfo()` reads `next/headers`' `headers()` for
`user-agent`/`x-forwarded-for`/`x-real-ip` and derives a coarse
`deviceType` (`mobile`/`tablet`/`desktop`) from the user-agent string via
regex — wrapped in try/catch since `headers()` throws outside a request
context (e.g. during static generation), in which case device info is
silently omitted rather than failing the log call.

## Redaction (`maskSensitiveData` / `maskSensitiveField`)

Recursively walks any object/array and replaces the value of any key in a
hardcoded `SENSITIVE_KEYS` set (`password`, `auth`, `authorization`,
`cookie`, `x-session-token`, `card_number`, `cvv`, `ssn`, `phone`, `email`
variants, and more — see the set in
[lib/logger.ts:5-32](../lib/logger.ts#L5-L32)) with `"[REDACTED]"`. Keys in
`RECIPIENT_LIST_KEYS` (`to`/`cc`/`bcc`) get the same treatment for string
values or arrays of strings. Circular references are guarded with a
`WeakSet` and rendered as `"[Circular]"` rather than throwing or looping.

**Adding a new sensitive field**: add its key (lowercase) to
`SENSITIVE_KEYS` in `lib/logger.ts` — matching is case-insensitive via
`.toLowerCase()`, but the set itself must be lowercase.

## Axios error sanitization (`sanitizeAxiosError`)

A winston format that detects an Axios error (`isAxiosError` in the object)
and strips it down before it's logged: drops the raw `request`/`config`
circular objects, keeps only `status`/`statusText`/masked `data` from
`response`, and only `url`/`method`/`baseURL` from `config`. Without this,
logging a raw Axios error would either blow up on the circular `request`
object or dump the entire (unredacted) request/response cycle.

## Format profiles

- **Production** (`NODE_ENV === "production"`): `format.json()` — one JSON
  object per line, with `timestamp()`, `errors({ stack: true })`,
  `sanitizeAxiosError()`, and `stringifyMetaValues()` (non-string metadata
  gets `JSON.stringify`'d via `serializeData`, so `FormData`/`Buffer`/streams
  don't crash the formatter or print as `[object Object]`).
- **Development**: colorized, human-readable single line + pretty-printed
  metadata block. `serializeFormDataInMeta()` additionally converts any
  `FormData` value in the log metadata to a masked plain object before
  printing, since `FormData` doesn't stringify usefully on its own.

Both profiles route through the same `maskSensitiveData`/`sanitizeAxiosError`
redaction — only the output shape differs.

## Level and transport

`level: process.env.LOG_LEVEL ?? "info"`, single transport:
`new transports.Console()`. There's no external log shipping (Datadog,
CloudWatch, etc.) configured here — logs go to stdout/stderr only, so
whatever hosts this app (Vercel, a container platform) is responsible for
collecting them from there.

**Production is intentionally silent** (`silent: process.env.NODE_ENV ===
"production"` in `lib/logger.ts`): with no log drain wired up, writing JSON
to stdout on every request is pure cost with nobody reading it. `silent`
short-circuits inside winston's `Logger#_transform` before any
formatting/redaction or transport write runs, so this is cheap, not just
unread. If external log shipping is ever added, remove the `silent` flag
(or gate it on that shipping being configured) so production logs actually
flow somewhere.

## Extending it

To log from a new server-side code path, `import logger from "@/lib/logger"`
and call `logger.info(message, meta)` / `logger.error(message, meta)` —
metadata is masked automatically, so pass the real object (a raw Axios
config, a request body) rather than pre-scrubbing it yourself. Don't call
`console.log` for anything that might carry user data; it bypasses
redaction entirely.
