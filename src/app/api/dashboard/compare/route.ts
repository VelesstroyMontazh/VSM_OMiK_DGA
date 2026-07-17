import { NextResponse } from "next/server";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface WorksiteDeltaRow {
  worksite_name: string;
  countA: number;
  countB: number;
  delta: number;
}

export interface CompareResponse {
  dateA: string;
  dateB: string;
  totalA: number;
  totalB: number;
  deltaTotal: number;
  worksites: WorksiteDeltaRow[];
  noData?: boolean;
}

function parseWorksiteStats(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, Number(v) || 0]),
    );
  } catch {
    return {};
  }
}

/**
 * GET /api/dashboard/compare?dateA=DD.MM.YYYY&dateB=DD.MM.YYYY
 * Дельта численности по площадкам между двумя датами.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateAParam = searchParams.get("dateA")?.trim() ?? null;
    const dateBParam = searchParams.get("dateB")?.trim() ?? null;

    if (!dateAParam || !dateBParam) {
      return NextResponse.json(
        { error: "Укажите dateA и dateB в формате DD.MM.YYYY" },
        { status: 400 },
      );
    }
    if (!isValidDDMMYYYY(dateAParam) || !isValidDDMMYYYY(dateBParam)) {
      return NextResponse.json(
        { error: "Некорректный формат даты. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }

    if (!tableExists("agg_daily_worksite_stats")) {
      return NextResponse.json({
        dateA: dateAParam,
        dateB: dateBParam,
        totalA: 0,
        totalB: 0,
        deltaTotal: 0,
        worksites: [],
        noData: true,
      } satisfies CompareResponse);
    }

    const isoA = parseDDMMYYYYToISO(dateAParam)!;
    const isoB = parseDDMMYYYYToISO(dateBParam)!;
    const db = getDb();

    const rowA = db
      .prepare(
        `SELECT "total_employees", "worksite_stats"
         FROM "agg_daily_worksite_stats"
         WHERE "report_date" = ?`,
      )
      .get(isoA) as
      | { total_employees: number; worksite_stats: string }
      | undefined;

    const rowB = db
      .prepare(
        `SELECT "total_employees", "worksite_stats"
         FROM "agg_daily_worksite_stats"
         WHERE "report_date" = ?`,
      )
      .get(isoB) as
      | { total_employees: number; worksite_stats: string }
      | undefined;

    if (!rowA && !rowB) {
      const body: CompareResponse = {
        dateA: dateAParam,
        dateB: dateBParam,
        totalA: 0,
        totalB: 0,
        deltaTotal: 0,
        worksites: [],
        noData: true,
      };
      return NextResponse.json(body);
    }

    const statsA = parseWorksiteStats(rowA?.worksite_stats ?? null);
    const statsB = parseWorksiteStats(rowB?.worksite_stats ?? null);
    const names = new Set([...Object.keys(statsA), ...Object.keys(statsB)]);

    const worksites: WorksiteDeltaRow[] = Array.from(names)
      .map((worksite_name) => {
        const countA = statsA[worksite_name] ?? 0;
        const countB = statsB[worksite_name] ?? 0;
        return { worksite_name, countA, countB, delta: countB - countA };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 30);

    const totalA = rowA?.total_employees ?? 0;
    const totalB = rowB?.total_employees ?? 0;

    const body: CompareResponse = {
      dateA: formatDateToDDMMYYYY(isoA) ?? dateAParam,
      dateB: formatDateToDDMMYYYY(isoB) ?? dateBParam,
      totalA,
      totalB,
      deltaTotal: totalB - totalA,
      worksites,
      noData: false,
    };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/compare]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
