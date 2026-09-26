import { BaseClient } from "../../lib/api/base-client";
import type {
  CommonSuccessResponse,
  PaginationParams,
} from "@/feature/common";
import type {
  AccountEntriesResponse,
  DepositRequestBody,
  AccountPublicResponse,
} from "./type";

export class AccountTranscationClient extends BaseClient {
  deposit(accountId: number, body: DepositRequestBody) {
    return this.post<CommonSuccessResponse<AccountEntriesResponse>>({
      endpoint: `/accounts/${accountId}/deposit`,
      body,
    });
  }

  getAccountEntries(
    accountId: number,
    { page = 1, limit = 10 }: Partial<PaginationParams>,
  ) {
    return this.get<CommonSuccessResponse<AccountEntriesResponse[]>>({
      endpoint: `/accounts/${accountId}/entries`,
      params: {
        page,
        limit,
      },
    });
  }

  getRecentTransactions(
    accountId: number,
    { page = 1, limit = 10 }: Partial<PaginationParams>,
  ) {
    return this.get<CommonSuccessResponse<AccountPublicResponse[]>>({
      endpoint: `/accounts/${accountId}/recent-destinations`,
      params: {
        page,
        limit,
      },
    });
  }
}

export const accountTransactionClient = new AccountTranscationClient();
