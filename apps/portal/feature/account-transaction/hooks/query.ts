import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys as accountQueryKeys } from "@/feature/account";
import type { PaginationParams } from "@/feature/common";
import type {
  AccountEntriesResponse,
  DepositRequestBody,
  DisplayLedgerEntry,
} from "../type";
import { isIncomingEntry } from "../utils";
import {
  depositAction,
  getAccountEntriesAction,
  getRecentTransactionsAction,
} from "../actions";

// Masking server action for handling API requests with packed results
import { unpackActionResult } from "@/lib/api/unpack-server-result";

function toDisplayLedgerEntry(
  entry: AccountEntriesResponse,
): DisplayLedgerEntry {
  return {
    ...entry,
    direction: isIncomingEntry(entry) ? "incoming" : "outgoing",
  };
}

export const queryKeys = {
  entries: (
    accountId: number,
    params: Partial<PaginationParams> = { page: 1, limit: 10 },
  ) => ["entries", accountId, params] as const,
  recentTransactions: (
    accountId: number,
    params: Partial<PaginationParams> = { page: 1, limit: 10 },
  ) => ["recentTransactions", accountId, params] as const,
};

export function useAccountEntries(
  accountId: number,
  params: Partial<PaginationParams> = { page: 1, limit: 10 },
) {
  return useQuery({
    queryKey: queryKeys.entries(accountId, params),
    queryFn: () =>
      getAccountEntriesAction(accountId, params).then(unpackActionResult),
    select: (response) => ({
      ...response,
      data: response.data.map((entry) => toDisplayLedgerEntry(entry)),
    }),
  });
}

export function useRecentTransactions(
  accountId: number,
  params: Partial<PaginationParams> = { page: 1, limit: 10 },
) {
  return useQuery({
    queryKey: queryKeys.recentTransactions(accountId, params),
    queryFn: () =>
      getRecentTransactionsAction(accountId, params).then(unpackActionResult),
  });
}

export function useDeposit(accountId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DepositRequestBody) =>
      depositAction(accountId, body).then(unpackActionResult),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entries(accountId, {
          page: 1,
          limit: 10,
        }),
      });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
    },
  });
}
