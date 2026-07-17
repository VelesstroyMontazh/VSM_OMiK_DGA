"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  CalendarCheck,
  MapPin,
  AlertCircle,
  Loader2,
  RotateCcw,
  ArrowLeftRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TrendChart from "@/components/TrendChart";
import ExportReportButton from "@/components/ExportReportButton";
import { useEmployeeProfileDialog } from "@/components/EmployeeDetailDialog";
import type { DashboardOverviewResponse } from "@/app/api/dashboard/overview/route";
import type { CompareResponse } from "@/app/api/dashboard/compare/route";
import type {
  WorksiteDetailResponse,
  WorksiteEmployee,
} from "@/app/api/dashboard/worksite/[worksiteName]/route";
import {
  dateInputValueToDDMMYYYY,
  toDateInputValue,
} from "@/lib/formatDate";
import { useDashboardUrlFilters } from "@/lib/useDashboardUrlFilters";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: DashboardOverviewResponse };

type CompareState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: CompareResponse };

function buildOverviewUrl(date?: string | null): string {
  if (!date) return "/api/dashboard/overview";
  return `/api/dashboard/overview?date=${encodeURIComponent(date)}`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU")}`;
}

function deltaClass(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

/**
 * Обзор warehouse SQLite: KPI, график, сравнение дат, drill-down, URL-фильтры.
 */
export default function DashboardOverview() {
  const { filters, setFilters, clearFilters } = useDashboardUrlFilters();
  const { openProfile, dialog } = useEmployeeProfileDialog();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [compareState, setCompareState] = useState<CompareState>({ status: "idle" });

  const [overviewDate, setOverviewDate] = useState<string | null>(filters.date);
  const [trendFrom, setTrendFrom] = useState<string | null>(filters.from);
  const [trendTo, setTrendTo] = useState<string | null>(filters.to);
  const [compareDate, setCompareDate] = useState<string | null>(filters.compare);

  const [overviewDateInput, setOverviewDateInput] = useState(
    filters.date ? toDateInputValue(filters.date) : "",
  );
  const [trendFromInput, setTrendFromInput] = useState(
    filters.from ? toDateInputValue(filters.from) : "",
  );
  const [trendToInput, setTrendToInput] = useState(
    filters.to ? toDateInputValue(filters.to) : "",
  );
  const [compareDateInput, setCompareDateInput] = useState(
    filters.compare ? toDateInputValue(filters.compare) : "",
  );

  const [selectedWorksite, setSelectedWorksite] = useState<string | null>(null);
  const [employees, setEmployees] = useState<WorksiteEmployee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (date: string | null, refreshing: boolean) => {
    if (refreshing) setIsRefreshing(true);
    else setState({ status: "loading" });

    try {
      const res = await fetch(buildOverviewUrl(date), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const data = json as DashboardOverviewResponse;
      setState({ status: "ok", data });

      if (!date && data.date) {
        setOverviewDate(data.date);
        setOverviewDateInput(toDateInputValue(data.date));
      }
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const fetchCompare = useCallback(async (dateA: string, dateB: string) => {
    setCompareState({ status: "loading" });
    try {
      const qs = new URLSearchParams({
        dateA,
        dateB,
      });
      const res = await fetch(`/api/dashboard/compare?${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setCompareState({ status: "ok", data: json as CompareResponse });
    } catch (e) {
      setCompareState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    setOverviewDate(filters.date);
    setTrendFrom(filters.from);
    setTrendTo(filters.to);
    setCompareDate(filters.compare);
    setOverviewDateInput(filters.date ? toDateInputValue(filters.date) : "");
    setTrendFromInput(filters.from ? toDateInputValue(filters.from) : "");
    setTrendToInput(filters.to ? toDateInputValue(filters.to) : "");
    setCompareDateInput(filters.compare ? toDateInputValue(filters.compare) : "");
  }, [filters]);

  useEffect(() => {
    void fetchOverview(filters.date, false);
  }, [filters.date, fetchOverview]);

  useEffect(() => {
    const dateB = overviewDate ?? (state.status === "ok" ? state.data.date : null);
    if (compareDate && dateB) {
      void fetchCompare(compareDate, dateB);
    } else {
      setCompareState({ status: "idle" });
    }
  }, [compareDate, overviewDate, state, fetchCompare]);

  const applyOverviewDate = useCallback(
    (inputValue: string) => {
      setOverviewDateInput(inputValue);
      if (!inputValue) {
        setOverviewDate(null);
        setFilters({ date: null });
        void fetchOverview(null, true);
        return;
      }
      const ddmmyyyy = dateInputValueToDDMMYYYY(inputValue);
      if (!ddmmyyyy) return;
      setOverviewDate(ddmmyyyy);
      setFilters({ date: ddmmyyyy });
      void fetchOverview(ddmmyyyy, true);
    },
    [fetchOverview, setFilters],
  );

  const applyTrendFrom = useCallback(
    (inputValue: string) => {
      setTrendFromInput(inputValue);
      const ddmmyyyy = inputValue ? dateInputValueToDDMMYYYY(inputValue) : null;
      setTrendFrom(ddmmyyyy);
      setFilters({ from: ddmmyyyy });
    },
    [setFilters],
  );

  const applyTrendTo = useCallback(
    (inputValue: string) => {
      setTrendToInput(inputValue);
      const ddmmyyyy = inputValue ? dateInputValueToDDMMYYYY(inputValue) : null;
      setTrendTo(ddmmyyyy);
      setFilters({ to: ddmmyyyy });
    },
    [setFilters],
  );

  const applyCompareDate = useCallback(
    (inputValue: string) => {
      setCompareDateInput(inputValue);
      const ddmmyyyy = inputValue ? dateInputValueToDDMMYYYY(inputValue) : null;
      setCompareDate(ddmmyyyy);
      setFilters({ compare: ddmmyyyy });
    },
    [setFilters],
  );

  const resetFilters = useCallback(() => {
    setOverviewDate(null);
    setTrendFrom(null);
    setTrendTo(null);
    setCompareDate(null);
    setOverviewDateInput("");
    setTrendFromInput("");
    setTrendToInput("");
    setCompareDateInput("");
    setCompareState({ status: "idle" });
    clearFilters();
    void fetchOverview(null, true);
  }, [clearFilters, fetchOverview]);

  const openWorksiteDetail = useCallback(
    async (worksiteName: string) => {
      setSelectedWorksite(worksiteName);
      setIsModalOpen(true);
      setModalLoading(true);
      setModalError(null);
      setEmployees([]);
      setModalDate(null);

      const dateQuery = overviewDate
        ? `?date=${encodeURIComponent(overviewDate)}`
        : "";

      try {
        const res = await fetch(
          `/api/dashboard/worksite/${encodeURIComponent(worksiteName)}${dateQuery}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as WorksiteDetailResponse & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        setEmployees(json.employees ?? []);
        setModalDate(json.date ?? null);
      } catch (e) {
        setModalError(e instanceof Error ? e.message : String(e));
      } finally {
        setModalLoading(false);
      }
    },
    [overviewDate],
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedWorksite(null);
    setEmployees([]);
    setModalError(null);
    setModalDate(null);
  }, []);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-[340px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <p className="text-sm text-muted-foreground">Загрузка витрин…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Ошибка загрузки warehouse</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data } = state;
  const showNoData = data.noData === true;
  const compareData = compareState.status === "ok" ? compareState.data : null;

  return (
    <div className="space-y-6">
      {dialog}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Фильтр по датам
            {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          <ExportReportButton
            type="overview"
            params={{
              date: overviewDate,
              from: trendFrom,
              to: trendTo,
            }}
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="overview-date">Дата отчёта (KPI / ТОП-10)</Label>
              <Input
                id="overview-date"
                type="date"
                value={overviewDateInput}
                onChange={(e) => applyOverviewDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compare-date">Сравнить с датой</Label>
              <Input
                id="compare-date"
                type="date"
                value={compareDateInput}
                onChange={(e) => applyCompareDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trend-from">Период графика: с</Label>
              <Input
                id="trend-from"
                type="date"
                value={trendFromInput}
                onChange={(e) => applyTrendFrom(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trend-to">по</Label>
              <Input
                id="trend-to"
                type="date"
                value={trendToInput}
                onChange={(e) => applyTrendTo(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Сбросить
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Фильтры синхронизируются с URL (
            <code className="rounded bg-muted px-1">?date=&amp;compare=&amp;from=&amp;to=</code>
            ). KPI и ТОП-10 — на дату отчёта; сравнение — дельта с базовой датой.
          </p>
        </CardContent>
      </Card>

      {showNoData && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-2 p-4 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Нет данных за этот день</span>
          </CardContent>
        </Card>
      )}

      {compareDate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="h-4 w-4" />
              Сравнение дат
              {compareState.status === "loading" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {compareState.status === "error" && (
              <p className="text-sm text-destructive">{compareState.message}</p>
            )}
            {compareState.status === "idle" && (
              <p className="text-sm text-muted-foreground">
                Выберите дату отчёта и базовую дату для сравнения.
              </p>
            )}
            {compareData && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">База ({compareData.dateA}): </span>
                    <span className="font-semibold tabular-nums">
                      {compareData.totalA.toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Текущая ({compareData.dateB}): </span>
                    <span className="font-semibold tabular-nums">
                      {compareData.totalB.toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Δ всего: </span>
                    <span className={`font-semibold tabular-nums ${deltaClass(compareData.deltaTotal)}`}>
                      {formatDelta(compareData.deltaTotal)}
                    </span>
                  </div>
                </div>

                {compareData.noData ? (
                  <p className="text-sm text-muted-foreground">Нет данных за одну из дат</p>
                ) : compareData.worksites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет изменений по площадкам</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Площадка</th>
                          <th className="py-2 pr-4 text-right font-medium">{compareData.dateA}</th>
                          <th className="py-2 pr-4 text-right font-medium">{compareData.dateB}</th>
                          <th className="py-2 text-right font-medium">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareData.worksites.map((row) => (
                          <tr key={row.worksite_name} className="border-b border-border/60">
                            <td className="py-2 pr-4">{row.worksite_name}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {row.countA.toLocaleString("ru-RU")}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {row.countB.toLocaleString("ru-RU")}
                            </td>
                            <td className={`py-2 text-right tabular-nums font-medium ${deltaClass(row.delta)}`}>
                              {formatDelta(row.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className={isRefreshing ? "pointer-events-none opacity-60" : undefined}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Сотрудников на дату</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {data.totalEmployees.toLocaleString("ru-RU")}
              </div>
              <p className="text-xs text-muted-foreground">agg_daily_worksite_stats</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Дата отчёта</CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{data.date ?? "—"}</div>
              <p className="text-xs text-muted-foreground">формат ДД.ММ.ГГГГ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Топ площадок</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{data.topWorksites.length}</div>
              <p className="text-xs text-muted-foreground">клик по строке — детализация</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <TrendChart from={trendFrom} to={trendTo} />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">ТОП-10 площадок по численности</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topWorksites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {showNoData ? "Нет данных за этот день" : "Нет данных явки"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">#</th>
                      <th className="py-2 pr-4 font-medium">Площадка</th>
                      <th className="py-2 text-right font-medium">Сотрудников</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topWorksites.map((row, i) => (
                      <tr
                        key={`${row.worksite_name}-${i}`}
                        className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
                        onClick={() => openWorksiteDetail(row.worksite_name)}
                      >
                        <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-4 text-primary underline-offset-2 hover:underline">
                          {row.worksite_name}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium">
                          {row.employee_count.toLocaleString("ru-RU")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-h-[85vh] overflow-hidden border-slate-700 bg-slate-900 text-slate-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Сотрудники на площадке {selectedWorksite ?? ""}
              {modalDate ? ` (${modalDate})` : ""}
            </DialogTitle>
          </DialogHeader>

          {modalLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Загрузка…</span>
            </div>
          )}

          {!modalLoading && modalError && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-950/40 p-4 text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {!modalLoading && !modalError && employees.length === 0 && (
            <p className="py-8 text-center text-slate-400">Нет данных</p>
          )}

          {!modalLoading && !modalError && employees.length > 0 && (
            <div className="max-h-[60vh] overflow-auto rounded-md border border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-slate-700 text-left text-slate-300">
                    <th className="px-3 py-2 font-medium">ФИО</th>
                    <th className="px-3 py-2 font-medium">Табельный номер</th>
                    <th className="px-3 py-2 font-medium">Должность</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr
                      key={`${emp.tab_number}-${idx}`}
                      className={idx % 2 === 0 ? "bg-slate-900" : "bg-slate-800/70"}
                    >
                      <td className="px-3 py-2">{emp.full_name}</td>
                      <td
                        className="cursor-pointer px-3 py-2 tabular-nums text-primary hover:underline"
                        onClick={() => openProfile(emp.tab_number)}
                      >
                        {emp.tab_number}
                      </td>
                      <td className="px-3 py-2">{emp.position ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
