"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  sortable?: boolean;
  numeric?: boolean;
  align?: "left" | "center" | "right";
  width?: number | string;
  hideBelow?: "sm" | "md" | "lg";
  value: (row: T) => string | number;
  cell: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowId: (row: T) => string;
  rowLabel?: (row: T) => string;
  caption?: string;
  variant?: "panel" | "striped";
  title?: string;
  defaultSort?: {
    columnId: string;
    direction: "asc" | "desc";
  };
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

const HIDE_BELOW_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function DataTable<T>({
  data,
  columns,
  rowId,
  rowLabel,
  caption,
  variant = "panel",
  title,
  defaultSort,
  onRowClick,
  emptyMessage = "No entries available.",
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{
    columnId: string;
    direction: "asc" | "desc";
  } | null>(defaultSort ?? null);

  const sortedData = React.useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col) return data;
    const dir = sort.direction === "asc" ? 1 : -1;
    return data.slice().sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [data, columns, sort]);

  function toggleSort(columnId: string) {
    setSort((prev) => {
      if (prev && prev.columnId === columnId) {
        return {
          columnId,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { columnId, direction: "asc" };
    });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#141414] text-white",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            {title}
          </h3>
          <span className="text-xs text-zinc-400 tabular-nums">
            {data.length} {data.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}

      {sortedData.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-white/10 text-zinc-400">
                {columns.map((col) => {
                  const alignClass =
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right" || col.numeric
                        ? "text-right"
                        : "text-left";
                  const hideClass = col.hideBelow
                    ? HIDE_BELOW_CLASS[col.hideBelow]
                    : "";
                  const isSorted = sort?.columnId === col.id;
                  const ariaSort = col.sortable
                    ? isSorted
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined;

                  return (
                    <th
                      key={col.id}
                      scope="col"
                      aria-sort={ariaSort}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        "px-3 py-2.5 font-medium whitespace-nowrap",
                        alignClass,
                        hideClass,
                      )}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.id)}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-inherit hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff6b2b]",
                            col.align === "center" && "justify-center",
                            (col.align === "right" || col.numeric) &&
                              "ml-auto flex-row-reverse",
                          )}
                        >
                          <span>{col.header}</span>
                          {isSorted ? (
                            sort.direction === "asc" ? (
                              <ArrowUp className="size-3 text-[#ff6b2b]" />
                            ) : (
                              <ArrowDown className="size-3 text-[#ff6b2b]" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-45" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, idx) => {
                const id = rowId(row);
                const label = rowLabel ? rowLabel(row) : undefined;
                return (
                  <tr
                    key={id}
                    aria-label={label}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-white/5 last:border-none",
                      variant === "striped" && idx % 2 === 1 && "bg-white/[0.03]",
                      onRowClick &&
                        "cursor-pointer transition-colors hover:bg-white/[0.06]",
                    )}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right" || col.numeric
                            ? "text-right"
                            : "text-left";
                      const hideClass = col.hideBelow
                        ? HIDE_BELOW_CLASS[col.hideBelow]
                        : "";
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "px-3 py-2.5",
                            alignClass,
                            hideClass,
                            col.numeric && "tabular-nums",
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
