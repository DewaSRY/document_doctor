import { BaseClient } from "../../lib/api/base-client";
import type { CommonSuccessResponse } from "@/feature/common";
import type {
  AccountResponse,
  AccountWithUserName,
  RequestAccountbody,
  SearchAccountsParams,
  SearchMeAccountsParams,
} from "./type";
export class AccountClient extends BaseClient {
  listMeAccounts({ name, page = 1, limit = 10 }: SearchMeAccountsParams) {
    return this.get<CommonSuccessResponse<AccountWithUserName[]>>({
      endpoint: "/accounts/me",
      params: { ...(name ? { name } : {}), page, limit },
    });
  }

  createAccount(body: RequestAccountbody) {
    return this.post<CommonSuccessResponse<AccountResponse>>({
      endpoint: "/accounts",
      body,
    });
  }

  searchAccountByNumber({
    number,
    page = 1,
    limit = 10,
  }: SearchAccountsParams) {
    return this.get<CommonSuccessResponse<AccountWithUserName[]>>({
      endpoint: "/accounts/search-by-number",
      params: { number, page, limit },
    });
  }
}

export const accountClient = new AccountClient();
