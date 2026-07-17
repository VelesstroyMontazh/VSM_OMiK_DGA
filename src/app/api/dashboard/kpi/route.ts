import { NextResponse } from "next/server";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { getKpiDateColumn, getKpiScoreColumn, tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface KpiEmployee {
  tab_number: string;
  full_name: string;
  worksite_name: string;
  position_name: string;
  total_score: number;
}

export interface KpiAvgRow {
  name: string;
  avg_score: number;
}

export interface KpiResponse {
  date: string | null;
  worksite: string | null;
  topEmployees: KpiEmployee[];
  avgScoreByWorksite: KpiAvgRow[];
  avgScoreByPosition: KpiAvgRow[];
}

export async function GET(request: Request) {
  try {
    if (!tableExists("fact_kpi")) {
      const empty: KpiResponse = {
        date: null,
        worksite: null,
        topEmployees: [],
        avgScoreByWorksite: [],
        avgScoreByPosition: [],
      };
      return NextResponse.json(empty);
    }

    const db = getDb();
    const scoreColumn = getKpiScoreColumn(db);
    if (!scoreColumn) {
      return NextResponse.json(
        { error: "В fact_kpi нет колонки final_score/total_score" },
        { status: 500 },
      );
    }

    const dateColumn = getKpiDateColumn(db);
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim() ?? null;
    const worksite = searchParams.get("worksite")?.trim() || null;

    if (dateParam && !isValidDDMMYYYY(dateParam)) {
      return NextResponse.json(
        { error: "Некорректный параметр date. Ожидается DD.MM.YYYY" },
        { status: 400 },
      );
    }

    const where: string[] = [`"${scoreColumn}" IS NOT NULL`];
    const params: (string | number)[] = [];
    let dateIso: string | null = null;

    if (dateColumn) {
      dateIso = dateParam ? parseDDMMYYYYToISO(dateParam) : null;
      if (!dateIso) {
        const latest = db
          .prepare(
            `SELECT MAX("${dateColumn}") AS d FROM "fact_kpi" WHERE "${dateColumn}" IS NOT NULL`,
          )
          .get() as { d: string | null };
        dateIso = latest?.d ?? null;
      }
      if (dateIso) {
        where.push(`"${dateColumn}" = ?`);
        params.push(dateIso);
      }
    }

    if (worksite) {
      where.push(`"worksite_name" = ?`);
      params.push(worksite);
    }

    const whereSql = where.join(" AND ");

    const topEmployees = db
      .prepare(
        `
        WITH ranked AS (
          SELECT
            COALESCE("tab_number",'') AS tab_number,
            COALESCE("full_name",'(без ФИО)') AS full_name,
            COALESCE("worksite_name",'(без площадки)') AS worksite_name,
            COALESCE("position_name",'(без должности)') AS position_name,
            CAST("${scoreColumn}" AS REAL) AS score_value,
            ROW_NUMBER() OVER (
              PARTITION BY "tab_number"
              ORDER BY CAST("${scoreColumn}" AS REAL) DESC
            ) AS rn
          FROM "fact_kpi"
          WHERE ${whereSql}
        )
        SELECT
          tab_number,
          full_name,
          worksite_name,
          position_name,
          ROUND(score_value, 2) AS total_score
        FROM ranked
        WHERE rn = 1
        ORDER BY score_value DESC
        LIMIT 10
        `,
      )
      .all(...params) as KpiEmployee[];

    const avgScoreByWorksite = db
      .prepare(
        `
        SELECT
          COALESCE("worksite_name",'(без площадки)') AS name,
          ROUND(AVG(CAST("${scoreColumn}" AS REAL)), 2) AS avg_score
        FROM "fact_kpi"
        WHERE ${whereSql}
        GROUP BY "worksite_name"
        ORDER BY avg_score DESC
        LIMIT 20
        `,
      )
      .all(...params) as KpiAvgRow[];

    const avgScoreByPosition = db
      .prepare(
        `
        SELECT
          COALESCE("position_name",'(без должности)') AS name,
          ROUND(AVG(CAST("${scoreColumn}" AS REAL)), 2) AS avg_score
        FROM "fact_kpi"
        WHERE ${whereSql}
        GROUP BY "position_name"
        ORDER BY avg_score DESC
        LIMIT 20
        `,
      )
      .all(...params) as KpiAvgRow[];

    const body: KpiResponse = {
      date: dateIso ? formatDateToDDMMYYYY(dateIso) : null,
      worksite,
      topEmployees,
      avgScoreByWorksite,
      avgScoreByPosition,
    };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/kpi]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
