"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ExportReportButton from "@/components/ExportReportButton";
import { useEmployeeProfileDialog } from "@/components/EmployeeDetailDialog";
import { dateInputValueToDDMMYYYY, toDateInputValue } from "@/lib/formatDate";

interface KpiEmployee {
  tab_number: string;
  full_name: string;
  worksite_name: string;
  position_name: string;
  total_score: number;
}
interface KpiAvgRow { name: string; avg_score: number }
interface KpiResponse {
  date: string | null;
  worksite: string | null;
  topEmployees: KpiEmployee[];
  avgScoreByWorksite: KpiAvgRow[];
  avgScoreByPosition: KpiAvgRow[];
}
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: KpiResponse };

function buildUrl(date: string | null, worksite: string | null): string {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (worksite) params.set("worksite", worksite);
  const q = params.toString();
  return q ? `/api/dashboard/kpi?${q}` : "/api/dashboard/kpi";
}

export default function KPIDashboard() {
  const { openProfile, dialog } = useEmployeeProfileDialog();
  const [date, setDate] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [worksite, setWorksite] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [worksiteOptions, setWorksiteOptions] = useState<string[]>([]);

  const load = useCallback(async (d: string | null, ws: string | null) => {
    setState({ status: "loading" });
    try {
      const res = await fetch(buildUrl(d, ws), { cache: "no-store" });
      const json = (await res.json()) as KpiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setState({ status: "ok", data: json });
      if (!d && json.date) {
        setDate(json.date);
        setDateInput(toDateInputValue(json.date));
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(null, null);
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = date
          ? `/api/dashboard/kpi/worksites?date=${encodeURIComponent(date)}`
          : "/api/dashboard/kpi/worksites";
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as { worksites?: string[]; error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) setWorksiteOptions(json.worksites ?? []);
      } catch {
        if (!cancelled) setWorksiteOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {dialog}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>KPI / Оценки</CardTitle>
          <ExportReportButton
            type="kpi"
            params={{ date, worksite }}
          />
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="kpi-date">Дата оценки</Label>
            <Input
              id="kpi-date"
              type="date"
              value={dateInput}
              onChange={(e) => {
                const v = e.target.value;
                setDateInput(v);
                const d = v ? dateInputValueToDDMMYYYY(v) : null;
                setDate(d);
                void load(d, worksite);
              }}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label>Площадка</Label>
            <Select
              value={worksite ?? "__all__"}
              onValueChange={(value) => {
                const ws = value === "__all__" ? null : value;
                setWorksite(ws);
                void load(date, ws);
              }}
            >
              <SelectTrigger className="w-64"><SelectValue placeholder="Все площадки" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все площадки</SelectItem>
                {worksiteOptions.map((ws) => (
                  <SelectItem key={ws} value={ws}>{ws}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {state.status === "loading" && <Skeleton className="h-[420px] w-full" />}
      {state.status === "error" && <Card><CardContent className="pt-6 text-sm text-red-500">{state.message}</CardContent></Card>}
      {state.status === "ok" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Лучшие сотрудники (ТОП-10)</CardTitle></CardHeader>
            <CardContent>
              {state.data.topEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет данных</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">ФИО</th><th className="py-2 pr-3">Таб. №</th><th className="py-2 pr-3">Площадка</th><th className="py-2 pr-3">Должность</th><th className="py-2 text-right">Оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.data.topEmployees.map((emp, index) => (
                        <tr
                          key={`${emp.tab_number}-${emp.worksite_name}-${emp.position_name}-${index}`}
                          className="cursor-pointer border-b hover:bg-muted/50"
                          onClick={() => openProfile(emp.tab_number)}
                        >
                          <td className="py-2 pr-3">{emp.full_name}</td>
                          <td className="py-2 pr-3">{emp.tab_number}</td>
                          <td className="py-2 pr-3">{emp.worksite_name}</td>
                          <td className="py-2 pr-3">{emp.position_name}</td>
                          <td className="py-2 text-right font-medium">{emp.total_score.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Средний балл по площадкам</CardTitle></CardHeader>
              <CardContent>
                {state.data.avgScoreByWorksite.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={state.data.avgScoreByWorksite.slice(0, 12)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={72} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg_score" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Средний балл по должностям</CardTitle></CardHeader>
              <CardContent>
                {state.data.avgScoreByPosition.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={state.data.avgScoreByPosition.slice(0, 12)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={72} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg_score" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
