import { NextRequest, NextResponse } from "next/server";
import { formatDateToDDMMYYYY } from "@/lib/formatDate";
import { tableExists } from "@/lib/dashboard-db";
import {
  buildHrEventSql,
  ensureHrIndexes,
  EVENT_TYPE_LABEL,
  listHrFilterOptions,
  parseHrFilters,
} from "@/lib/hr-filters";
import { getDb } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ChronologyEvent {
  id: string;
  tabNumber: string;
  fullName: string;
  eventType: string;
  eventDate: string | null;
  worksite: string | null;
  department: string | null;
  position: string | null;
  citizenship: string | null;
  prevSite: string | null;
  newSite: string | null;
}

/**
 * GET /api/dashboard/chronology
 * Lightweight: no full COUNT(*), no dim_employee join unless citizenship filter.
 */
export async function GET(request: NextRequest) {
  try {
    ensureHrIndexes();
    if (!tableExists("fact_hr_events")) {
      return NextResponse.json({
        events: [],
        total: 0,
        hasMore: false,
        filters: { worksites: [], citizenships: [] },
      });
    }

    const filters = parseHrFilters(new URL(request.url).searchParams);
    const sql = buildHrEventSql(filters);
    const db = getDb();
    const options = listHrFilterOptions();

    // Fetch limit+1 to know if there are more rows (avoids COUNT(*) on 600k)
    const fetchLimit = filters.limit + 1;
    const rows = db
      .prepare(
        `
        SELECT
          e."tab_number" AS tab_number,
          e."full_name" AS full_name,
          e."event_type" AS event_type,
          e."event_date" AS event_date,
          e."new_site" AS new_site,
          e."prev_site" AS prev_site,
          e."new_dept" AS new_dept,
          e."new_pos" AS new_pos
        FROM "fact_hr_events" e
        ${sql.joinSql}
        WHERE ${sql.whereSql}
        ORDER BY e."event_date" DESC
        LIMIT ?
        `,
      )
      .all(...sql.params, fetchLimit) as {
      tab_number: string | null;
      full_name: string | null;
      event_type: string | null;
      event_date: string | null;
      new_site: string | null;
      prev_site: string | null;
      new_dept: string | null;
      new_pos: string | null;
    }[];

    const hasMore = rows.length > filters.limit;
    const sliced = hasMore ? rows.slice(0, filters.limit) : rows;

    const events: ChronologyEvent[] = sliced.map((r, i) => {
      const typeKey = (r.event_type ?? "").toLowerCase();
      return {
        id: `${r.tab_number ?? ""}-${r.event_date ?? ""}-${typeKey}-${i}`,
        tabNumber: r.tab_number?.trim() || "—",
        fullName: r.full_name?.trim() || "(без ФИО)",
        eventType: EVENT_TYPE_LABEL[typeKey] ?? typeKey,
        eventDate: formatDateToDDMMYYYY(r.event_date),
        worksite: (r.new_site || r.prev_site)?.trim() || null,
        department: r.new_dept?.trim() || null,
        position: r.new_pos?.trim() || null,
        citizenship: null,
        prevSite: r.prev_site?.trim() || null,
        newSite: r.new_site?.trim() || null,
      };
    });

    return NextResponse.json({
      events,
      total: events.length,
      hasMore,
      from: formatDateToDDMMYYYY(sql.fromIso),
      to: formatDateToDDMMYYYY(sql.toIso),
      filters: options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/chronology]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
