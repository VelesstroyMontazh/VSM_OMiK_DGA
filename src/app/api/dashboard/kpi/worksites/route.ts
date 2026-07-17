import { NextResponse } from "next/server";
import {
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { getKpiDateColumn, tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface KpiWorksitesResponse {
  worksites: string[];
}

/**
 * GET /api/dashboard/kpi/worksites?date=DD.MM.YYYY
 */
export async function GET(request: Request) {
  try {
    if (!tableExists("fact_kpi")) {
      return NextResponse.json({ worksites: [] } satisfies KpiWorksitesResponse);
    }

    const db = getDb();
    const dateColumn = getKpiDateColumn(db);

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim() ?? null;

    if (dateParam && !isValidDDMMYYYY(dateParam)) {
      return NextResponse.json(
        { error: "Некорректный параметр date. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }

    const conditions = [`"worksite_name" IS NOT NULL`, `TRIM("worksite_name") != ''`];
    const params: string[] = [];

    if (dateColumn && dateParam) {
      const dateIso = parseDDMMYYYYToISO(dateParam);
      if (dateIso) {
        conditions.push(`"${dateColumn}" = ?`);
        params.push(dateIso);
      }
    }

    const rows = db
      .prepare(
        `
        SELECT DISTINCT "worksite_name" AS name
        FROM "fact_kpi"
        WHERE ${conditions.join(" AND ")}
        ORDER BY "worksite_name" ASC
        `,
      )
      .all(...params) as { name: string }[];

    return NextResponse.json({ worksites: rows.map((r) => r.name) } satisfies KpiWorksitesResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/kpi/worksites]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
