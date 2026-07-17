import { NextRequest, NextResponse } from "next/server";
import { formatDateToDDMMYYYY } from "@/lib/formatDate";
import { tableExists } from "@/lib/dashboard-db";
import {
  buildHrEventSql,
  ensureHrIndexes,
  listHrFilterOptions,
  parseHrFilters,
} from "@/lib/hr-filters";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DynamicsPoint {
  month: string;
  hire: number;
  transfer: number;
  fire: number;
}

/**
 * GET /api/dashboard/dynamics
 */
export async function GET(request: NextRequest) {
  try {
    ensureHrIndexes();
    if (!tableExists("fact_hr_events")) {
      return NextResponse.json({
        dynamics: [],
        summary: { hire: 0, transfer: 0, fire: 0 },
        filters: { worksites: [], citizenships: [] },
      });
    }

    const filters = parseHrFilters(new URL(request.url).searchParams);
    filters.eventType = null;

    const sql = buildHrEventSql(filters);
    const db = getDb();
    const options = listHrFilterOptions();

    const rows = db
      .prepare(
        `
        SELECT
          substr(e."event_date", 1, 7) AS month_iso,
          SUM(CASE WHEN e."event_type" = 'hire' THEN 1 ELSE 0 END) AS hire,
          SUM(CASE WHEN e."event_type" = 'transfer' THEN 1 ELSE 0 END) AS transfer,
          SUM(CASE WHEN e."event_type" = 'terminate' THEN 1 ELSE 0 END) AS fire
        FROM "fact_hr_events" e
        ${sql.joinSql}
        WHERE ${sql.whereSql}
        GROUP BY month_iso
        ORDER BY month_iso ASC
        `,
      )
      .all(...sql.params) as {
      month_iso: string;
      hire: number;
      transfer: number;
      fire: number;
    }[];

    const dynamics: DynamicsPoint[] = rows.map((r) => ({
      month: formatDateToDDMMYYYY(`${r.month_iso}-01`)?.slice(3) ?? r.month_iso,
      hire: Number(r.hire ?? 0),
      transfer: Number(r.transfer ?? 0),
      fire: Number(r.fire ?? 0),
    }));

    const summary = dynamics.reduce(
      (acc, row) => {
        acc.hire += row.hire;
        acc.transfer += row.transfer;
        acc.fire += row.fire;
        return acc;
      },
      { hire: 0, transfer: 0, fire: 0 },
    );

    return NextResponse.json({
      dynamics,
      summary,
      from: formatDateToDDMMYYYY(sql.fromIso),
      to: formatDateToDDMMYYYY(sql.toIso),
      filters: options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/dynamics]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
