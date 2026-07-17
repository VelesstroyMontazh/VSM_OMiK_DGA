import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { getKpiDateColumn, tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportType = "overview" | "hr" | "kpi";

function sheetFromRows(rows: Record<string, unknown>[], sheetName: string): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell && typeof cell === "object") {
      cell.t = "s";
    }
  }
  ws["!cols"] = Array.from({ length: range.e.c + 1 }, () => ({ wch: 18 }));
  return ws;
}

function buildWorkbook(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, sheetFromRows(sheet.rows, sheet.name), sheet.name.slice(0, 31));
  }
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }),
  );
}

function attachmentResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function exportOverview(
  dateParam: string | null,
  fromParam: string | null,
  toParam: string | null,
): Buffer {
  const db = getDb();
  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [];

  if (tableExists("agg_daily_worksite_stats", db)) {
    let reportDateIso: string | null = dateParam ? parseDDMMYYYYToISO(dateParam) : null;
    if (!reportDateIso) {
      const latest = db
        .prepare(
          `SELECT MAX("report_date") AS d FROM "agg_daily_worksite_stats" WHERE "report_date" IS NOT NULL`,
        )
        .get() as { d: string | null };
      reportDateIso = latest?.d ?? null;
    }

    const statsRow = reportDateIso
      ? (db
          .prepare(
            `SELECT "report_date", "total_employees" FROM "agg_daily_worksite_stats" WHERE "report_date" = ?`,
          )
          .get(reportDateIso) as { report_date: string; total_employees: number } | undefined)
      : undefined;

    sheets.push({
      name: "KPI",
      rows: [
        {
          "Дата отчёта": formatDateToDDMMYYYY(statsRow?.report_date ?? reportDateIso) ?? "—",
          "Сотрудников на дату": statsRow?.total_employees ?? 0,
        },
      ],
    });

    if (statsRow) {
      const top = db
        .prepare(
          `SELECT "rank", "worksite_name", "employee_count"
           FROM "agg_top_worksites"
           WHERE "report_date" = ?
           ORDER BY "rank" ASC`,
        )
        .all(statsRow.report_date) as {
        rank: number;
        worksite_name: string;
        employee_count: number;
      }[];

      sheets.push({
        name: "ТОП площадок",
        rows: top.map((row) => ({
          "#": row.rank,
          Площадка: row.worksite_name,
          Сотрудников: row.employee_count,
        })),
      });
    } else {
      sheets.push({ name: "ТОП площадок", rows: [] });
    }

    const trendConditions = [`"report_date" IS NOT NULL`];
    const trendParams: string[] = [];
    const fromIso = fromParam ? parseDDMMYYYYToISO(fromParam) : null;
    const toIso = toParam ? parseDDMMYYYYToISO(toParam) : null;
    if (fromIso) {
      trendConditions.push(`"report_date" >= ?`);
      trendParams.push(fromIso);
    }
    if (toIso) {
      trendConditions.push(`"report_date" <= ?`);
      trendParams.push(toIso);
    }

    const trend = db
      .prepare(
        `SELECT "report_date", "total_employees"
         FROM "agg_daily_worksite_stats"
         WHERE ${trendConditions.join(" AND ")}
         ORDER BY "report_date" ASC`,
      )
      .all(...trendParams) as { report_date: string; total_employees: number }[];

    sheets.push({
      name: "Динамика",
      rows: trend.map((row) => ({
        Дата: formatDateToDDMMYYYY(row.report_date) ?? row.report_date,
        Численность: row.total_employees,
      })),
    });
  } else {
    sheets.push(
      { name: "KPI", rows: [] },
      { name: "ТОП площадок", rows: [] },
      { name: "Динамика", rows: [] },
    );
  }

  return buildWorkbook(sheets);
}

