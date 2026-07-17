import { formatDateToDDMMYYYY } from "@/lib/formatDate";
import { columnExists, tableExists } from "@/lib/dashboard-db";
import { getDb } from "@/lib/sqlite";

export interface EmployeeDim {
  tab_number: string;
  full_name: string | null;
  position: string | null;
  department: string | null;
  citizenship: string | null;
  status: string | null;
  hire_date: string | null;
  termination_date: string | null;
  organization: string | null;
  mobile_phone: string | null;
  employee_uid: string | null;
}

export interface EmployeeAttendance {
  worksite_name: string | null;
  report_date: string | null;
  position_name: string | null;
  visa_until: string | null;
  citizenship: string | null;
}

export interface EmployeeHrEvent {
  event_date: string | null;
  event_type: string | null;
  prev_site: string | null;
  new_site: string | null;
  prev_pos: string | null;
  new_pos: string | null;
  company: string | null;
}

export interface EmployeeKpiRecord {
  final_score: number | null;
  worksite_name: string | null;
  position_name: string | null;
  source_file: string | null;
}

export interface EmployeeTicket {
  ticket_issue_date: string | null;
  route: string | null;
  ticket_number: string | null;
  carrier: string | null;
  base_ticket_cost: number | null;
  ticket_amount_agency_fee: number | null;
  flight_reason: string | null;
}

export interface EmployeeFlight {
  ticket_departure_date: string | null;
  arrival_date: string | null;
  route: string | null;
  direction: string | null;
  ticket_cost: number | null;
  transport_type: string | null;
  travel_reason: string | null;
}

export interface EmployeeVisa {
  visa_until: string | null;
  visa_type: string | null;
  citizenship: string | null;
}

export interface EmployeeProfile {
  tab_number: string;
  employee_uid: string | null;
  dim: EmployeeDim | null;
  latest_attendance: EmployeeAttendance | null;
  hr_events: EmployeeHrEvent[];
  kpi_records: EmployeeKpiRecord[];
  tickets: EmployeeTicket[];
  flights: EmployeeFlight[];
  visas: EmployeeVisa[];
}

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return formatDateToDDMMYYYY(value) ?? value;
}

function tabWhereClause(table: string): string {
  if (columnExists(table, "employee_uid")) {
    return `("tab_number" = ? OR "employee_uid" = ?)`;
  }
  return `"tab_number" = ?`;
}

function tabParams(
  tabNumber: string,
  employeeUid: string | null,
  table: string,
): string[] {
  if (columnExists(table, "employee_uid")) {
    return [tabNumber, employeeUid ?? tabNumber];
  }
  return [tabNumber];
}

