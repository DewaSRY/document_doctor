import {
  MutationCache,
  QueryCache,
  QueryClient,
  type Mutation,
} from "@tanstack/react-query";
import {
  getApiErrorMessage,
  getTraceId,
  isRetryableError,
} from "@/lib/api/error";
import { pushToast, type ToastText } from "@/lib/toast/store";

const MAX_QUERY_RETRIES = 2;

const DEFAULT_QUERY_ERROR: ToastText = { key: "common:toast.loadFailed" };
const DEFAULT_MUTATION_ERROR: ToastText = {
  key: "common:toast.requestFailed",
};

type ToastTextResolver<TData = unknown, TVariables = unknown> =
  | ToastText
  | ((data: TData, variables: TVariables) => ToastText);

/**
 * Per-hook toast feedback, set via `meta` on useQuery/useMutation.
 * - Mutations toast on success (when `successMessage` is set) and on error.
 * - Queries toast on error only; success of a read is visible in the UI itself.
 * `errorMessage` is the toast title; the backend's error message (if any)
 * becomes the description. Pass `false` to opt a hook out of a toast.
 */
export interface RequestFeedbackMeta extends Record<string, unknown> {
  successMessage?: ToastTextResolver<never, never> | false;
  errorMessage?: ToastText | false;
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: RequestFeedbackMeta;
    mutationMeta: RequestFeedbackMeta;
  }
}

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  return isRetryableError(error);
}

// A redirect() thrown during render is navigation, not a failure.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

function toastError(
  error: unknown,
  title: ToastText | false | undefined,
  fallback: ToastText,
) {
  if (title === false || isRedirectError(error)) return;
  const message = getApiErrorMessage(error, "");
  const traceId = getTraceId(error);
  const description = [message, traceId ? `Trace ID: ${traceId}` : ""]
    .filter(Boolean)
    .join(" · ");
  pushToast({
    variant: "error",
    title: title ?? fallback,
    description: description || undefined,
  });
}

function toastMutationSuccess(
  data: unknown,
  variables: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>,
) {
  const message = mutation.meta?.successMessage as
    | ToastTextResolver
    | false
    | undefined;
  if (!message) return;
  pushToast({
    variant: "success",
    title: typeof message === "function" ? message(data, variables) : message,
  });
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta) {
          toastError(error, query.meta.errorMessage, DEFAULT_QUERY_ERROR);
        }
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: (data, variables, _context, mutation) =>
        toastMutationSuccess(data, variables, mutation),
      onError: (error, _variables, _context, mutation) =>
        toastError(error, mutation.meta?.errorMessage, DEFAULT_MUTATION_ERROR),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
