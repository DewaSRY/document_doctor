import { BaseClient } from "../../lib/api/base-client";
import type { CommonSuccessResponse } from "@/feature/common";
import type { DeleteAccountResponse } from "./type";
import type {
  RequestAccountbody,
  AccountWithUserName,
  AccountResponse,
} from "@/feature/account";

export class AccountManageClient extends BaseClient {
  detailAccount(id: number) {
    return this.get<CommonSuccessResponse<AccountWithUserName>>({
      endpoint: `/accounts/${id}`,
    });
  }

  updateAccount(id: number, body: RequestAccountbody) {
    return this.put<CommonSuccessResponse<AccountResponse>>({
      endpoint: `/accounts/${id}`,
      body,
    });
  }

  deleteAccount(id: number) {
    return this.delete<CommonSuccessResponse<DeleteAccountResponse>>({
      endpoint: `/accounts/${id}`,
    });
  }
}

export const accountManageClient = new AccountManageClient();
