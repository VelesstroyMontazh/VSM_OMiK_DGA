import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthSession, requireAdmin } from "@/lib/auth-guard";
import { tableExists } from "@/lib/dashboard-db";
import { getDb, getWarehouseDbPath } from "@/lib/sqlite";
import { db as prismaDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAREHOUSE_TABLES = [
  "dim_employee",
  "fact_daily_attendance",
  "fact_hr_events",
  "fact_kpi",
  "fact_ticket_finance",
  "fact_flights",
  "agg_daily_worksite_stats",
  "agg_top_worksites",
];

function readLastLogLine(logDir: string): string | null {
  if (!fs.existsSync(logDir)) return null;
  const files = fs
    .readdirSync(logDir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(logDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) return null;
  const content = fs.readFileSync(path.join(logDir, files[0].name), "utf-8");
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-3).join("\n") || null;
}

/**
 * GET /api/admin/status — статус warehouse и системы (admin или публичная сводка).
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    const isAdmin = role === "admin";

    const dbPath = getWarehouseDbPath();
    const dbExists = fs.existsSync(dbPath);
    const tableStats: Record<string, number> = {};

    if (dbExists) {
      const wh = getDb();
      for (const table of WAREHOUSE_TABLES) {
        if (tableExists(table, wh)) {
          tableStats[table] = (
            wh.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }
          ).c;
        }
      }
    }

    const logDir = path.join(process.cwd(), "db", "logs");
    const lastLog = readLastLogLine(logDir);

    let userCount = 0;
    try {
      userCount = await prismaDb.user.count();
    } catch {
      userCount = 0;
    }

    return NextResponse.json({
      isAdmin,
      warehouse: {
        path: dbPath,
        exists: dbExists,
        tables: tableStats,
      },
      etl: {
        logDir,
        lastLogSnippet: lastLog,
        batchScript: path.join(process.cwd(), "run_etl.bat"),
        scheduledTask: "VSM_ETL_Daily",
      },
      users: isAdmin ? { total: userCount } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/status]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/etl/note — только заметка; реальный запуск через run_etl.bat / Планировщик.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return NextResponse.json({
    ok: true,
    message:
      "ETL запускается через run_etl.bat или задачу VSM_ETL_Daily в Планировщике Windows.",
  });
}
