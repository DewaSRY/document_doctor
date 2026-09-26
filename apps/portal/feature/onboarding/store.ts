import { create } from "zustand";

import type { DirectoryContact, OnboardingAccount, OnboardingEntry } from "./type";
import { generateAccountNumber } from "./utils";

export class InsufficientFundsError extends Error {
  constructor() {
    super("INSUFFICIENT_FUNDS");
    this.name = "InsufficientFundsError";
  }
}

interface OnboardingState {
  account: OnboardingAccount | null;
  entries: OnboardingEntry[];
  nextEntryId: number;
  depositCount: number;
  transferCount: number;

  createAccount: (input: {
    name: string;
    description: string;
    currency: string;
    openingBalance: number;
  }) => OnboardingAccount;
  deposit: (input: { amount: number; description: string }) => OnboardingEntry;
  transfer: (input: {
    contact: DirectoryContact;
    amount: number;
    description: string;
  }) => OnboardingEntry;
  reset: () => void;
}

const INITIAL_STATE = {
  account: null as OnboardingAccount | null,
  entries: [] as OnboardingEntry[],
  nextEntryId: 1,
  depositCount: 0,
  transferCount: 0,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...INITIAL_STATE,

  createAccount({ name, description, currency, openingBalance }) {
    const now = new Date().toISOString();
    const account: OnboardingAccount = {
      id: 1,
      name,
      description,
      number: generateAccountNumber(),
      username: "you",
      currency,
      balance: openingBalance,
      is_main: true,
      created_at: now,
      updated_at: now,
    };
    set({ account });
    return account;
  },

  deposit({ amount, description }) {
    const { account, nextEntryId, entries } = get();
    if (!account) throw new Error("No account to deposit into");

    const now = new Date().toISOString();
    const entry: OnboardingEntry = {
      id: nextEntryId,
      account_id: account.id,
      account_name: account.name,
      account_number: account.number,
      to_account_id: account.id,
      to_account_name: account.name,
      to_account_number: account.number,
      amount,
      description,
      type: "deposit",
      is_main: account.is_main,
      user_id: 1,
      direction: "incoming",
      created_at: now,
    };

    set({
      account: { ...account, balance: account.balance + amount, updated_at: now },
      entries: [entry, ...entries],
      nextEntryId: nextEntryId + 1,
      depositCount: get().depositCount + 1,
    });

    return entry;
  },

  transfer({ contact, amount, description }) {
    const { account, nextEntryId, entries } = get();
    if (!account) throw new Error("No account to transfer from");
    if (amount > account.balance) throw new InsufficientFundsError();

    const now = new Date().toISOString();
    const entry: OnboardingEntry = {
      id: nextEntryId,
      account_id: account.id,
      account_name: account.name,
      account_number: account.number,
      to_account_id: contact.id,
      to_account_name: contact.name,
      to_account_number: contact.number,
      amount,
      description,
      type: "transfer",
      is_main: account.is_main,
      user_id: 1,
      direction: "outgoing",
      created_at: now,
    };

    set({
      account: { ...account, balance: account.balance - amount, updated_at: now },
      entries: [entry, ...entries],
      nextEntryId: nextEntryId + 1,
      transferCount: get().transferCount + 1,
    });

    return entry;
  },

  reset() {
    set({ ...INITIAL_STATE });
  },
}));
