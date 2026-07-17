import { NextResponse } from "next/server";
import { formatDateToDDMMYYYY } from "@/lib/formatDate";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type HrPeriod = "week" | "month";

export interface HrTrendPoint {
  period: string;
  hire: number;
  transfer: number;
  terminate: number;
}

export interface HrTrendResponse {
  period: HrPeriod;
  data: HrTrendPoint[];
  summary: {
    totalEmployees: number;
    hire: number;
    transfer: number;
    terminate: number;
  };
}

function tableExists(table: string): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(table);
  return Boolean(row);
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") ?? "month") as HrPeriod;
    if (period !== "week" && period !== "month") {
      return NextResponse.json(
        { error: "Некорректный period. Допустимо: week|month" },
        { status: 400 },
      );
    }

    if (!tableExists("fact_hr_events")) {
      const empty: HrTrendResponse = {
        period,
        data: [],
        summary: { totalEmployees: 0, hire: 0, transfer: 0, terminate: 0 },
      };
      return NextResponse.json(empty);
    }

    const periodExpr =
      period === "week"
        ? `date("event_date", '-' || ((CAST(strftime('%w',"event_date") AS INTEGER) + 6) % 7) || ' days')`
        : `substr("event_date", 1, 7) || '-01'`;

    const rows = db
      .prepare(
        `
        SELECT
          ${periodExpr} AS period_iso,
          SUM(CASE WHEN lower("event_type")='hire' THEN 1 ELSE 0 END) AS hire,
          SUM(CASE WHEN lower("event_type")='transfer' THEN 1 ELSE 0 END) AS transfer,
          SUM(CASE WHEN lower("event_type")='terminate' THEN 1 ELSE 0 END) AS terminate
        FROM "fact_hr_events"
        WHERE "event_date" IS NOT NULL
        GROUP BY period_iso
        ORDER BY period_iso ASC
        `,
      )
      .all() as {
      period_iso: string;
      hire: number;
      transfer: number;
      terminate: number;
    }[];

    const totalEmployees = tableExists("agg_daily_worksite_stats")
      ? ((db
          .prepare(
            `SELECT "total_employees" FROM "agg_daily_worksite_stats" ORDER BY "report_date" DESC LIMIT 1`,
          )
          .get() as { total_employees: number } | undefined)?.total_employees ?? 0)
      : 0;

    const data: HrTrendPoint[] = rows.map((row) => ({
      period: formatDateToDDMMYYYY(row.period_iso) ?? row.period_iso,
      hire: row.hire ?? 0,
      transfer: row.transfer ?? 0,
      terminate: row.terminate ?? 0,
    }));

    const summary = data.reduce(
      (acc, row) => {
        acc.hire += row.hire;
        acc.transfer += row.transfer;
        acc.terminate += row.terminate;
        return acc;
      },
      { totalEmployees, hire: 0, transfer: 0, terminate: 0 },
    );

    const body: HrTrendResponse = { period, data, summary };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/hr-trend]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
