'use client';

import TicketsDashboard from '@/components/TicketsDashboard';

export default function TicketsPanel() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Билеты и рейсы</h2>
        <p className="text-sm text-muted-foreground">
          Реестры билетов (fact_ticket_finance) и календари прилёт-вылет (fact_flights)
        </p>
      </div>
      <TicketsDashboard />
    </div>
  );
}
