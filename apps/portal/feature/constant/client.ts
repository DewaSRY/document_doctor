import { BaseClient } from "@/lib/api/base-client";
import { serverApiClient } from "@/lib/api/server-client";
import type { ApiSuccessResponse } from "@/lib/api/types";
import type {  FeatureGroup } from "./type";


export class ConstantClient extends BaseClient {
  getFeatureGroups(lang: string) {
    return this.get<ApiSuccessResponse<FeatureGroup[]>>({
      endpoint: "/features",
      params: {
        lang,
      },
    });
  }
}

export const constantClient = new ConstantClient(serverApiClient);
