import { create } from "zustand";

import type { CreateAccountFormValues, CreateAccountStep } from "./type";

type State = {
  step: CreateAccountStep;
  values: CreateAccountFormValues | null;
  fieldErrors: Record<string, string> | null;

  setStep: (step: CreateAccountStep) => void;
  setValues: (values: CreateAccountFormValues) => void;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  reset: () => void;
};

const initialState = {
  step: "form" as CreateAccountStep,
  values: null as CreateAccountFormValues | null,
  fieldErrors: null as Record<string, string> | null,
};

export const useCreateAccountStore = create<State>((set) => {
  function setStep(step: CreateAccountStep) {
    set({ step });
  }

  function setValues(values: CreateAccountFormValues) {
    set({ values });
  }

  function setFieldErrors(fieldErrors: Record<string, string> | null) {
    set({ fieldErrors });
  }

  function reset() {
    set(initialState);
  }

  return {
    ...initialState,
    setStep,
    setValues,
    setFieldErrors,
    reset,
  };
});
