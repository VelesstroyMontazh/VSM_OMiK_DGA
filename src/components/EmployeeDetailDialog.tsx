"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EmployeeProfile } from "@/lib/employee-profile";

interface EmployeeDetailDialogProps {
  tabNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVENT_LABELS: Record<string, string> = {
  hire: "Приём",
  transfer: "Перевод",
  terminate: "Увольнение",
};

export default function EmployeeDetailDialog({
  tabNumber,
  open,
  onOpenChange,
}: EmployeeDetailDialogProps) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tab: string) => {
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const res = await fetch(
        `/api/dashboard/employees/${encodeURIComponent(tab)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as EmployeeProfile & { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setProfile(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tabNumber) {
      void load(tabNumber);
    }
  }, [open, tabNumber, load]);

  const name =
    profile?.dim?.full_name ??
    profile?.latest_attendance?.position_name ??
    tabNumber ??
    "Сотрудник";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <User className="h-5 w-5 shrink-0" />
            <span>{name}</span>
            {tabNumber && (
              <Badge variant="secondary" className="font-mono text-xs">
                {tabNumber}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Загрузка профиля…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && profile && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard
                icon={Briefcase}
                label="Должность"
                value={profile.dim?.position ?? profile.latest_attendance?.position_name}
              />
              <InfoCard
                icon={MapPin}
                label="Площадка"
                value={profile.latest_attendance?.worksite_name}
              />
              <InfoCard
                icon={Calendar}
                label="Дата явки"
                value={profile.latest_attendance?.report_date}
              />
              <InfoCard
                icon={User}
                label="Статус"
                value={profile.dim?.status}
              />
            </div>

            <Tabs defaultValue="hr">
              <TabsList className="mb-3 flex h-auto flex-wrap">
                <TabsTrigger value="hr">HR ({profile.hr_events.length})</TabsTrigger>
                <TabsTrigger value="kpi">KPI ({profile.kpi_records.length})</TabsTrigger>
                <TabsTrigger value="tickets">Билеты ({profile.tickets.length})</TabsTrigger>
                <TabsTrigger value="flights">Рейсы ({profile.flights.length})</TabsTrigger>
                <TabsTrigger value="visa">Визы ({profile.visas.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="hr">
                {profile.hr_events.length === 0 ? (
                  <EmptyTab text="Нет кадровых событий" />
                ) : (
                  <DataTable
                    headers={["Дата", "Тип", "Было", "Стало"]}
                    rows={profile.hr_events.map((e) => [
                      e.event_date ?? "—",
                      EVENT_LABELS[e.event_type ?? ""] ?? e.event_type ?? "—",
                      [e.prev_site, e.prev_pos].filter(Boolean).join(" / ") || "—",
                      [e.new_site, e.new_pos].filter(Boolean).join(" / ") || "—",
                    ])}
                  />
                )}
              </TabsContent>

              <TabsContent value="kpi">
                {profile.kpi_records.length === 0 ? (
                  <EmptyTab text="Нет оценок KPI" />
                ) : (
                  <DataTable
                    headers={["Оценка", "Площадка", "Должность", "Источник"]}
                    rows={profile.kpi_records.map((k) => [
                      k.final_score != null ? String(k.final_score) : "—",
                      k.worksite_name ?? "—",
                      k.position_name ?? "—",
                      k.source_file?.split(/[/\\]/).pop() ?? "—",
                    ])}
                  />
                )}
              </TabsContent>

              <TabsContent value="tickets">
                {profile.tickets.length === 0 ? (
                  <EmptyTab text="Нет билетов в реестре" />
                ) : (
                  <DataTable
                    headers={["Дата", "Маршрут", "№ билета", "Стоимость", "Причина"]}
                    rows={profile.tickets.map((t) => [
                      t.ticket_issue_date ?? "—",
                      t.route ?? "—",
                      t.ticket_number ?? "—",
                      t.base_ticket_cost != null
                        ? t.base_ticket_cost.toLocaleString("ru-RU")
                        : "—",
                      t.flight_reason ?? "—",
                    ])}
                  />
                )}
              </TabsContent>

              <TabsContent value="flights">
                {profile.flights.length === 0 ? (
                  <EmptyTab text="Нет рейсов П-В" />
                ) : (
                  <DataTable
                    headers={["Вылет", "Прилёт", "Маршрут", "Направление", "Стоимость"]}
                    rows={profile.flights.map((f) => [
                      f.ticket_departure_date ?? "—",
                      f.arrival_date ?? "—",
                      f.route ?? "—",
                      f.direction ?? "—",
                      f.ticket_cost != null ? f.ticket_cost.toLocaleString("ru-RU") : "—",
                    ])}
                  />
                )}
              </TabsContent>

              <TabsContent value="visa">
                {profile.visas.length === 0 ? (
                  <EmptyTab text="Нет данных по визам" />
                ) : (
                  <DataTable
                    headers={["До", "Тип", "Гражданство"]}
                    rows={profile.visas.map((v) => [
                      v.visa_until ?? "—",
                      v.visa_type ?? "—",
                      v.citizenship ?? "—",
                    ])}
                  />
                )}
              </TabsContent>
            </Tabs>

            {profile.dim && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>
                  {profile.dim.organization && `${profile.dim.organization} · `}
                  {profile.dim.department && `${profile.dim.department} · `}
                  {profile.dim.citizenship}
                  {profile.dim.hire_date && ` · приём ${profile.dim.hire_date}`}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium">{value?.trim() || "—"}</p>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Хук для открытия профиля из любой панели */
export function useEmployeeProfileDialog() {
  const [tabNumber, setTabNumber] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const openProfile = useCallback((tab: string) => {
    if (!tab || tab === "—") return;
    setTabNumber(tab);
    setOpen(true);
  }, []);

  const dialog = (
    <EmployeeDetailDialog tabNumber={tabNumber} open={open} onOpenChange={setOpen} />
  );

  return { openProfile, dialog };
}
