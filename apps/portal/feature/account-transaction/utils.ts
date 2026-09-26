import type { AccountEntriesResponse } from "./type";

const INCOMING_ENTRY_TYPES = new Set(["deposit", "received"]);

export function isIncomingEntry(entry: AccountEntriesResponse) {
  return INCOMING_ENTRY_TYPES.has(entry.type.toLowerCase());
}

export function getEntryLabel(
  entry: AccountEntriesResponse,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const type = entry.type.toLowerCase();
  if (type === "deposit") return t("deposit");
  if (type === "withdraw") return t("withdrawal");

  const counterparty = entry.to_account_name || entry.to_account_number;
  return type === "received"
    ? t("fromEntry", { name: counterparty })
    : t("toEntry", { name: counterparty });
}
