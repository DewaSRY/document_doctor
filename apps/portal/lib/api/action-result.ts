import axios from "axios";
import type { ApiErrorResponse } from "./types";

export type ActionErrorPayload = {
  status?: number;
  data?: ApiErrorResponse;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorPayload };

export async function runServerAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (axios.isAxiosError<ApiErrorResponse>(error) && error.response) {
      return {
        ok: false,
        error: { status: error.response.status, data: error.response.data },
      };
    }
    throw error;
  }
}

export function unwrapActionResult<T>(result: ActionResult<T>): T {
  if (result.ok) {
    return result.data;
  }

  const error = new Error(
    result.error.data?.error?.message ?? "Request failed",
  ) as Error & {
    isAxiosError: true;
    response: ActionErrorPayload;
  };
  error.isAxiosError = true;
  error.response = result.error;
  throw error;
}
