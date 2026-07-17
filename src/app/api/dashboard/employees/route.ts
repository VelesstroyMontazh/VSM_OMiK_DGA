import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface WarehouseEmployee {
  tab_number: string;
  full_name: string | null;
  position: string | null;
  department: string | null;
  employee_uid?: string | null;
}

export interface WarehouseEmployeesResponse {
  data: WarehouseEmployee[];
  total: number;
  page: number;
  limit: number;
}

/**
 * GET /api/dashboard/employees?page=1&limit=20
 * Пагинация dim_employee из warehouse.
 * (Legacy /api/employees остаётся для in-memory cache панели.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const offset = (page - 1) * limit;

    const db = getDb();

    const total = (
      db.prepare(`SELECT COUNT(*) AS c FROM "dim_employee"`).get() as { c: number }
    ).c;

    // employee_uid может отсутствовать до перезапуска ETL
    const cols = (
      db.prepare(`PRAGMA table_info("dim_employee")`).all() as { name: string }[]
    ).map((r) => r.name);
    const hasUid = cols.includes("employee_uid");

    const selectCols = hasUid
      ? `"tab_number", "full_name", "position", "department", "employee_uid"`
      : `"tab_number", "full_name", "position", "department"`;

    const data = db
      .prepare(
        `SELECT ${selectCols}
         FROM "dim_employee"
         ORDER BY "full_name"
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as WarehouseEmployee[];

    const body: WarehouseEmployeesResponse = { data, total, page, limit };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/employees]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
