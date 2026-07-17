"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendResponse } from "@/app/api/dashboard/trend/route";
import { formatDateToDDMM } from "@/lib/formatDate";

type ChartState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: TrendResponse["data"] };

export interface TrendChartProps {
  /** ДД.ММ.ГГГГ — начало периода */
  from?: string | null;
  /** ДД.ММ.ГГГГ — конец периода */
  to?: string | null;
}

function buildTrendUrl(from?: string | null, to?: string | null): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `/api/dashboard/trend?${qs}` : "/api/dashboard/trend";
}

/** График динамики численности (agg_daily_worksite_stats). */
export default function TrendChart({ from, to }: TrendChartProps) {
  const [state, setState] = useState<ChartState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(buildTrendUrl(from, to), { cache: "no-store" });
        const json = (await res.json()) as TrendResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setState({ status: "ok", data: json.data ?? [] });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const periodLabel =
    from && to
      ? from === to
        ? from
        : `${from} — ${to}`
      : from
        ? `с ${from}`
        : to
          ? `по ${to}`
          : "весь период";

  return (
    <Card className="border-slate-700 bg-slate-800 text-slate-100">
      <CardHeader>
        <CardTitle className="text-base text-white">
          Динамика численности
          <span className="ml-2 text-sm font-normal text-slate-400">({periodLabel})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === "loading" && (
          <div className="flex h-[300px] items-center justify-center gap-2 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex h-[300px] items-center justify-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{state.message}</span>
          </div>
        )}

        {state.status === "ok" && state.data.length === 0 && (
          <div className="flex h-[300px] items-center justify-center text-slate-400">
            Нет данных для графика за выбранный период
          </div>
        )}

        {state.status === "ok" && state.data.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={state.data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.25)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#e2e8f0", fontSize: 12 }}
                tickFormatter={(value: string) => formatDateToDDMM(value)}
                axisLine={{ stroke: "#64748b" }}
                tickLine={{ stroke: "#64748b" }}
              />
              <YAxis
                tick={{ fill: "#e2e8f0", fontSize: 12 }}
                axisLine={{ stroke: "#64748b" }}
                tickLine={{ stroke: "#64748b" }}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f8fafc",
                }}
                labelFormatter={(label) => `Дата: ${label}`}
                formatter={(value: number) => [
                  value.toLocaleString("ru-RU"),
                  "Численность",
                ]}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
