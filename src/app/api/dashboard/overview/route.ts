import { NextResponse } from "next/server";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TopWorksiteRow {
  worksite_name: string;
  employee_count: number;
}

export interface DashboardOverviewResponse {
  totalEmployees: number;
  /** Дата отчёта в формате ДД.ММ.ГГГГ */
  date: string | null;
  topWorksites: TopWorksiteRow[];
  /** true — запрошенная дата отсутствует в витрине */
  noData?: boolean;
}

function tableExists(table: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
    )
    .get(table);
  return Boolean(row);
}

/**
 * GET /api/dashboard/overview?date=DD.MM.YYYY
 * KPI из agg_daily_worksite_stats / agg_top_worksites.
 */
export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim() ?? null;

    if (!tableExists("agg_daily_worksite_stats")) {
      return NextResponse.json(
        {
          error: "Витрины не найдены. Запустите: python update_aggregates.py",
        },
        { status: 503 },
      );
    }

    if (dateParam && !isValidDDMMYYYY(dateParam)) {
      return NextResponse.json(
        { error: "Некорректный параметр date. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }

    let reportDateIso: string | null = null;
    if (dateParam) {
      reportDateIso = parseDDMMYYYYToISO(dateParam);
    } else {
      const latest = db
        .prepare(
          `SELECT MAX("report_date") AS d
           FROM "agg_daily_worksite_stats"
           WHERE "report_date" IS NOT NULL`,
        )
        .get() as { d: string | null };
      reportDateIso = latest?.d ?? null;
    }

    if (!reportDateIso) {
      const body: DashboardOverviewResponse = {
        totalEmployees: 0,
        date: dateParam,
        topWorksites: [],
        noData: Boolean(dateParam),
      };
      return NextResponse.json(body);
    }

    const statsRow = db
      .prepare(
        `SELECT "report_date", "total_employees"
         FROM "agg_daily_worksite_stats"
         WHERE "report_date" = ?`,
      )
      .get(reportDateIso) as
      | { report_date: string; total_employees: number }
      | undefined;

    if (!statsRow) {
      const body: DashboardOverviewResponse = {
        totalEmployees: 0,
        date: dateParam ?? formatDateToDDMMYYYY(reportDateIso),
        topWorksites: [],
        noData: true,
      };
      return NextResponse.json(body);
    }

    const topWorksites = db
      .prepare(
        `SELECT "worksite_name", "employee_count"
         FROM "agg_top_worksites"
         WHERE "report_date" = ?
         ORDER BY "rank" ASC`,
      )
      .all(statsRow.report_date) as TopWorksiteRow[];

    const body: DashboardOverviewResponse = {
      totalEmployees: statsRow.total_employees,
      date: formatDateToDDMMYYYY(statsRow.report_date),
      topWorksites,
      noData: false,
    };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/overview]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
