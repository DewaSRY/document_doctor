"use server";

import { revalidatePath } from "next/cache";
import type { CommonSuccessResponse } from "@/feature/common";
import type {
  AccountResponse,
  AccountWithUserName,
  RequestAccountbody,
} from "@/feature/account";
import { accountManageClient } from "./client";
import type { DeleteAccountResponse } from "./type";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";

export async function detailAccountAction(
  id: number,
): Promise<MaskingActionResult<CommonSuccessResponse<AccountWithUserName>>> {
  return runMaskingServerAction(async () => {
    const response = await accountManageClient.detailAccount(id);
    return response.data;
  });
}

export async function updateAccountAction(
  id: number,
  body: RequestAccountbody,
): Promise<MaskingActionResult<CommonSuccessResponse<AccountResponse>>> {
  return runMaskingServerAction(async () => {
    const response = await accountManageClient.updateAccount(id, body);
    revalidatePath("/[locale]/(protected)", "layout");
    return response.data;
  });
}

export async function deleteAccountAction(
  id: number,
): Promise<MaskingActionResult<CommonSuccessResponse<DeleteAccountResponse>>> {
  return runMaskingServerAction(async () => {
    const response = await accountManageClient.deleteAccount(id);
    revalidatePath("/[locale]/(protected)", "layout");
    return response.data;
  });
}