export function fetchEmployeeProfile(tabNumber: string): EmployeeProfile | null {
  const db = getDb();
  const trimmed = tabNumber.trim();
  if (!trimmed) return null;

  let employeeUid: string | null = null;

  let dim: EmployeeDim | null = null;
  if (tableExists("dim_employee")) {
    const row = db
      .prepare(
        `SELECT "tab_number", "full_name", "position", "department", "citizenship",
                "status", "hire_date", "termination_date", "organization",
                "mobile_phone", "employee_uid"
         FROM "dim_employee"
         WHERE "tab_number" = ? OR "employee_uid" = ?
         LIMIT 1`,
      )
      .get(trimmed, trimmed) as EmployeeDim | undefined;
    if (row) {
      dim = {
        ...row,
        hire_date: fmtDate(row.hire_date),
        termination_date: fmtDate(row.termination_date),
      };
      employeeUid = row.employee_uid ?? null;
    }
  }

  const lookup = tabParams(trimmed, employeeUid, "fact_daily_attendance");

  let latest_attendance: EmployeeAttendance | null = null;
  if (tableExists("fact_daily_attendance")) {
    const att = db
      .prepare(
        `SELECT "worksite_name", "report_date", "position_name", "visa_until", "citizenship"
         FROM "fact_daily_attendance"
         WHERE ${tabWhereClause("fact_daily_attendance")}
         ORDER BY "report_date" DESC
         LIMIT 1`,
      )
      .get(...lookup) as EmployeeAttendance | undefined;
    if (att) {
      latest_attendance = {
        ...att,
        report_date: fmtDate(att.report_date),
        visa_until: fmtDate(att.visa_until),
      };
    }
  }

  let hr_events: EmployeeHrEvent[] = [];
  if (tableExists("fact_hr_events")) {
    hr_events = (
      db
        .prepare(
          `SELECT "event_date", "event_type", "prev_site", "new_site",
                  "prev_pos", "new_pos", "company"
           FROM "fact_hr_events"
           WHERE ${tabWhereClause("fact_hr_events")}
           ORDER BY "event_date" DESC
           LIMIT 50`,
        )
        .all(...tabParams(trimmed, employeeUid, "fact_hr_events")) as EmployeeHrEvent[]
    ).map((e) => ({ ...e, event_date: fmtDate(e.event_date) }));
  }

  let kpi_records: EmployeeKpiRecord[] = [];
  if (tableExists("fact_kpi")) {
    kpi_records = db
      .prepare(
        `SELECT ROUND(CAST("final_score" AS REAL), 2) AS final_score,
                "worksite_name", "position_name", "source_file"
         FROM "fact_kpi"
         WHERE ${tabWhereClause("fact_kpi")}
         ORDER BY "final_score" DESC
         LIMIT 20`,
      )
      .all(...tabParams(trimmed, employeeUid, "fact_kpi")) as EmployeeKpiRecord[];
  }

  let tickets: EmployeeTicket[] = [];
  if (tableExists("fact_ticket_finance")) {
    tickets = (
      db
        .prepare(
          `SELECT "ticket_issue_date", "route", "ticket_number", "carrier",
                  "base_ticket_cost", "ticket_amount_agency_fee", "flight_reason"
           FROM "fact_ticket_finance"
           WHERE ${tabWhereClause("fact_ticket_finance")}
           ORDER BY "ticket_issue_date" DESC
           LIMIT 30`,
        )
        .all(...tabParams(trimmed, employeeUid, "fact_ticket_finance")) as EmployeeTicket[]
    ).map((t) => ({ ...t, ticket_issue_date: fmtDate(t.ticket_issue_date) }));
  }

  let flights: EmployeeFlight[] = [];
  if (tableExists("fact_flights")) {
    flights = (
      db
        .prepare(
          `SELECT "ticket_departure_date", "arrival_date", "route", "direction",
                  "ticket_cost", "transport_type", "travel_reason"
           FROM "fact_flights"
           WHERE ${tabWhereClause("fact_flights")}
           ORDER BY "ticket_departure_date" DESC
           LIMIT 30`,
        )
        .all(...tabParams(trimmed, employeeUid, "fact_flights")) as EmployeeFlight[]
    ).map((f) => ({
      ...f,
      ticket_departure_date: fmtDate(f.ticket_departure_date),
      arrival_date: fmtDate(f.arrival_date),
    }));
  }

  let visas: EmployeeVisa[] = [];
  if (tableExists("fact_visa")) {
    visas = (
      db
        .prepare(
          `SELECT "passport_valid_until" AS visa_until,
                  "work_type" AS visa_type,
                  "citizenship"
           FROM "fact_visa"
           WHERE ${tabWhereClause("fact_visa")}
           ORDER BY "passport_valid_until" DESC
           LIMIT 10`,
        )
        .all(...tabParams(trimmed, employeeUid, "fact_visa")) as EmployeeVisa[]
    ).map((v) => ({ ...v, visa_until: fmtDate(v.visa_until) }));
  }

  if (!dim && !latest_attendance && hr_events.length === 0 && kpi_records.length === 0) {
    return null;
  }

  return {
    tab_number: dim?.tab_number ?? trimmed,
    employee_uid: employeeUid,
    dim,
    latest_attendance,
    hr_events,
    kpi_records,
    tickets,
    flights,
    visas,
  };
}
