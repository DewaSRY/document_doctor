"use client";

import React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  rowsPerPage?: number;
  totalRows: number;
  onRowsPerPageChange?: (rows: number) => void;
  rowsPerPageOptions?: number[];
  className?: string;
  pageName?: string; // Optional prop for test ID prefix
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  onPageChange,
  rowsPerPage = 25,
  totalRows,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50, 100],
  className,
  pageName,
}) => {
  const { t } = useTranslation("common");
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage <= 3) {
        pages.push(2, 3, 4, 5);
        pages.push("ellipsis-end");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push("ellipsis-start");
        pages.push(
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
        );
        pages.push(totalPages);
      } else {
        pages.push("ellipsis-start");
        pages.push(currentPage - 1, currentPage, currentPage + 1);
        pages.push("ellipsis-end");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between w-full sticky bottom-0  py-2 px-1 gap-2",
        className,
      )}
    >
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative shrink-0">
          <select
            data-testid={`select_${pageName}_rows_per_page`}
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange?.(Number(e.target.value))}
            className="h-8 rounded-xs border border-brand-500  pl-3 pr-8 py-1 text-sm text-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
          >
            {rowsPerPageOptions.map((option) => (
              <option
                key={option}
                value={option}
                data-testid={`option_${pageName}_rows_per_page_${option}`}
              >
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-500" />
        </div>
        <span className="text-sm text-gray-400 whitespace-nowrap">
          {t("paginationRowsInfo", { count: totalRows })}
        </span>
      </div>

      <div className="flex items-center gap-1.5 max-w-full overflow-x-auto">
        <button
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 shrink-0 rounded-xs flex items-center justify-center border border-brand-500  text-brand-500 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t("previousPage")}
          data-testid={pageName ? `btn_${pageName}_previous_page` : undefined}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageNumbers.map((page, index) => {
          if (typeof page === "string") {
            return (
              <div
                key={`${page}-${index}`}
                className="h-8 w-8 shrink-0 flex items-center justify-center text-gray-500"
              >
                <MoreHorizontal className="h-4 w-4" />
              </div>
            );
          }

          return (
            <button
              key={page}
              onClick={() => handlePageClick(page)}
              className={`h-8 min-w-2 px-3 shrink-0 rounded-xs flex items-center justify-center text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-brand-500 text-white hover:bg-brand"
                  : " text-gray-700 hover:bg-gray-50"
              }`}
              aria-label={t("pageNumber", { page })}
              aria-current={currentPage === page ? "page" : undefined}
              data-testid={
                pageName ? `btn_${pageName}_page_${page}` : undefined
              }
            >
              {page}
            </button>
          );
        })}

        <button
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 shrink-0 rounded-xs flex items-center justify-center border border-brand-500  text-brand-500 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t("nextPage")}
          data-testid={pageName ? `btn_${pageName}_next_page` : undefined}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
