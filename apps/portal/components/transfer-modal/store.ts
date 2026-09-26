import { create } from "zustand";

import type {
  DestinationAccount,
  SourceAccount,
  TransferDetails,
  TransferStep,
} from "./type";

type State = {
  step: TransferStep;
  sourceAccount: SourceAccount | null;
  destinationAccount: DestinationAccount | null;
  details: TransferDetails | null;
  fieldErrors: Record<string, string> | null;

  setSourceAccount: (account: SourceAccount | null) => void;
  setDestinationAccount: (account: DestinationAccount | null) => void;
  setStep: (step: TransferStep) => void;
  setDetails: (details: TransferDetails) => void;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  reset: () => void;
};

const initialState = {
  step: "source" as TransferStep,
  sourceAccount: null as SourceAccount | null,
  destinationAccount: null as DestinationAccount | null,
  details: null as TransferDetails | null,
  fieldErrors: null as Record<string, string> | null,
};

export const useTransferStore = create<State>((set) => {
  function setSourceAccount(account: SourceAccount | null) {
    set({ sourceAccount: account });
  }

  function setDestinationAccount(account: DestinationAccount | null) {
    set({ destinationAccount: account });
  }

  function setStep(step: TransferStep) {
    set({ step });
  }

  function setDetails(details: TransferDetails) {
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
    setSourceAccount,
    setDestinationAccount,
    setStep,
    setDetails,
    setFieldErrors,
    reset,
  };
});
