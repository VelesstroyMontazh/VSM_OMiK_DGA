"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ExportReportButton from "@/components/ExportReportButton";

type HrPeriod = "week" | "month";

interface HrTrendPoint {
  period: string;
  hire: number;
  transfer: number;
  terminate: number;
}

interface HrTrendResponse {
  period: HrPeriod;
  data: HrTrendPoint[];
  summary: { totalEmployees: number; hire: number; transfer: number; terminate: number };
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: HrTrendResponse };

export default function HRTrendChart() {
  const [period, setPeriod] = useState<HrPeriod>("month");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/dashboard/hr-trend?period=${period}`, { cache: "no-store" });
        const json = (await res.json()) as HrTrendResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) setState({ status: "ok", data: json });
      } catch (e) {
        if (!cancelled) {
          setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const summary = useMemo(() => {
    if (state.status !== "ok") return { totalEmployees: 0, hire: 0, transfer: 0, terminate: 0 };
    return state.data.summary;
  }, [state]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>HR Движение</CardTitle>
          <div className="flex items-center gap-2">
            <ExportReportButton type="hr" params={{ period }} />
            <Select value={period} onValueChange={(v) => setPeriod(v as HrPeriod)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Всего сотрудников</p><p className="text-2xl font-bold">{summary.totalEmployees.toLocaleString("ru-RU")}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Принято</p><p className="text-2xl font-bold text-emerald-600">{summary.hire.toLocaleString("ru-RU")}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Переведено</p><p className="text-2xl font-bold text-amber-600">{summary.transfer.toLocaleString("ru-RU")}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Уволено</p><p className="text-2xl font-bold text-red-600">{summary.terminate.toLocaleString("ru-RU")}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Приём / Перевод / Увольнение</CardTitle>
        </CardHeader>
        <CardContent>
          {state.status === "loading" && <Skeleton className="h-[320px] w-full" />}
          {state.status === "error" && (
            <div className="flex h-[320px] items-center justify-center text-sm text-red-500">{state.message}</div>
          )}
          {state.status === "ok" && state.data.data.length === 0 && (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">Нет данных</div>
          )}
          {state.status === "ok" && state.data.data.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={state.data.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="hire" name="Приём" fill="#22c55e" />
                <Bar dataKey="transfer" name="Перевод" fill="#f59e0b" />
                <Bar dataKey="terminate" name="Увольнение" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
