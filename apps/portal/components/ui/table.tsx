"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import LoadingDot from "./loading-dot";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Info,
  LucideIcon,
} from "lucide-react";
import { Progress } from "./progress";
import EmptyState from "./empty-state";
import ErrorState from "./error-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

interface TableProps extends React.ComponentProps<"table"> {
  isLoading?: boolean;
  containerClassName?: string;
  containerRef?: React.Ref<HTMLDivElement>;
}

function Table({
  className,
  isLoading,
  containerClassName,
  containerRef,
  ...props
}: TableProps) {
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn("relative w-full overflow-auto", containerClassName)}
    >
      {isLoading ? (
        <LoadingDot className="py-18" />
      ) : (
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      )}
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b sticky top-0 table-header-divider",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

interface TableRowProps extends React.ComponentProps<"tr"> {
  isHoverActive?: boolean;
  href?: string;
}

function TableRow({ isHoverActive, className, href, ...props }: TableRowProps) {
  const router = useRouter();
  return (
    <tr
      data-slot="table-row"
      onClick={() => {
        if (href) {
          // startNavigationProgress(href);
          router.push(href);
        }
      }}
      className={cn(
        " data-[state=selected]:bg-muted border-b transition-colors",
        isHoverActive ? "hover:bg-muted/50" : "",
        className,
      )}
      {...props}
    />
  );
}

interface TableRowStateProps {
  isFetching?: boolean;
  isLoading?: boolean;
  isEmpty?: boolean;
  isError?: boolean;
  colSpan?: number;
  /**
   * @deprecated
   */
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  hideEmptyImage?: boolean;
}

function TableDataState({
  isFetching,
  isLoading,
  isEmpty,
  isError,
  colSpan = 10,
  emptyIcon,
  hideEmptyImage = false,
  emptyTitle,
  emptyDescription,
}: TableRowStateProps) {
  const { t } = useTranslation("common");

  return (
    <>
      <TableRow className="border-none">
        <TableCell colSpan={colSpan} className="p-0 h-1.5">
          {isFetching && <Progress indeterminate className="h-1 p-0 w-full" />}
        </TableCell>
      </TableRow>

      {isLoading && !isFetching && (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-20 text-center">
            <LoadingDot />
          </TableCell>
        </TableRow>
      )}

      {isEmpty && !isError && !isFetching && !isLoading && (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-4 text-center">
            <EmptyState
              hideImage={hideEmptyImage}
              title={emptyTitle || t("noDataFound")}
              description={emptyDescription || t("noDataDescription")}
            />
          </TableCell>
        </TableRow>
      )}

      {isError && !isFetching && (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-4 text-center">
            <ErrorState />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface TableHeadProps extends React.ComponentProps<"th"> {
  isSortable?: boolean;
  onSort?: (sortBy: string, sortDirection: "asc" | "desc") => void;
  sortBy?: string;
  getSortDirection?: (sortBy: string) => "asc" | "desc" | "none";
  tooltip?: string;
}

function TableHead({
  className,
  isSortable,
  onSort,
  getSortDirection,
  sortBy,
  children,
  tooltip,
  ...props
}: TableHeadProps) {
  const handleSort = () => {
    if (onSort && sortBy && getSortDirection) {
      onSort(sortBy, getSortDirection(sortBy) === "asc" ? "desc" : "asc");
    }
  };

  const justifyClass = className?.includes("text-center")
    ? "justify-center"
    : className?.includes("text-right")
      ? "justify-end"
      : "justify-start";

  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-3.5 text-left align-middle whitespace-nowrap font-semibold bg-background",
        className,
      )}
      {...props}
    >
      {isSortable ? (
        <div
          className={cn("flex items-center gap-1 cursor-pointer", justifyClass)}
          onClick={handleSort}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleSort();
            }
          }}
        >
          {children}

          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="bg-black fill-black">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}

          {getSortDirection?.(sortBy || "") === "asc" && (
            <ChevronUp strokeWidth={2} className="size-3.5 text-blue-500" />
          )}
          {getSortDirection?.(sortBy || "") === "desc" && (
            <ChevronDown strokeWidth={2} className="size-3.5 text-blue-500" />
          )}

          {getSortDirection?.(sortBy || "") === "none" && (
            <ChevronsUpDown
              strokeWidth={2}
              className="size-3.5 text-gray-400"
            />
          )}
        </div>
      ) : (
        <div className={cn("flex items-center gap-1", justifyClass)}>
          {children}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="bg-black fill-black">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </th>
  );
}

interface TableCellProps extends React.ComponentProps<"td"> {
  isLoading?: boolean;
}

function TableCell({
  className,
  isLoading,
  children,
  ...props
}: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3.5 py-3 align-middle whitespace-nowrap", className)}
      {...props}
    >
      {isLoading ? <Skeleton className="w-full h-5 rounded-xs" /> : children}
    </td>
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableDataState,
};
