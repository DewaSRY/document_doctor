import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { browserClient } from "./browser-client";

export type SafeParamValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export interface RequestParams {
  [key: string]: SafeParamValue;
}

export interface RequestOptions {
  endpoint: string;
  body?: unknown;
  params?: RequestParams;
  config?: AxiosRequestConfig;
}

export interface GetRequestOptions {
  endpoint: string;
  params?: RequestParams;
  config?: AxiosRequestConfig;
}

/** Drops `undefined`, `null`, and `""` so they never reach the query string. */
export function cleanParams(params?: RequestParams): RequestParams | undefined {
  if (!params) return undefined;
  const result: RequestParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}

/** Repeats array params (`status=PAID&status=FAILED`), as Spring expects. */
function serializeParams(params: RequestParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else if (value !== undefined && value !== null) search.append(key, String(value));
  }
  return search.toString();
}

/**
 * Base for every browser feature client (`class BillingClient extends
 * BaseClient`). Methods take one options object and return the Axios
 * response whose `data` is the ADR-003 envelope.
 */
export class BaseClient {
  protected readonly instance: AxiosInstance;

  constructor(instance: AxiosInstance = browserClient) {
    this.instance = instance;
  }

  private withParams(config: AxiosRequestConfig = {}, params?: RequestParams) {
    const cleaned = cleanParams(params);
    return cleaned
      ? { ...config, params: cleaned, paramsSerializer: serializeParams }
      : config;
  }

  protected get<TResponse = unknown>(
    options: GetRequestOptions,
  ): Promise<AxiosResponse<TResponse>> {
    const { endpoint, params, config } = options;
    return this.instance.get<TResponse>(endpoint, this.withParams(config, params));
  }

  protected post<TResponse = unknown>(
    options: RequestOptions,
  ): Promise<AxiosResponse<TResponse>> {
    const { endpoint, body, params, config } = options;
    return this.instance.post<TResponse>(endpoint, body, this.withParams(config, params));
  }

  protected put<TResponse = unknown>(
    options: RequestOptions,
  ): Promise<AxiosResponse<TResponse>> {
    const { endpoint, body, params, config } = options;
    return this.instance.put<TResponse>(endpoint, body, this.withParams(config, params));
  }

  protected patch<TResponse = unknown>(
    options: RequestOptions,
  ): Promise<AxiosResponse<TResponse>> {
    const { endpoint, body, params, config } = options;
    return this.instance.patch<TResponse>(endpoint, body, this.withParams(config, params));
  }

  protected delete<TResponse = unknown>(
    options: Omit<RequestOptions, "body">,
  ): Promise<AxiosResponse<TResponse>> {
    const { endpoint, params, config } = options;
    return this.instance.delete<TResponse>(endpoint, this.withParams(config, params));
  }
}
