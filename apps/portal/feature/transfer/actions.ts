"use server";

import { revalidatePath } from "next/cache";
import type { CommonSuccessResponse } from "@/feature/common";
import { transferClient } from "./client";
import type { CreateTransferBody, TransferResponse } from "./type";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";

export async function createTransferAction(
  body: CreateTransferBody,
): Promise<MaskingActionResult<CommonSuccessResponse<TransferResponse>>> {
  return runMaskingServerAction(async () => {
    const response = await transferClient.createTransfer(body);
    revalidatePath("/[locale]/(protected)", "layout");
    return response.data;
  });
}
