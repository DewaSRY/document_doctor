/**
 * Response envelopes of the hub API — ADR-003 §3.5, ADR-008 §7.4.
 *
 * Every response body is one of three shapes: a plain success, a paginated
 * success, or an error. The UI branches on the HTTP `code`, never on the
 * `message` text.
 */

/** Plain success envelope: one object, or a non-paged list, in `data`. */
export type ApiResponse<T> = { data: T; code: number; message: string };

/** `meta` of a paginated success envelope. `total_page` stays snake_case. */
export type PageMeta = {
  total: number;
  page: number;
  limit: number;
  total_page: number;
};

/**
 * Paginated success envelope (`Page<X>` in ADR-003). `TExtraMeta` covers
 * endpoints that add fields to `meta`, e.g. `/admin/transactions` adds
 * `summary`.
 */
export type ApiPage<T, TExtraMeta extends object = object> = ApiResponse<T[]> & {
  meta: PageMeta & TExtraMeta;
};

export type ApiFieldError = { field: string; message: string };

/** Error envelope (`4xx`, `5xx`). `error` is `[]` unless it is a `400`. */
export type ApiErrorBody = {
  code: number;
  message: string;
  error: ApiFieldError[];
};

/** Money is an integer number of rupiah plus a currency code (ADR-003 §3.3). */
export type Money = { amount: number; currency: string };

/** Standard list query (ADR-003 §3.4). `page` is 1-based. */
export type PageParams = {
  page?: number;
  limit?: number;
  sort?: string;
};

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.code === "number" &&
    typeof body.message === "string" &&
    Array.isArray(body.error)
  );
}

export function isApiPage<T>(value: unknown): value is ApiPage<T> {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  const meta = body.meta as Record<string, unknown> | undefined;
  return (
    Array.isArray(body.data) &&
    typeof meta === "object" &&
    meta !== null &&
    typeof meta.total_page === "number"
  );
}

/** An empty page, used when a public list cannot be loaded. */
export function emptyPage<T>(page = 1, limit = DEFAULT_PAGE_LIMIT): ApiPage<T> {
  return {
    data: [],
    code: 200,
    message: "",
    meta: { total: 0, page, limit, total_page: 0 },
  };
}

/** Clamps `page`/`limit` to the ranges the API accepts. */
export function normalizePageParams(
  params: PageParams,
  defaults: { limit?: number } = {},
): Required<Pick<PageParams, "page" | "limit">> {
  const page = Number.isFinite(params.page) && (params.page ?? 0) >= 1
    ? Math.floor(params.page as number)
    : 1;
  const rawLimit = params.limit ?? defaults.limit ?? DEFAULT_PAGE_LIMIT;
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_PAGE_LIMIT),
  );
  return { page, limit };
}
