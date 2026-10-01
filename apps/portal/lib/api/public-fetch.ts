import "server-only";
import { apiErrorFromResponse, ApiError, readTraceId } from "./error";
import { isApiPage, type ApiPage, type ApiResponse } from "./envelope";
import { logger } from "@/lib/logger";

/**
 * Server transport for public reads (ADR-008 §7.1).
 *
 * - Native `fetch`, so Next.js caches and revalidates it (Axios would skip the
 *   Data Cache and add weight to the Worker bundle).
 * - No auth header. `redirect: "manual"`, so a renamed article's `301` is
 *   seen by the caller instead of being followed.
 * - Never called while `next build` prerenders pages: it throws
 *   `BuildPhaseSkippedError`, so the build succeeds without the API.
 */

export const PUBLIC_REVALIDATE_SECONDS = 3600;

/** Server-side base URL. `API_INTERNAL_URL` lets the Worker skip the public hostname. */
export const PUBLIC_API_BASE_URL = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8088/v1"
).replace(/\/+$/, "");

export class BuildPhaseSkippedError extends Error {
  constructor(path: string) {
    super(`Skipped public API call during "next build": ${path}`);
    this.name = "BuildPhaseSkippedError";
  }
}

export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export type PublicQuery = Record<string, string | number | boolean | undefined | null>;

export interface PublicFetchOptions {
  query?: PublicQuery;
  /** Seconds; defaults to one hour (the ADR-003 §11.1 time-based fallback). */
  revalidate?: number;
  tags?: string[];
}

export type PublicResult<T> =
  | { kind: "ok"; status: number; body: T; traceId?: string }
  | { kind: "not-found"; status: 404; traceId?: string }
  | { kind: "moved"; status: 301 | 308; location: string | null; body: unknown };

export function buildPublicUrl(path: string, query?: PublicQuery): string {
  const url = new URL(`${PUBLIC_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * `GET /public/**`. Returns `ok`, `not-found` (404), or `moved` (301/308).
 * Throws `ApiError` for any other status or a network failure, and
 * `BuildPhaseSkippedError` during `next build`.
 */
export async function publicFetch<T>(
  path: string,
  options: PublicFetchOptions = {},
): Promise<PublicResult<T>> {
  if (isBuildPhase()) throw new BuildPhaseSkippedError(path);

  const url = buildPublicUrl(path, options.query);
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      next: {
        revalidate: options.revalidate ?? PUBLIC_REVALIDATE_SECONDS,
        tags: options.tags,
      },
    });
  } catch (cause) {
    logger.error("public_fetch_failed", { path, error: String(cause) });
    throw new ApiError({ status: 0, message: "API unreachable", cause });
  }

  const traceId = readTraceId(response.headers);
  logger.debug("public_fetch", {
    path,
    status: response.status,
    duration_ms: Date.now() - started,
    traceId,
  });

  if (response.status === 404) return { kind: "not-found", status: 404, traceId };

  if (response.status === 301 || response.status === 308) {
    return {
      kind: "moved",
      status: response.status,
      location: response.headers.get("location"),
      body: await readJson(response),
    };
  }

  const body = await readJson(response);
  if (!response.ok) {
    logger.warn("public_fetch_error", { path, status: response.status, traceId });
    throw apiErrorFromResponse(response.status, body, response.headers);
  }
  return { kind: "ok", status: response.status, body: body as T, traceId };
}

/** Unwraps a plain success envelope, or throws when the body is malformed. */
export function unwrapData<T>(body: ApiResponse<T> | undefined): T {
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new ApiError({ status: 502, message: "Malformed API response" });
  }
  return body.data;
}

/** Unwraps a paginated envelope, or throws when the body is malformed. */
export function unwrapPage<T>(body: unknown): ApiPage<T> {
  if (!isApiPage<T>(body)) {
    throw new ApiError({ status: 502, message: "Malformed API page response" });
  }
  return body;
}

/** True when a public read failed because the API is down or skipped at build. */
export function isUnavailableError(error: unknown): boolean {
  return (
    error instanceof BuildPhaseSkippedError ||
    (error instanceof ApiError && (error.status === 0 || error.status >= 500))
  );
}

/**
 * Runs a public read and falls back when the API is unavailable (down, 5xx,
 * or skipped at build), so list sections degrade instead of failing the page.
 * Other errors (bugs, malformed data) still throw.
 */
export async function readOrFallback<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await read(), unavailable: false };
  } catch (error) {
    if (isUnavailableError(error) || (error instanceof ApiError && error.status === 502)) {
      if (!(error instanceof BuildPhaseSkippedError)) {
        logger.warn("public_read_unavailable", { error: String(error) });
      }
      return { data: fallback, unavailable: true };
    }
    throw error;
  }
}
