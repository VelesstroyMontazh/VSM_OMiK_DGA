import type Database from "better-sqlite3";
import { getDb } from "@/lib/sqlite";

export function tableExists(table: string, db: Database.Database = getDb()): boolean {
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(table);
  return Boolean(row);
}

export function columnExists(
  table: string,
  column: string,
  db: Database.Database = getDb(),
): boolean {
  if (!tableExists(table, db)) return false;
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

export function getKpiDateColumn(db: Database.Database = getDb()): "evaluation_date" | "report_date" | null {
  if (!tableExists("fact_kpi", db)) return null;
  const cols = db.prepare(`PRAGMA table_info("fact_kpi")`).all() as { name: string }[];
  const names = cols.map((c) => c.name);
  if (names.includes("evaluation_date")) return "evaluation_date";
  if (names.includes("report_date")) return "report_date";
  return null;
}

/** Колонка итоговой оценки в fact_kpi (final_score в текущем ETL). */
export function getKpiScoreColumn(db: Database.Database = getDb()): "total_score" | "final_score" | null {
  if (!tableExists("fact_kpi", db)) return null;
  if (columnExists("fact_kpi", "final_score", db)) return "final_score";
  if (columnExists("fact_kpi", "total_score", db)) return "total_score";
  return null;
}
