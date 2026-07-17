import { NextRequest, NextResponse } from "next/server";
import { formatDateToDDMMYYYY } from "@/lib/formatDate";
import { tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface FlightRow {
  tab_number: string;
  full_name: string | null;
  route: string | null;
  ticket_departure_date: string | null;
  arrival_date: string | null;
  direction: string | null;
  ticket_cost: number;
  transport_type: string | null;
}

export interface FlightsResponse {
  data: FlightRow[];
  total: number;
  page: number;
  limit: number;
}

/**
 * GET /api/dashboard/flights?page=1&limit=50&search=
 */
export async function GET(request: NextRequest) {
  try {
    if (!tableExists("fact_flights")) {
      return NextResponse.json({ data: [], total: 0, page: 1, limit: 50 } satisfies FlightsResponse);
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;
    const search = searchParams.get("search")?.trim() ?? "";

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];
    if (search) {
      conditions.push(`("tab_number" LIKE ? OR "full_name" LIKE ? OR "route" LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const whereSql = conditions.join(" AND ");
    const db = getDb();

    const total = (
      db.prepare(`SELECT COUNT(*) AS c FROM "fact_flights" WHERE ${whereSql}`).get(...params) as {
        c: number;
      }
    ).c;

    const rows = db
      .prepare(
        `SELECT
           COALESCE("tab_number",'') AS tab_number,
           "full_name", "route", "ticket_departure_date", "arrival_date",
           "direction",
           ROUND(COALESCE(CAST("ticket_cost" AS REAL), 0), 2) AS ticket_cost,
           "transport_type"
         FROM "fact_flights"
         WHERE ${whereSql}
         ORDER BY "ticket_departure_date" DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as FlightRow[];

    const body: FlightsResponse = {
      data: rows.map((r) => ({
        ...r,
        ticket_departure_date: formatDateToDDMMYYYY(String(r.ticket_departure_date ?? "")),
        arrival_date: formatDateToDDMMYYYY(String(r.arrival_date ?? "")),
      })),
      total,
      page,
      limit,
    };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/flights]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
