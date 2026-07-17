"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plane, Search, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { TicketRow, TicketsResponse } from "@/app/api/dashboard/tickets/route";
import type { FlightRow, FlightsResponse } from "@/app/api/dashboard/flights/route";
import { useEmployeeProfileDialog } from "@/components/EmployeeDetailDialog";

export default function TicketsDashboard() {
  const { openProfile, dialog } = useEmployeeProfileDialog();
  const [search, setSearch] = useState("");
  const [ticketPage, setTicketPage] = useState(1);
  const [flightPage, setFlightPage] = useState(1);
  const [tickets, setTickets] = useState<TicketsResponse | null>(null);
  const [flights, setFlights] = useState<FlightsResponse | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingFlights, setLoadingFlights] = useState(true);

  const loadTickets = useCallback(async (page: number, q: string) => {
    setLoadingTickets(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
        search: q,
      });
      const res = await fetch(`/api/dashboard/tickets?${params}`, { cache: "no-store" });
      const json = (await res.json()) as TicketsResponse & { error?: string };
      if (!res.ok) throw new Error(json.error);
      setTickets(json);
    } catch {
      setTickets(null);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const loadFlights = useCallback(async (page: number, q: string) => {
    setLoadingFlights(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
        search: q,
      });
      const res = await fetch(`/api/dashboard/flights?${params}`, { cache: "no-store" });
      const json = (await res.json()) as FlightsResponse & { error?: string };
      if (!res.ok) throw new Error(json.error);
      setFlights(json);
    } catch {
      setFlights(null);
    } finally {
      setLoadingFlights(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadTickets(ticketPage, search);
      void loadFlights(flightPage, search);
    }, 0);
    return () => clearTimeout(t);
  }, [ticketPage, flightPage, search, loadTickets, loadFlights]);

  const applySearch = () => {
    setTicketPage(1);
    setFlightPage(1);
    void loadTickets(1, search);
    void loadFlights(1, search);
  };

  const fmtMoney = (n: number) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {dialog}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Ticket className="h-4 w-4" />
              Билетов (фильтр)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {(tickets?.summary.total_tickets ?? 0).toLocaleString("ru-RU")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Сумма билетов</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {fmtMoney(tickets?.summary.total_cost ?? 0)} ₽
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Средняя стоимость</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {fmtMoney(tickets?.summary.avg_cost ?? 0)} ₽
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-search">Поиск (ФИО / таб. № / маршрут)</Label>
            <div className="flex gap-2">
              <Input
                id="ticket-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                className="w-[280px]"
              />
              <Button type="button" variant="outline" onClick={applySearch}>
                <Search className="mr-1.5 h-4 w-4" />
                Найти
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="finance">
        <TabsList>
          <TabsTrigger value="finance">Реестр билетов</TabsTrigger>
          <TabsTrigger value="flights">Календарь П-В</TabsTrigger>
        </TabsList>

        <TabsContent value="finance" className="mt-4">
          {loadingTickets ? (
            <LoaderRow />
          ) : (
            <TicketTable
              rows={tickets?.data ?? []}
              onRowClick={(tab) => openProfile(tab)}
            />
          )}
          <Pager
            page={ticketPage}
            total={tickets?.total ?? 0}
            limit={tickets?.limit ?? 30}
            onPage={setTicketPage}
          />
        </TabsContent>

        <TabsContent value="flights" className="mt-4">
          {loadingFlights ? (
            <LoaderRow />
          ) : (
            <FlightTable
              rows={flights?.data ?? []}
              onRowClick={(tab) => openProfile(tab)}
            />
          )}
          <Pager
            page={flightPage}
            total={flights?.total ?? 0}
            limit={flights?.limit ?? 30}
            onPage={setFlightPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoaderRow() {
  return (
    <div className="flex items-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      Загрузка…
    </div>
  );
}

function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Стр. {page} / {pages} · всего {total.toLocaleString("ru-RU")}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Назад
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}

function TicketTable({
  rows,
  onRowClick,
}: {
  rows: TicketRow[];
  onRowClick: (tab: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Нет данных</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-3 py-2">Дата</th>
            <th className="px-3 py-2">ФИО</th>
            <th className="px-3 py-2">Таб. №</th>
            <th className="px-3 py-2">Маршрут</th>
            <th className="px-3 py-2 text-right">Стоимость</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.tab_number}-${i}`}
              className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
              onClick={() => onRowClick(r.tab_number)}
            >
              <td className="px-3 py-2">{r.ticket_issue_date ?? "—"}</td>
              <td className="px-3 py-2">{r.full_name ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.tab_number}</td>
              <td className="px-3 py-2">{r.route ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.base_ticket_cost.toLocaleString("ru-RU")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightTable({
  rows,
  onRowClick,
}: {
  rows: FlightRow[];
  onRowClick: (tab: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Нет данных</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-3 py-2">Вылет</th>
            <th className="px-3 py-2">ФИО</th>
            <th className="px-3 py-2">Таб. №</th>
            <th className="px-3 py-2">Маршрут</th>
            <th className="px-3 py-2 text-right">Стоимость</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.tab_number}-${i}`}
              className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
              onClick={() => onRowClick(r.tab_number)}
            >
              <td className="px-3 py-2">{r.ticket_departure_date ?? "—"}</td>
              <td className="px-3 py-2">{r.full_name ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.tab_number}</td>
              <td className="px-3 py-2">{r.route ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.ticket_cost.toLocaleString("ru-RU")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
