import { NextResponse } from "next/server";
import { formatDateToDDMMYYYY } from "@/lib/formatDate";
import { getKpiDateColumn, getKpiScoreColumn, tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface KpiHistoryPoint {
  date: string;
  total_score: number;
  worksite_name: string;
  position_name: string;
  source_file?: string | null;
}

type RouteContext = {
  params: Promise<{ tabNumber: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { tabNumber: rawTab } = await context.params;
    const tabNumber = decodeURIComponent(rawTab).trim();
    if (!tabNumber) {
      return NextResponse.json({ error: "tabNumber не указан" }, { status: 400 });
    }
    if (!tableExists("fact_kpi")) {
      return NextResponse.json({ data: [] });
    }

    const db = getDb();
    const scoreColumn = getKpiScoreColumn(db);
    if (!scoreColumn) return NextResponse.json({ data: [] });

    const dateColumn = getKpiDateColumn(db);
    const dateSelect = dateColumn ? `"${dateColumn}" AS d` : `NULL AS d`;

    const data = db
      .prepare(
        `
        SELECT
          ${dateSelect},
          ROUND(CAST("${scoreColumn}" AS REAL), 2) AS total_score,
          COALESCE("worksite_name",'(без площадки)') AS worksite_name,
          COALESCE("position_name",'(без должности)') AS position_name,
          "source_file"
        FROM "fact_kpi"
        WHERE "tab_number" = ? OR "employee_uid" = ?
          AND "${scoreColumn}" IS NOT NULL
        ORDER BY CAST("${scoreColumn}" AS REAL) DESC
        LIMIT 30
        `,
      )
      .all(tabNumber, tabNumber)
      .map((row) => {
        const r = row as {
          d: string | null;
          total_score: number;
          worksite_name: string;
          position_name: string;
          source_file: string | null;
        };
        const dateLabel =
          r.d != null
            ? formatDateToDDMMYYYY(String(r.d)) ?? String(r.d)
            : r.source_file?.split(/[/\\]/).pop() ?? "—";
        return {
          date: dateLabel,
          total_score: Number(r.total_score ?? 0),
          worksite_name: String(r.worksite_name),
          position_name: String(r.position_name),
          source_file: r.source_file,
        } satisfies KpiHistoryPoint;
      });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/kpi-history]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
