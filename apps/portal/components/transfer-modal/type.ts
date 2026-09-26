export type TransferStep = "source" | "destination" | "details" | "preview";

export type SourceAccount = {
  id: number;
  name: string;
  number: string;
  currency: string;
};

export type DestinationAccount = {
  id: number;
  name: string;
  number: string;
  username: string;
};

export type TransferDetails = {
  amount: number;
  description: string;
};
