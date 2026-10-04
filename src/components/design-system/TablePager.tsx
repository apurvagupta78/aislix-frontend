import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export type Pager = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

/** Page state for a long table. The page is clamped, so shrinking the list never shows an empty page. */
export function usePager(total: number, initialSize: number = PAGE_SIZES[0]): Pager {
  const [pageSize, setSize] = useState(initialSize);
  const [rawPage, setRawPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(0, rawPage), pageCount - 1);
  return {
    page,
    pageSize,
    pageCount,
    total,
    start: page * pageSize,
    end: Math.min(total, (page + 1) * pageSize),
    setPage: (next) => setRawPage(Math.max(0, next)),
    setPageSize: (size) => {
      setSize(size);
      setRawPage(0);
    },
  };
}

const NAV_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-md border border-[#D9E2E8] bg-white text-[#102A43] transition-colors hover:bg-[#F4F7F9] disabled:cursor-not-allowed disabled:opacity-40";

export function TablePager({ pager, noun = "rows", className }: { pager: Pager; noun?: string; className?: string }) {
  const { page, pageSize, pageCount, total, start, end, setPage, setPageSize } = pager;
  const fmt = (n: number) => n.toLocaleString();
  const jump = (raw: string) => setPage(Math.min(pageCount - 1, Math.max(0, Math.floor(Number(raw)) - 1 || 0)));
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 text-xs text-[#667085]",
        className,
      )}
    >
      <span className="tabular-nums">
        {total ? (
          <>
            Showing <span className="font-semibold text-[#102A43]">{fmt(start + 1)}–{fmt(end)}</span> of{" "}
            <span className="font-semibold text-[#102A43]">{fmt(total)}</span> {noun}
          </>
        ) : (
          `No ${noun}`
        )}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5">
          Rows per page
          <select
            className="rounded-md border border-[#D9E2E8] bg-white px-1.5 py-1 text-xs text-[#102A43]"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex items-center gap-1">
          <button type="button" className={NAV_BUTTON} aria-label="First page" disabled={page === 0} onClick={() => setPage(0)}>
            <ChevronsLeft className="size-3.5" />
          </button>
          <button type="button" className={NAV_BUTTON} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="inline-flex items-center gap-1 px-1 tabular-nums">
            Page
            <input
              key={page}
              aria-label="Page number"
              inputMode="numeric"
              className="w-12 rounded-md border border-[#D9E2E8] bg-white px-1 py-0.5 text-center text-xs text-[#102A43]"
              defaultValue={page + 1}
              onKeyDown={(event) => {
                if (event.key === "Enter") jump(event.currentTarget.value);
              }}
              onBlur={(event) => jump(event.currentTarget.value)}
            />
            of {fmt(pageCount)}
          </span>
          <button
            type="button"
            className={NAV_BUTTON}
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="size-3.5" />
          </button>
          <button
            type="button"
            className={NAV_BUTTON}
            aria-label="Last page"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(pageCount - 1)}
          >
            <ChevronsRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
