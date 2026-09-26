export type AccountList = {
  id: number;
  name: string;
  number: string;
  currency: string;
};

export type DepositeStep = "account" | "details" | "preview";

export type DepositeDetails = {
  amount: number;
  description: string;
};