function exportHr(period: "week" | "month"): Buffer {
  const db = getDb();
  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [];

  if (!tableExists("fact_hr_events", db)) {
    return buildWorkbook([
      { name: "Сводка", rows: [] },
      { name: "Динамика", rows: [] },
    ]);
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

  const summary = rows.reduce(
    (acc, row) => {
      acc.hire += row.hire ?? 0;
      acc.transfer += row.transfer ?? 0;
      acc.terminate += row.terminate ?? 0;
      return acc;
    },
    { hire: 0, transfer: 0, terminate: 0 },
  );

  const totalEmployees = tableExists("agg_daily_worksite_stats", db)
    ? ((db
        .prepare(
          `SELECT "total_employees" FROM "agg_daily_worksite_stats" ORDER BY "report_date" DESC LIMIT 1`,
        )
        .get() as { total_employees: number } | undefined)?.total_employees ?? 0)
    : 0;

  sheets.push({
    name: "Сводка",
    rows: [
      {
        Период: period === "week" ? "Неделя" : "Месяц",
        "Всего сотрудников": totalEmployees,
        Принято: summary.hire,
        Переведено: summary.transfer,
        Уволено: summary.terminate,
      },
    ],
  });

  sheets.push({
    name: "Динамика",
    rows: rows.map((row) => ({
      Период: formatDateToDDMMYYYY(row.period_iso) ?? row.period_iso,
      Приём: row.hire ?? 0,
      Перевод: row.transfer ?? 0,
      Увольнение: row.terminate ?? 0,
    })),
  });

  return buildWorkbook(sheets);
}

function exportKpi(dateParam: string | null, worksite: string | null): Buffer {
  const db = getDb();
  if (!tableExists("fact_kpi", db)) {
    return buildWorkbook([
      { name: "Сводка", rows: [] },
      { name: "ТОП сотрудников", rows: [] },
      { name: "По площадкам", rows: [] },
      { name: "По должностям", rows: [] },
    ]);
  }

  const dateColumn = getKpiDateColumn(db);
  if (!dateColumn) {
    return buildWorkbook([{ name: "Сводка", rows: [{ Ошибка: "Нет колонки даты в fact_kpi" }] }]);
  }

  let dateIso: string | null = dateParam ? parseDDMMYYYYToISO(dateParam) : null;
  if (!dateIso) {
    const latest = db
      .prepare(`SELECT MAX("${dateColumn}") AS d FROM "fact_kpi" WHERE "${dateColumn}" IS NOT NULL`)
      .get() as { d: string | null };
    dateIso = latest?.d ?? null;
  }

  const where = [`"${dateColumn}" = ?`, `"total_score" IS NOT NULL`];
  const params: (string | number)[] = [dateIso ?? ""];
  if (worksite) {
    where.push(`"worksite_name" = ?`);
    params.push(worksite);
  }

  if (!dateIso) {
    return buildWorkbook([{ name: "Сводка", rows: [] }]);
  }

  const whereSql = where.join(" AND ");

  const topEmployees = db
    .prepare(
      `
      SELECT
        COALESCE("full_name",'(без ФИО)') AS full_name,
        COALESCE("tab_number",'') AS tab_number,
        COALESCE("worksite_name",'(без площадки)') AS worksite_name,
        COALESCE("position_name",'(без должности)') AS position_name,
        ROUND(CAST("total_score" AS REAL), 2) AS total_score
      FROM "fact_kpi"
      WHERE ${whereSql}
      ORDER BY CAST("total_score" AS REAL) DESC
      LIMIT 10
      `,
    )
    .all(...params) as {
    full_name: string;
    tab_number: string;
    worksite_name: string;
    position_name: string;
    total_score: number;
  }[];

  const avgWorksite = db
    .prepare(
      `
      SELECT COALESCE("worksite_name",'(без площадки)') AS name,
             ROUND(AVG(CAST("total_score" AS REAL)), 2) AS avg_score
      FROM "fact_kpi"
      WHERE ${whereSql}
      GROUP BY "worksite_name"
      ORDER BY avg_score DESC
      `,
    )
    .all(...params) as { name: string; avg_score: number }[];

  const avgPosition = db
    .prepare(
      `
      SELECT COALESCE("position_name",'(без должности)') AS name,
             ROUND(AVG(CAST("total_score" AS REAL)), 2) AS avg_score
      FROM "fact_kpi"
      WHERE ${whereSql}
      GROUP BY "position_name"
      ORDER BY avg_score DESC
      `,
    )
    .all(...params) as { name: string; avg_score: number }[];

  return buildWorkbook([
    {
      name: "Сводка",
      rows: [
        {
          "Дата оценки": formatDateToDDMMYYYY(dateIso),
          Площадка: worksite ?? "Все",
          "Записей оценок": topEmployees.length > 0 ? avgWorksite.length : 0,
        },
      ],
    },
    {
      name: "ТОП сотрудников",
      rows: topEmployees.map((row, i) => ({
        "#": i + 1,
        ФИО: row.full_name,
        "Таб. №": row.tab_number,
        Площадка: row.worksite_name,
        Должность: row.position_name,
        Оценка: row.total_score,
      })),
    },
    {
      name: "По площадкам",
      rows: avgWorksite.map((row) => ({
        Площадка: row.name,
        "Средний балл": row.avg_score,
      })),
    },
    {
      name: "По должностям",
      rows: avgPosition.map((row) => ({
        Должность: row.name,
        "Средний балл": row.avg_score,
      })),
    },
  ]);
}

/**
 * GET /api/dashboard/export?type=overview|hr|kpi&...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") ?? "") as ExportType;

    if (type !== "overview" && type !== "hr" && type !== "kpi") {
      return NextResponse.json(
        { error: "Некорректный type. Допустимо: overview|hr|kpi" },
        { status: 400 },
      );
    }

    const dateParam = searchParams.get("date")?.trim() ?? null;
    const fromParam = searchParams.get("from")?.trim() ?? null;
    const toParam = searchParams.get("to")?.trim() ?? null;
    const worksite = searchParams.get("worksite")?.trim() || null;
    const period = (searchParams.get("period") ?? "month") as "week" | "month";

    if (dateParam && !isValidDDMMYYYY(dateParam)) {
      return NextResponse.json({ error: "Некорректный date" }, { status: 400 });
    }
    if (fromParam && !isValidDDMMYYYY(fromParam)) {
      return NextResponse.json({ error: "Некорректный from" }, { status: 400 });
    }
    if (toParam && !isValidDDMMYYYY(toParam)) {
      return NextResponse.json({ error: "Некорректный to" }, { status: 400 });
    }
    if (type === "hr" && period !== "week" && period !== "month") {
      return NextResponse.json({ error: "Некорректный period" }, { status: 400 });
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let buffer: Buffer;
    let filename: string;

    switch (type) {
      case "overview":
        buffer = exportOverview(dateParam, fromParam, toParam);
        filename = `overview_${dateParam?.replace(/\./g, "") ?? stamp}.xlsx`;
        break;
      case "hr":
        buffer = exportHr(period);
        filename = `hr_${period}_${stamp}.xlsx`;
        break;
      case "kpi":
        buffer = exportKpi(dateParam, worksite);
        filename = `kpi_${dateParam?.replace(/\./g, "") ?? stamp}.xlsx`;
        break;
      default: {
        const _exhaustive: never = type;
        return NextResponse.json({ error: String(_exhaustive) }, { status: 400 });
      }
    }

    return attachmentResponse(buffer, filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/export]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
