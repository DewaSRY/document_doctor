"use server";

import { revalidatePath } from "next/cache";
import type { CommonSuccessResponse, PaginationParams } from "@/feature/common";
import { accountTransactionClient } from "./client";
import type {
  AccountEntriesResponse,
  AccountPublicResponse,
  DepositRequestBody,
} from "./type";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";

export async function getAccountEntriesAction(
  accountId: number,
  params: Partial<PaginationParams>,
): Promise<
  MaskingActionResult<CommonSuccessResponse<AccountEntriesResponse[]>>
> {
  return runMaskingServerAction(async () => {
    const response = await accountTransactionClient.getAccountEntries(
      accountId,
      params,
    );
    return response.data;
  });
}

export async function getRecentTransactionsAction(
  accountId: number,
  params: Partial<PaginationParams>,
): Promise<
  MaskingActionResult<CommonSuccessResponse<AccountPublicResponse[]>>
> {
  return runMaskingServerAction(async () => {
    const response = await accountTransactionClient.getRecentTransactions(
      accountId,
      params,
    );
    return response.data;
  });
}

export async function depositAction(
  accountId: number,
  body: DepositRequestBody,
): Promise<MaskingActionResult<CommonSuccessResponse<AccountEntriesResponse>>> {
  return runMaskingServerAction(async () => {
    const response = await accountTransactionClient.deposit(accountId, body);
    revalidatePath("/[locale]/(protected)", "layout");
    return response.data;
  });
}
