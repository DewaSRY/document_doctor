"use server";

import { revalidatePath } from "next/cache";
import type { CommonSuccessResponse } from "@/feature/common";
import { accountClient } from "./client";
import type {
  AccountResponse,
  AccountWithUserName,
  RequestAccountbody,
  SearchAccountsParams,
  SearchMeAccountsParams,
} from "./type";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";

export async function listMeAccountsAction(
  params: SearchMeAccountsParams,
): Promise<MaskingActionResult<CommonSuccessResponse<AccountWithUserName[]>>> {
  return runMaskingServerAction(async () => {
    const response = await accountClient.listMeAccounts(params);
    return response.data;
  });
}

export async function searchAccountByNumberAction(
  params: SearchAccountsParams,
): Promise<MaskingActionResult<CommonSuccessResponse<AccountWithUserName[]>>> {
  return runMaskingServerAction(async () => {
    const response = await accountClient.searchAccountByNumber(params);
    return response.data;
  });
}

export async function createAccountAction(
  body: RequestAccountbody,
): Promise<MaskingActionResult<CommonSuccessResponse<AccountResponse>>> {
  return runMaskingServerAction(async () => {
    const response = await accountClient.createAccount(body);
    revalidatePath("/[locale]/(protected)", "layout");
    return response.data;
  });
}
