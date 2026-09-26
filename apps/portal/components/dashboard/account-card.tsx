"use client";

import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "../ui/card";
import type { AccountWithUserName } from "@/feature/account";

function formatBalance(balance: string) {
  const value = Number(balance);
  if (Number.isNaN(value)) return balance;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function AccountListItem({ account }: { account: AccountWithUserName }) {
  return (
    <Link href={`/account/${account.id}`} className="block">
      <Card className="gap-4 px-4 py-4! transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-sm font-semibold text-primary">
              {initials(account.name || account.username)}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {account.name}
                {account.is_main && (
                  <Star
                    className="size-3.5 shrink-0 fill-warning text-warning"
                    aria-hidden
                  />
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {account.number}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 border-t pt-3">
          <span className="font-mono text-lg font-semibold tracking-tight">
            {formatBalance(account.balance)}
          </span>
          <span className="text-xs text-muted-foreground">
            {account.currency}
          </span>
        </div>
      </Card>
    </Link>
  );
}
