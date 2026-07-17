import { NextRequest, NextResponse } from "next/server";
import {
  formatDateToDDMMYYYY,
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TicketRow {
  tab_number: string;
  full_name: string | null;
  route: string | null;
  ticket_issue_date: string | null;
  ticket_number: string | null;
  carrier: string | null;
  base_ticket_cost: number;
  ticket_amount_agency_fee: number;
  flight_reason: string | null;
}

export interface TicketsResponse {
  data: TicketRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total_cost: number;
    total_tickets: number;
    avg_cost: number;
  };
}

/**
 * GET /api/dashboard/tickets?page=1&limit=50&search=&from=&to=
 */
export async function GET(request: NextRequest) {
  try {
    if (!tableExists("fact_ticket_finance")) {
      const empty: TicketsResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        summary: { total_cost: 0, total_tickets: 0, avg_cost: 0 },
      };
      return NextResponse.json(empty);
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;
    const search = searchParams.get("search")?.trim() ?? "";
    const fromParam = searchParams.get("from")?.trim() ?? null;
    const toParam = searchParams.get("to")?.trim() ?? null;

    if (fromParam && !isValidDDMMYYYY(fromParam)) {
      return NextResponse.json({ error: "Некорректный from (DD.MM.YYYY)" }, { status: 400 });
    }
    if (toParam && !isValidDDMMYYYY(toParam)) {
      return NextResponse.json({ error: "Некорректный to (DD.MM.YYYY)" }, { status: 400 });
    }

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`("tab_number" LIKE ? OR "full_name" LIKE ? OR "route" LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (fromParam) {
      const iso = parseDDMMYYYYToISO(fromParam);
      if (iso) {
        conditions.push(`"ticket_issue_date" >= ?`);
        params.push(iso);
      }
    }
    if (toParam) {
      const iso = parseDDMMYYYYToISO(toParam);
      if (iso) {
        conditions.push(`"ticket_issue_date" <= ?`);
        params.push(iso);
      }
    }

    const whereSql = conditions.join(" AND ");
    const db = getDb();

    const total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM "fact_ticket_finance" WHERE ${whereSql}`)
        .get(...params) as { c: number }
    ).c;

    const summaryRow = db
      .prepare(
        `SELECT
           COUNT(*) AS total_tickets,
           ROUND(SUM(COALESCE(CAST("base_ticket_cost" AS REAL), 0)), 2) AS total_cost
         FROM "fact_ticket_finance"
         WHERE ${whereSql}`,
      )
      .get(...params) as { total_tickets: number; total_cost: number };

    const rows = db
      .prepare(
        `SELECT
           COALESCE("tab_number",'') AS tab_number,
           "full_name", "route", "ticket_issue_date", "ticket_number", "carrier",
           ROUND(COALESCE(CAST("base_ticket_cost" AS REAL), 0), 2) AS base_ticket_cost,
           ROUND(COALESCE(CAST("ticket_amount_agency_fee" AS REAL), 0), 2) AS ticket_amount_agency_fee,
           "flight_reason"
         FROM "fact_ticket_finance"
         WHERE ${whereSql}
         ORDER BY "ticket_issue_date" DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as TicketRow[];

    const totalCost = Number(summaryRow?.total_cost ?? 0);
    const totalTickets = Number(summaryRow?.total_tickets ?? 0);

    const body: TicketsResponse = {
      data: rows.map((r) => ({
        ...r,
        ticket_issue_date: formatDateToDDMMYYYY(String(r.ticket_issue_date ?? "")),
      })),
      total,
      page,
      limit,
      summary: {
        total_cost: totalCost,
        total_tickets: totalTickets,
        avg_cost: totalTickets > 0 ? Math.round((totalCost / totalTickets) * 100) / 100 : 0,
      },
    };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/tickets]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
