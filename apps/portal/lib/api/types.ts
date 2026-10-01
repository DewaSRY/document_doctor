import { Packed } from "@/lib/masking-data/masking";

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code?: string;
  message: string;
  details?: ApiFieldError[];
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiSuccessResponse<TData = unknown> {
  data: TData;
  message?: string;
  meta?: ApiMeta;
}

export type ActionErrorPayload = {
  status?: number;
  data?: ApiErrorResponse;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorPayload };

export type MaskingActionResult<T> = Packed<ActionResult<T>>;
