"use client";

import { useMemo, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useTable } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  accountEntriesTableFeatures,
  getAccountEntriesColumns,
} from "@/components/account/account-entries-columns";
import {
  useAccountEntries,
  type DisplayLedgerEntry,
} from "@/feature/account-transaction";
import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";
import Pagination from "../ui/pagination";

const EMPTY_ENTRIES: DisplayLedgerEntry[] = [];

export function AccountEntriesCard({
  accountName,
  accountId,
  currency,
}: {
  accountName: string;
  accountId: number;
  currency: string;
}) {
  const { t } = useTranslation("account");
  const [isPending, startTransition] = useTransition();
  const queryStateOptions = { shallow: false as const, startTransition };

  const [{ page, limit }, setQuery] = useQueryStates({
    page: parseAsInteger.withOptions(queryStateOptions).withDefault(1),
    limit: parseAsInteger.withOptions(queryStateOptions).withDefault(25),
  });

  const { data: accountEntries } = useAccountEntries(accountId, {
    page,
    limit,
  });

  const columns = useMemo(
    () => getAccountEntriesColumns({ currency, t }),
    [currency, t],
  );

  const table = useTable({
    features: accountEntriesTableFeatures,
    columns,
    data: accountEntries?.data ?? EMPTY_ENTRIES,
  });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t("accountEntriesTitle")}</CardTitle>
        <CardDescription>
          {t("accountEntriesDescription", { name: accountName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {accountEntries?.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">{t("noEntriesTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("noEntriesDescription")}
            </p>
          </div>
        ) : (
          <>
            <Table className="min-w-175">
              <TableHeader className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={
                          header.column.columnDef.meta?.align === "right"
                            ? "px-4 py-3 text-right"
                            : "px-4 py-3"
                        }
                      >
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.columnDef.meta?.align === "right"
                            ? "px-4 py-4 text-right"
                            : "px-4 py-4"
                        }
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={accountEntries?.meta?.page || 1}
              onPageChange={(p) =>
                void setQuery((prev) => {
                  prev.page = p;
                  return prev;
                })
              }
              totalRows={accountEntries?.meta?.total || 0}
              rowsPerPageOptions={[25, 50, 100]}
              rowsPerPage={accountEntries?.meta?.limit || 25}
              onRowsPerPageChange={(l) =>
                void setQuery((prev) => {
                  prev.limit = l;
                  return prev;
                })
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
