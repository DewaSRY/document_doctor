export interface CreateTransferBody {
  amount: number;
  description: string;
  from_account_id: number;
  to_account_id: number;
}

export interface TransferResponse {
  account_id: number;
  account_name: string;
  account_number: string;
  amount: string;
  description: string;
  id: number;
  is_main: boolean;
  to_account_id: number;
  to_account_name: string;
  to_account_number: string;
  type: string;
  user_id: number;
}
