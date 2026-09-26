import { create } from "zustand";

import type { EditAccountFormValues, EditAccountStep } from "./type";

type State = {
  step: EditAccountStep;
  values: EditAccountFormValues | null;
  fieldErrors: Record<string, string> | null;

  setStep: (step: EditAccountStep) => void;
  setValues: (values: EditAccountFormValues) => void;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  reset: () => void;
};

const initialState = {
  step: "form" as EditAccountStep,
  values: null as EditAccountFormValues | null,
  fieldErrors: null as Record<string, string> | null,
};

export const useEditAccountStore = create<State>((set) => {
  function setStep(step: EditAccountStep) {
    set({ step });
  }

  function setValues(values: EditAccountFormValues) {
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
