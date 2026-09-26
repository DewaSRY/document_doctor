export interface OnboardingAccount {
  id: number;
  name: string;
  description: string;
  number: string;
  username: string;
  currency: string;
  balance: number;
  is_main: boolean;
  created_at: string;
  updated_at: string;
}

export type OnboardingEntryType = "deposit" | "transfer";

export interface OnboardingEntry {
  id: number;
  account_id: number;
  account_name: string;
  account_number: string;
  to_account_id: number;
  to_account_name: string;
  to_account_number: string;
  amount: number;
  description: string;
  type: OnboardingEntryType;
  is_main: boolean;
  user_id: number;
  direction: "incoming" | "outgoing";
  created_at: string;
}

export interface DirectoryContact {
  id: number;
  name: string;
  number: string;
  username: string;
  recent?: boolean;
}
