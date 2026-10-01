import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { toApiError } from "./error";

/**
 * Browser transport for signed-in calls (ADR-008 §7.2).
 *
 * - `Authorization: Bearer <Firebase ID token>` from the token provider that
 *   `feature/auth` installs with `setTokenProvider()` — `lib/` never imports
 *   `feature/` (rule I1).
 * - `X-Timezone` from `Intl`.
 * - `401` → force-refresh the token and retry **once**; a second `401` calls
 *   the unauthorized handler (sign out → `/logout`).
 * - Every failure is rejected as an `ApiError` (status, message, field
 *   errors, `X-Trace-Id`).
 *
 * No cookies are sent to the API (`withCredentials: false`, ADR-003 §3.6).
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8088/v1"
).replace(/\/+$/, "");

export type TokenProvider = (forceRefresh: boolean) => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** Installed once by `feature/auth`. Pass `null` to remove it (tests). */
export function setTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

/** Called when a request is still `401` after one token refresh. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Set by the response interceptor so a request is retried at most once. */
    _authRetried?: boolean;
    /** Opt out of the unauthorized handler (e.g. the sign-in call itself). */
    skipUnauthorizedHandler?: boolean;
  }
}

function currentTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

async function attachHeaders(config: InternalAxiosRequestConfig, force = false) {
  const headers = AxiosHeaders.from(config.headers);
  const token = tokenProvider ? await tokenProvider(force) : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  const timeZone = currentTimeZone();
  if (timeZone) headers.set("X-Timezone", timeZone);
  config.headers = headers;
  return config;
}

export function installInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => attachHeaders(config));

  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config;
    const status = error.response?.status;

    if (status === 401 && config && !config._authRetried && tokenProvider) {
      config._authRetried = true;
      const fresh = await tokenProvider(true).catch(() => null);
      if (fresh) {
        const retryConfig = await attachHeaders(config, false);
        const headers = AxiosHeaders.from(retryConfig.headers);
        headers.set("Authorization", `Bearer ${fresh}`);
        retryConfig.headers = headers;
        return instance.request(retryConfig);
      }
    }

    if (status === 401 && !config?.skipUnauthorizedHandler) {
      unauthorizedHandler?.();
    }

    return Promise.reject(toApiError(error) ?? error);
  });

  return instance;
}

export const browserClient: AxiosInstance = installInterceptors(
  axios.create({
    baseURL: API_BASE_URL,
    timeout: 15_000,
    withCredentials: false,
    headers: { Accept: "application/json" },
  }),
);
