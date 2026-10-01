import { isApiErrorBody, type ApiErrorBody, type ApiFieldError } from "./envelope";

export const TRACE_ID_HEADER = "x-trace-id";

/**
 * One error type for every failed API call (browser and server). The UI
 * branches on `status` (the HTTP code), shows `message`, maps `fieldErrors`
 * onto the form, and prints `traceId` so a user can quote it (ADR-003 §3.5).
 *
 * `status` is `0` for a network error / no response.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: ApiFieldError[];
  readonly traceId?: string;
  readonly body?: ApiErrorBody;

  constructor(options: {
    status: number;
    message: string;
    fieldErrors?: ApiFieldError[];
    traceId?: string;
    body?: ApiErrorBody;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "ApiError";
    this.status = options.status;
    this.fieldErrors = options.fieldErrors ?? [];
    this.traceId = options.traceId;
    this.body = options.body;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

type HeaderBag =
  | Headers
  | Record<string, unknown>
  | { get?: (name: string) => unknown }
  | undefined
  | null;

/** Reads `X-Trace-Id` from fetch `Headers`, Axios headers, or a plain object. */
export function readTraceId(headers: HeaderBag): string | undefined {
  if (!headers) return undefined;
  const getter = (headers as { get?: unknown }).get;
  if (typeof getter === "function") {
    const value = (getter as (name: string) => unknown).call(headers, TRACE_ID_HEADER);
    if (typeof value === "string" && value) return value;
  }
  const record = headers as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === TRACE_ID_HEADER) {
      const value = record[key];
      return typeof value === "string" && value ? value : undefined;
    }
  }
  return undefined;
}

type AxiosLikeError = {
  isAxiosError: true;
  message: string;
  response?: { status: number; data?: unknown; headers?: HeaderBag };
};

function isAxiosLikeError(error: unknown): error is AxiosLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { isAxiosError?: unknown }).isAxiosError === true
  );
}

/** Builds an `ApiError` from a status, a parsed body, and headers. */
export function apiErrorFromResponse(
  status: number,
  body: unknown,
  headers?: HeaderBag,
  cause?: unknown,
): ApiError {
  const traceId = readTraceId(headers);
  if (isApiErrorBody(body)) {
    return new ApiError({
      status,
      message: body.message,
      fieldErrors: body.error,
      traceId,
      body,
      cause,
    });
  }
  return new ApiError({
    status,
    message: `Request failed with status ${status}`,
    traceId,
    cause,
  });
}

/**
 * Normalises anything thrown by a request into an `ApiError`, or `null` when
 * it is not a request failure at all (a bug, an abort, a redirect).
 */
export function toApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (isAxiosLikeError(error)) {
    if (!error.response) {
      return new ApiError({ status: 0, message: error.message, cause: error });
    }
    return apiErrorFromResponse(
      error.response.status,
      error.response.data,
      error.response.headers,
      error,
    );
  }
  return null;
}

export function getApiStatus(error: unknown): number | undefined {
  return toApiError(error)?.status;
}

export function getTraceId(error: unknown): string | undefined {
  return toApiError(error)?.traceId;
}

/** The API's `message` (for display), or `fallback`. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = toApiError(error);
  if (apiError && apiError.status !== 0 && apiError.body?.message) {
    return apiError.body.message;
  }
  return fallback;
}

/** `error[]` as `{ field: message }`, or `undefined` when there are none. */
export function getApiFieldErrors(
  error: unknown,
): Record<string, string> | undefined {
  const apiError = toApiError(error);
  if (!apiError?.fieldErrors.length) return undefined;
  const result: Record<string, string> = {};
  for (const { field, message } of apiError.fieldErrors) {
    if (!(field in result)) result[field] = message;
  }
  return result;
}

type SetError<TField extends string> = (
  name: TField,
  error: { type: string; message: string },
  options?: { shouldFocus: boolean },
) => void;

/**
 * Maps a `400` response onto React Hook Form: `form.setError(field, …)` for
 * each `error[]` item whose `field` is one of `fields`. Returns the messages
 * that did not match a form field so the caller can show them elsewhere.
 */
export function applyApiFieldErrors<TField extends string>(
  error: unknown,
  setError: SetError<TField>,
  fields: readonly TField[],
): string[] {
  const apiError = toApiError(error);
  if (!apiError) return [];
  const unmatched: string[] = [];
  let focused = false;
  for (const { field, message } of apiError.fieldErrors) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as TField, { type: "server", message }, {
        shouldFocus: !focused,
      });
      focused = true;
    } else {
      unmatched.push(field ? `${field}: ${message}` : message);
    }
  }
  return unmatched;
}

/** Retry policy used by TanStack Query: network errors and `5xx` only. */
export function isRetryableError(error: unknown): boolean {
  const apiError = toApiError(error);
  if (!apiError) return false;
  return apiError.status === 0 || apiError.status >= 500;
}
