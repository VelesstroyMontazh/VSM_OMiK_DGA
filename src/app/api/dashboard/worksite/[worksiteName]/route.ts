import { NextResponse } from "next/server";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface WorksiteEmployee {
  full_name: string;
  tab_number: string;
  position: string | null;
}

export interface WorksiteDetailResponse {
  worksite: string;
  date: string | null;
  employees: WorksiteEmployee[];
}

type RouteContext = {
  params: Promise<{ worksiteName: string }>;
};

/**
 * GET /api/dashboard/worksite/[worksiteName]?date=DD.MM.YYYY
 * Drill-down: сотрудники площадки на указанную или последнюю дату явки.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { worksiteName: rawName } = await context.params;
    const worksite = decodeURIComponent(rawName).trim();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim() ?? null;

    if (!worksite) {
      return NextResponse.json({ error: "Площадка не указана" }, { status: 400 });
    }

    if (dateParam && !isValidDDMMYYYY(dateParam)) {
      return NextResponse.json(
        { error: "Некорректный параметр date. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }

    const db = getDb();

    let reportDateIso: string | null = null;
    if (dateParam) {
      reportDateIso = parseDDMMYYYYToISO(dateParam);
    } else {
      const latestRow = db
        .prepare(
          `SELECT MAX("report_date") AS d
           FROM "fact_daily_attendance"
           WHERE "report_date" IS NOT NULL`,
        )
        .get() as { d: string | null };
      reportDateIso = latestRow?.d ?? null;
    }

    if (!reportDateIso) {
      return NextResponse.json(
        { error: "Нет данных явки в базе" },
        { status: 404 },
      );
    }

    const exists = db
      .prepare(
        `SELECT 1 AS ok
         FROM "fact_daily_attendance"
         WHERE "worksite_name" = ? AND "report_date" = ?
         LIMIT 1`,
      )
      .get(worksite, reportDateIso) as { ok: number } | undefined;

    if (!exists) {
      return NextResponse.json(
        {
          error: `Площадка «${worksite}» не найдена на дату ${formatDateToDDMMYYYY(reportDateIso)}`,
        },
        { status: 404 },
      );
    }

    const rows = db
      .prepare(
        `SELECT "full_name", "tab_number", "position_name"
         FROM "fact_daily_attendance"
         WHERE "worksite_name" = ?
           AND "report_date" = ?
         GROUP BY "tab_number", "full_name", "position_name"
         ORDER BY "full_name" ASC
         LIMIT 100`,
      )
      .all(worksite, reportDateIso) as {
      full_name: string | null;
      tab_number: string | null;
      position_name: string | null;
    }[];

    const body: WorksiteDetailResponse = {
      worksite,
      date: formatDateToDDMMYYYY(reportDateIso),
      employees: rows.map((row) => ({
        full_name: row.full_name?.trim() || "(без ФИО)",
        tab_number: row.tab_number?.trim() || "—",
        position: row.position_name?.trim() || null,
      })),
    };

    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/worksite]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
