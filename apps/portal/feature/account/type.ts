import type { PaginationParams } from "@/feature/common";

export type AccountResponse = {
  balance: string;
  created_at: string;
  currency: string;
  description: string;
  id: number;
  is_main: boolean;
  name: string;
  number: string;
  user_id: number;
};

export interface AccountWithUserName {
  id: number;
  balance: string;
  currency: string;
  created_at: string;
  updated_at: string;
  description: string;
  is_main: boolean;
  name: string;
  number: string;
  user_id: number;
  username: string;
}

export interface RequestAccountbody {
  description: string;
  name: string;
}
export interface SearchMeAccountsParams extends Partial<PaginationParams> {
  name?: string;
}

export interface SearchAccountsParams extends Partial<PaginationParams> {
  number: string;
}
