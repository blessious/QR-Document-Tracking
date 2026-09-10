import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const DEFAULT_PAGE_SIZE = 10;

export function ListSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        className="pl-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

export function useListPagination<T>(items: T[], resetKey = "", pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, items, pageSize],
  );

  return { page: currentPage, pageCount, pageItems, setPage, pageSize };
}

export function ListPagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  itemLabel = "items",
  onPageChange,
}: {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = pageCount <= 5 ? Array.from({ length: pageCount }, (_, i) => i + 1) : [
    1,
    ...(page > 3 ? ["ellipsis-before"] : []),
    ...Array.from({ length: 3 }, (_, i) => page - 1 + i).filter((value) => value > 1 && value < pageCount),
    ...(page < pageCount - 2 ? ["ellipsis-after"] : []),
    pageCount,
  ];
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p>
        Showing {start}–{end} of {totalItems} {itemLabel}
      </p>
      {pageCount > 1 ? (
        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={`?page=${page - 1}`}
                aria-disabled={page === 1}
                className={page === 1 ? disabledClass : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (page > 1) onPageChange(page - 1);
                }}
              />
            </PaginationItem>
            {pages.map((value) =>
              typeof value === "string" ? (
                <PaginationItem key={value}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={value}>
                  <PaginationLink
                    href={`?page=${value}`}
                    isActive={value === page}
                    aria-label={`Go to page ${value}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(value);
                    }}
                  >
                    {value}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={`?page=${page + 1}`}
                aria-disabled={page === pageCount}
                className={page === pageCount ? disabledClass : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (page < pageCount) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
