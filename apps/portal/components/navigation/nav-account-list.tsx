"use client";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { formatBalance } from "@/lib/number";
import { useAccounts } from "@/feature/account";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useTransition } from "react";
import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";
import { SearchInput } from "../common/search-input";

export function NavAccountList() {
  const { t } = useTranslation("common");
  const pathname = usePathname();

  const [_, startTransition] = useTransition();
  const queryStateOptions = { shallow: false as const, startTransition };

  const [{ account_page, account_limit, search_account }, setQuery] =
    useQueryStates({
      account_page: parseAsInteger
        .withOptions(queryStateOptions)
        .withDefault(1),
      account_limit: parseAsInteger
        .withOptions(queryStateOptions)
        .withDefault(25),
      search_account: parseAsString
        .withOptions(queryStateOptions)
        .withDefault(""),
    });

  const { data: accountsResponse, isLoading } = useAccounts({
    page: account_page,
    limit: account_limit,
    name: search_account,
  });

  const hasAccounts = !isLoading && !!accountsResponse?.data?.length;

  function handleSearch(value: string) {
    setQuery({ search_account: value });
  }

  return (
    <SidebarGroup className="flex min-h-0 flex-1 flex-col">
      <SidebarGroupLabel className="text-lg">
        {t("yourAccounts")}
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
        <div className="py-2">
          <SearchInput
            search={search_account}
            onSearch={handleSearch}
            placeholder={t("searchAccountsPlaceholder")}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-3 px-3 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : hasAccounts ? (
            accountsResponse.data.map((account) => {
              const isActive = pathname?.endsWith(`/account/${account.id}`);

              return (
                <Link
                  key={account.id}
                  href={`/account/${account.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-xs p-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  <div className="flex min-w-0 flex-col space-y-1.5">
                    <div className="flex flex-row items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">
                          {account.name || account.username}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {account.number}
                        </span>
                      </div>

                      {account.is_main && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Star
                              className="size-3.5 shrink-0 fill-warning text-warning"
                              aria-hidden
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("mainAccount")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t("noAccounts")}
            </p>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
