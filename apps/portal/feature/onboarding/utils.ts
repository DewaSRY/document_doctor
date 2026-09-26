import type { AccountWithUserName } from "@/feature/account/type";
import type { DisplayLedgerEntry } from "@/feature/account-transaction/type";
import type { OnboardingAccount, OnboardingEntry } from "./type";

export function generateAccountNumber() {
  const suffix = Math.floor(100000000 + Math.random() * 900000000);
  return `SB-${suffix}`;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Adapts the local demo account to the same shape the real dashboard/account
 * page components expect, so those presentational components can be reused
 * as-is against simulated data. */
export function toAccountWithUserName(account: OnboardingAccount): AccountWithUserName {
  return {
    id: account.id,
    name: account.name,
    description: account.description,
    number: account.number,
    username: account.username,
    currency: account.currency,
    balance: account.balance.toFixed(2),
    is_main: account.is_main,
    created_at: account.created_at,
    updated_at: account.updated_at,
    user_id: 1,
  };
}

/** Adapts a demo ledger entry to the same shape the real account entries
 * table expects, so `getAccountEntriesColumns`/`getEntryLabel` can render it
 * without modification. */
export function toDisplayLedgerEntry(entry: OnboardingEntry): DisplayLedgerEntry {
  return {
    id: entry.id,
    account_id: entry.account_id,
    account_name: entry.account_name,
    account_number: entry.account_number,
    to_account_id: entry.to_account_id,
    to_account_name: entry.to_account_name,
    to_account_number: entry.to_account_number,
    amount: entry.amount.toFixed(2),
    description: entry.description,
    type: entry.type,
    is_main: entry.is_main,
    user_id: entry.user_id,
    direction: entry.direction,
  };
}
