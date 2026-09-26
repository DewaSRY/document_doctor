import { create } from "zustand";

import type { AccountList, DepositeDetails, DepositeStep } from "./type";

type State = {
  step: DepositeStep;
  accountList: AccountList[];
  selectedAccount: AccountList | null;
  details: DepositeDetails | null;
  fieldErrors: Record<string, string> | null;

  setSelectedAccount: (account: AccountList | null) => void;
  setStep: (step: DepositeStep) => void;
  setDetails: (details: DepositeDetails) => void;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  reset: () => void;
};

const initialState = {
  step: "account" as DepositeStep,
  accountList: [] as AccountList[],
  selectedAccount: null as AccountList | null,
  details: null as DepositeDetails | null,
  fieldErrors: null as Record<string, string> | null,
};

export const useDepositeStore = create<State>((set) => {
  function setSelectedAccount(account: AccountList | null) {
    set({ selectedAccount: account });
  }

  function setStep(step: DepositeStep) {
    set({ step });
  }

  function setDetails(details: DepositeDetails) {
    set({ details });
  }

  function setFieldErrors(fieldErrors: Record<string, string> | null) {
    set({ fieldErrors });
  }

  function reset() {
    set(initialState);
  }

  return {
    ...initialState,
    setSelectedAccount,
    setStep,
    setDetails,
    setFieldErrors,
    reset,
  };
});
