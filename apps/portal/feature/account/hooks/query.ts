import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountResponse,
  RequestAccountbody,
  SearchAccountsParams,
  SearchMeAccountsParams,
} from "@/feature/account/type";
import type { CommonSuccessResponse, PaginationParams } from "@/feature/common";
import {
  createAccountAction,
  listMeAccountsAction,
  searchAccountByNumberAction,
} from "../actions";

// Masking server action for handling API requests with packed results
import { unpackActionResult } from "@/lib/api/unpack-server-result";

import { useDebounce } from "@/hooks/use-debaunch";

export const queryKeys = {
  all: ["accounts"] as const,
  list: (params: Partial<PaginationParams> = {}) =>
    [...queryKeys.all, "list", params] as const,
  searchByNumber: (params: SearchAccountsParams) =>
    [...queryKeys.all, "search-by-number", params] as const,
};

export function useAccounts(params: SearchMeAccountsParams) {
  const debouncedParams = useDebounce(params.name);

  const queryParams = { ...params, name: debouncedParams };

  return useQuery({
    queryKey: queryKeys.list(queryParams),
    queryFn: () => listMeAccountsAction(queryParams).then(unpackActionResult),

    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,

    enabled: debouncedParams === undefined || debouncedParams.length >= 2,
  });
}

export const useCreateAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<
    CommonSuccessResponse<AccountResponse>,
    Error,
    RequestAccountbody
  >({
    mutationFn: (body) => createAccountAction(body).then(unpackActionResult),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.all,
      });
    },
  });
};

export function useSearchAccountByNumber(
  params: SearchAccountsParams,
  options: { enabled?: boolean } = {},
) {
  const debouncedParams = useDebounce(params.number);

  const queryParams = { ...params, number: debouncedParams };
  return useQuery({
    queryKey: queryKeys.searchByNumber(queryParams),
    queryFn: () =>
      searchAccountByNumberAction(queryParams).then(unpackActionResult),
    enabled:
      (options.enabled ?? true) &&
      (debouncedParams === undefined || debouncedParams.length >= 2),
  });
}
