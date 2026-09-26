import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys as accountQueryKeys } from "@/feature/account";
import { queryKeys as accountTransactionQueryKeys } from "@/feature/account-transaction";

import { createTransferAction } from "../actions";
import type { CreateTransferBody } from "../type";

// Masking server action for handling API requests with packed results
import { unpackActionResult } from "@/lib/api/unpack-server-result";

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransferBody) =>
      createTransferAction(body).then(unpackActionResult),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: accountTransactionQueryKeys.entries(
          variables.from_account_id,
          {
            page: 1,
            limit: 10,
          },
        ),
      });
      queryClient.invalidateQueries({
        queryKey: accountTransactionQueryKeys.recentTransactions(
          variables.from_account_id,
          { page: 1, limit: 10 },
        ),
      });
    },
  });
}
