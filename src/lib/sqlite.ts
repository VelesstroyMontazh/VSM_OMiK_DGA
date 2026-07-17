/**
 * Подключение к аналитическому Data Warehouse (SQLite).
 * Prisma остаётся для User/метаданных — здесь только SELECT к витринам.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const globalForWarehouse = globalThis as unknown as {
  vsmWarehouseDb?: Database.Database;
};

/** Кандидаты пути: DATABASE_PATH → vsm_database.db → db/project_data.db */
function resolveDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }
  const root = process.cwd();
  const candidates = [
    path.join(root, "vsm_database.db"),
    path.join(root, "db", "project_data.db"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  // дефолт по ТЗ (файл появится после ETL)
  return path.join(root, "vsm_database.db");
}

export function getWarehouseDbPath(): string {
  return resolveDbPath();
}

/**
 * Синглтон better-sqlite3 (readonly).
 * globalThis — чтобы не плодить соединения при Hot Reload в dev.
 */
export function getDb(): Database.Database {
  if (globalForWarehouse.vsmWarehouseDb) {
    return globalForWarehouse.vsmWarehouseDb;
  }

  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Warehouse DB not found: ${dbPath}. ` +
        `Запустите ETL (python etl_loader.py) или задайте DATABASE_PATH.`
    );
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  // WAL допустим и в readonly (для согласованного чтения при параллельном ETL)
  try {
    db.pragma("journal_mode = WAL");
  } catch {
    /* ignore */
  }
  db.pragma("busy_timeout = 5000");

  globalForWarehouse.vsmWarehouseDb = db;
  return db;
}
