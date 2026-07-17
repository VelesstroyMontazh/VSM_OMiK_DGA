import {
  isValidDDMMYYYY,
  parseDDMMYYYYToISO,
} from "@/lib/formatDate";
import { columnExists, tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export type DatePreset = "month" | "3m" | "6m" | "12m" | "custom";

export interface HrFilterParams {
  worksite: string | null;
  citizenship: string | null;
  preset: DatePreset;
  from: string | null;
  to: string | null;
  excludeItrAup: boolean;
  eventType: string | null;
  limit: number;
}

let indexesEnsured = false;
let optionsCache: { at: number; worksites: string[]; citizenships: string[] } | null =
  null;
const OPTIONS_TTL_MS = 10 * 60 * 1000;

/** One-time indexes so date/site filters don't full-scan 600k+ rows. */
export function ensureHrIndexes(): void {
  if (indexesEnsured) return;
  if (!tableExists("fact_hr_events")) {
    indexesEnsured = true;
    return;
  }
  const db = getDb();
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS "ix_fact_hr_events_event_date"
        ON "fact_hr_events" ("event_date");
      CREATE INDEX IF NOT EXISTS "ix_fact_hr_events_new_site"
        ON "fact_hr_events" ("new_site");
      CREATE INDEX IF NOT EXISTS "ix_fact_hr_events_tab_number"
        ON "fact_hr_events" ("tab_number");
      CREATE INDEX IF NOT EXISTS "ix_fact_hr_events_type_date"
        ON "fact_hr_events" ("event_type", "event_date");
    `);
  } catch (err) {
    // readonly DB: ignore — queries still work, just slower
    console.warn("[hr-filters] ensureHrIndexes skipped:", err);
  }
  indexesEnsured = true;
}

export function parseHrFilters(searchParams: URLSearchParams): HrFilterParams {
  const presetRaw = (searchParams.get("preset") ?? "month").trim() as DatePreset;
  const preset: DatePreset = ["month", "3m", "6m", "12m", "custom"].includes(presetRaw)
    ? presetRaw
    : "month";

  const from = searchParams.get("from")?.trim() || null;
  const to = searchParams.get("to")?.trim() || null;
  if (from && !isValidDDMMYYYY(from)) {
    throw new Error("Некорректный from (DD.MM.YYYY)");
  }
  if (to && !isValidDDMMYYYY(to)) {
    throw new Error("Некорректный to (DD.MM.YYYY)");
  }

  const eventTypeRaw = searchParams.get("eventType")?.trim().toLowerCase() || null;
  const eventType =
    eventTypeRaw && ["hire", "transfer", "terminate", "all"].includes(eventTypeRaw)
      ? eventTypeRaw === "all"
        ? null
        : eventTypeRaw
      : null;

  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") || "100", 10) || 100),
  );

  return {
    worksite: searchParams.get("worksite")?.trim() || null,
    citizenship: searchParams.get("citizenship")?.trim() || null,
    preset,
    from,
    to,
    excludeItrAup:
      searchParams.get("excludeItrAup") === "1" ||
      searchParams.get("excludeItrAup") === "true",
    eventType,
    limit,
  };
}

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonthsIso(iso: string, deltaMonths: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfMonthIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function resolveDateRange(filters: HrFilterParams): {
  fromIso: string | null;
  toIso: string | null;
} {
  if (filters.preset === "custom") {
    return {
      fromIso: filters.from ? parseDDMMYYYYToISO(filters.from) : null,
      toIso: filters.to ? parseDDMMYYYYToISO(filters.to) : null,
    };
  }

  const today = isoToday();
  const toIso = today;

  switch (filters.preset) {
    case "month":
      return { fromIso: startOfMonthIso(today), toIso };
    case "3m":
      return { fromIso: addMonthsIso(today, -3), toIso };
    case "6m":
      return { fromIso: addMonthsIso(today, -6), toIso };
    case "12m":
      return { fromIso: addMonthsIso(today, -12), toIso };
    default: {
      const _exhaustive: never = filters.preset;
      return _exhaustive;
    }
  }
}

export interface HrSqlParts {
  joinSql: string;
  whereSql: string;
  params: (string | number)[];
  fromIso: string | null;
  toIso: string | null;
}

export function buildHrEventSql(filters: HrFilterParams): HrSqlParts {
  const joins: string[] = [];
  const where: string[] = [`e."event_date" IS NOT NULL`];
  const params: (string | number)[] = [];

  const { fromIso, toIso } = resolveDateRange(filters);
  if (fromIso) {
    where.push(`e."event_date" >= ?`);
    params.push(fromIso);
  }
  if (toIso) {
    where.push(`e."event_date" <= ?`);
    params.push(toIso);
  }

  if (filters.worksite) {
    where.push(`e."new_site" = ?`);
    params.push(filters.worksite);
  }

  if (filters.eventType) {
    where.push(`e."event_type" = ?`);
    params.push(filters.eventType);
  }

  const hasDimEmployee = tableExists("dim_employee");
  const hasCitizenship =
    hasDimEmployee && columnExists("dim_employee", "citizenship");

  if (filters.citizenship && hasCitizenship) {
    joins.push(
      `INNER JOIN "dim_employee" dem ON dem."tab_number" = e."tab_number"`,
    );
    where.push(`dem."citizenship" = ?`);
    params.push(filters.citizenship);
  }

  const hasDimPosition = tableExists("dim_position");
  const hasAupCol =
    hasDimPosition && columnExists("dim_position", "aup_itr_rop");

  if (filters.excludeItrAup && hasAupCol) {
    where.push(
      `NOT EXISTS (
         SELECT 1 FROM "dim_position" dp
         WHERE dp."position_name" = e."new_pos"
           AND dp."aup_itr_rop" IN ('ИТР','АУП','итр','ауп','ITR','AUP')
       )`,
    );
  }

  return {
    joinSql: joins.join("\n"),
    whereSql: where.join(" AND "),
    params,
    fromIso,
    toIso,
  };
}

/** Fast filter dropdowns — never full-scan fact_hr_events. */
export function listHrFilterOptions(): {
  worksites: string[];
  citizenships: string[];
} {
  const now = Date.now();
  if (optionsCache && now - optionsCache.at < OPTIONS_TTL_MS) {
    return {
      worksites: optionsCache.worksites,
      citizenships: optionsCache.citizenships,
    };
  }

  const db = getDb();
  let worksites: string[] = [];

  if (tableExists("dim_worksite")) {
    const cols = (
      db.prepare(`PRAGMA table_info("dim_worksite")`).all() as { name: string }[]
    ).map((c) => c.name);
    const nameCol = cols.includes("worksite_name")
      ? "worksite_name"
      : cols.includes("name")
        ? "name"
        : cols[0];
    if (nameCol) {
      worksites = (
        db
          .prepare(
            `
            SELECT DISTINCT "${nameCol}" AS name
            FROM "dim_worksite"
            WHERE "${nameCol}" IS NOT NULL AND TRIM("${nameCol}") != ''
            ORDER BY "${nameCol}" ASC
            LIMIT 300
            `,
          )
          .all() as { name: string }[]
      ).map((r) => r.name);
    }
  }

  // Fallback: recent distinct new_site only (indexed, limited) — not full table UNION
  if (worksites.length === 0 && tableExists("fact_hr_events")) {
    worksites = (
      db
        .prepare(
          `
          SELECT DISTINCT "new_site" AS name
          FROM "fact_hr_events"
          WHERE "event_date" >= date('now', '-12 months')
            AND "new_site" IS NOT NULL AND TRIM("new_site") != ''
          ORDER BY "new_site" ASC
          LIMIT 200
          `,
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
  }

  const citizenships =
    tableExists("dim_employee") && columnExists("dim_employee", "citizenship")
      ? (
          db
            .prepare(
              `
              SELECT "citizenship" AS name
              FROM "dim_employee"
              WHERE "citizenship" IS NOT NULL AND TRIM("citizenship") != ''
              GROUP BY "citizenship"
              ORDER BY COUNT(*) DESC
              LIMIT 80
              `,
            )
            .all() as { name: string }[]
        ).map((r) => r.name)
      : [];

  optionsCache = { at: now, worksites, citizenships };
  return { worksites, citizenships };
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  hire: "прием",
  transfer: "перевод",
  terminate: "увольнение",
};
