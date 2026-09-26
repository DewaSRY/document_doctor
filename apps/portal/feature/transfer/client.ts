import { BaseClient } from "../../lib/api/base-client";
import type { CommonSuccessResponse } from "@/feature/common";
import type { CreateTransferBody, TransferResponse } from "./type";

export class TransferClient extends BaseClient {
  createTransfer(body: CreateTransferBody) {
    return this.post<CommonSuccessResponse<TransferResponse>>({
      endpoint: "/transactions/transfer",
      body,
    });
  }
}

export const transferClient = new TransferClient();
