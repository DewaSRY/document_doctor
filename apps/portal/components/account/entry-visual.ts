import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

export interface EntryVisual {
  Icon: LucideIcon;
  iconWrapperClassName: string;
  amountClassName: string;
}

const SEND_VISUAL: EntryVisual = {
  Icon: ArrowUpRight,
  iconWrapperClassName: "bg-destructive/10 text-destructive",
  amountClassName: "text-destructive",
};

const RECEIVED_VISUAL: EntryVisual = {
  Icon: ArrowDownLeft,
  iconWrapperClassName: "bg-success/10 text-success",
  amountClassName: "text-success",
};

const DEPOSIT_VISUAL: EntryVisual = {
  Icon: ArrowDownToLine,
  iconWrapperClassName: "bg-blue-500/10 text-blue-500",
  amountClassName: "text-blue-500",
};

const WITHDRAW_VISUAL: EntryVisual = {
  Icon: ArrowUpFromLine,
  iconWrapperClassName: "bg-warning/10 text-warning",
  amountClassName: "text-warning",
};

export function getEntryVisual(type: string): EntryVisual {
  switch (type.toLowerCase()) {
    case "send":
      return SEND_VISUAL;
    case "deposit":
      return DEPOSIT_VISUAL;
    case "withdraw":
      return WITHDRAW_VISUAL;
    case "received":
    default:
      return RECEIVED_VISUAL;
  }
}
