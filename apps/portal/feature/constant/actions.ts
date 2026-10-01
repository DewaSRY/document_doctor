
"use server";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";
import type { CommonSuccessResponse } from "@/feature/common";
import type { FeatureGroup } from "./type";
import { constantClient } from "./client";

export async function getFeatureGroupsAction(lang: string): Promise<
  MaskingActionResult<CommonSuccessResponse<FeatureGroup[]>>
> {
  return runMaskingServerAction(async () => {
    const response = await constantClient.getFeatureGroups(lang);
    return response.data;
  });
}