"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isValidDDMMYYYY } from "@/lib/formatDate";

export interface DashboardUrlFilters {
  date: string | null;
  from: string | null;
  to: string | null;
  compare: string | null;
}

function readFilter(
  params: URLSearchParams,
  key: string,
): string | null {
  const raw = params.get(key)?.trim() ?? null;
  if (!raw) return null;
  return isValidDDMMYYYY(raw) ? raw : null;
}

/** Чтение фильтров обзора из query string (?date=DD.MM.YYYY&from=...&to=...&compare=...) */
export function useDashboardUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: DashboardUrlFilters = useMemo(
    () => ({
      date: readFilter(searchParams, "date"),
      from: readFilter(searchParams, "from"),
      to: readFilter(searchParams, "to"),
      compare: readFilter(searchParams, "compare"),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: Partial<DashboardUrlFilters>) => {
      const merged: DashboardUrlFilters = { ...filters, ...next };
      const params = new URLSearchParams();

      if (merged.date) params.set("date", merged.date);
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
      if (merged.compare) params.set("compare", merged.compare);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { filters, setFilters, clearFilters };
}
