import { NextResponse } from "next/server";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TrendPoint {
  date: string;
  total: number;
}

export interface TrendResponse {
  data: TrendPoint[];
}

function tableExists(table: string): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(table);
  return Boolean(row);
}

/**
 * GET /api/dashboard/trend?from=DD.MM.YYYY&to=DD.MM.YYYY
 * Динамика численности из agg_daily_worksite_stats.
 */
export async function GET(request: Request) {
  try {
    if (!tableExists("agg_daily_worksite_stats")) {
      return NextResponse.json({ data: [] } satisfies TrendResponse);
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from")?.trim() ?? null;
    const toParam = searchParams.get("to")?.trim() ?? null;

    if (fromParam && !isValidDDMMYYYY(fromParam)) {
      return NextResponse.json(
        { error: "Некорректный параметр from. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }
    if (toParam && !isValidDDMMYYYY(toParam)) {
      return NextResponse.json(
        { error: "Некорректный параметр to. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }

    const fromIso = fromParam ? parseDDMMYYYYToISO(fromParam) : null;
    const toIso = toParam ? parseDDMMYYYYToISO(toParam) : null;

    if (fromIso && toIso && fromIso > toIso) {
      return NextResponse.json(
        { error: "from не может быть позже to" },
        { status: 400 },
      );
    }

    const db = getDb();
    const conditions = [`"report_date" IS NOT NULL`];
    const params: string[] = [];

    if (fromIso) {
      conditions.push(`"report_date" >= ?`);
      params.push(fromIso);
    }
    if (toIso) {
      conditions.push(`"report_date" <= ?`);
      params.push(toIso);
    }

    const rows = db
      .prepare(
        `SELECT "report_date", "total_employees"
         FROM "agg_daily_worksite_stats"
         WHERE ${conditions.join(" AND ")}
         ORDER BY "report_date" ASC`,
      )
      .all(...params) as { report_date: string; total_employees: number }[];

    const data: TrendPoint[] = rows.map((row) => ({
      date: formatDateToDDMMYYYY(row.report_date) ?? row.report_date,
      total: row.total_employees,
    }));

    return NextResponse.json({ data } satisfies TrendResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/trend]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
