"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTable } from "@tanstack/react-table";
import { AnimatePresence, motion } from "motion/react";
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
import type { DisplayLedgerEntry } from "@/feature/account-transaction";

interface Props {
  accountName: string;
  currency: string;
  entries: DisplayLedgerEntry[];
}

export function OnboardingEntriesCard({ accountName, currency, entries }: Props) {
  const { t } = useTranslation("account");

  const columns = useMemo(
    () => getAccountEntriesColumns({ currency, t }),
    [currency, t],
  );

  const table = useTable({
    features: accountEntriesTableFeatures,
    columns,
    data: entries,
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
        {entries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">{t("noEntriesTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("noEntriesDescription")}
            </p>
          </div>
        ) : (
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
              <AnimatePresence initial={false}>
                {table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="border-b transition-colors last:border-0 hover:bg-muted/30"
                  >
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
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
