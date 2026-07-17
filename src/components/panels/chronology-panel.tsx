'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowRightLeft, UserMinus, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HrEventFilters, {
  DEFAULT_HR_FILTERS,
  hrFiltersToQuery,
  type HrFilterState,
} from '@/components/HrEventFilters';
import { useEmployeeProfileDialog } from '@/components/EmployeeDetailDialog';
import type { ChronologyEvent } from '@/app/api/dashboard/chronology/route';

type FilterTab = 'all' | 'прием' | 'перевод' | 'увольнение';

const EVENT_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    ring: string;
    badge: string;
  }
> = {
  прием: {
    label: 'Приём',
    icon: UserPlus,
    color: 'text-green-700',
    bg: 'bg-green-100',
    ring: 'ring-green-300',
    badge: 'bg-green-100 text-green-800 border-green-200',
  },
  перевод: {
    label: 'Перевод',
    icon: ArrowRightLeft,
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    ring: 'ring-amber-300',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  увольнение: {
    label: 'Увольнение',
    icon: UserMinus,
    color: 'text-red-700',
    bg: 'bg-red-100',
    ring: 'ring-red-300',
    badge: 'bg-red-100 text-red-800 border-red-200',
  },
};

const DEFAULT_EVENT_CONFIG = {
  label: 'Событие',
  icon: Calendar,
  color: 'text-gray-700',
  bg: 'bg-gray-100',
  ring: 'ring-gray-300',
  badge: 'bg-gray-100 text-gray-800 border-gray-200',
};

function getEventConfig(type: string) {
  const normalized = type.toLowerCase().trim();
  for (const [key, cfg] of Object.entries(EVENT_CONFIG)) {
    if (normalized === key || normalized.includes(key)) return cfg;
  }
  return DEFAULT_EVENT_CONFIG;
}

function eventTypeParam(tab: FilterTab): string | null {
  if (tab === 'прием') return 'hire';
  if (tab === 'перевод') return 'transfer';
  if (tab === 'увольнение') return 'terminate';
  return null;
}

export default function ChronologyPanel() {
  const { openProfile, dialog } = useEmployeeProfileDialog();
  const [events, setEvents] = useState<ChronologyEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [filters, setFilters] = useState<HrFilterState>(DEFAULT_HR_FILTERS);
  const [applied, setApplied] = useState<HrFilterState>(DEFAULT_HR_FILTERS);
  const [worksites, setWorksites] = useState<string[]>([]);
  const [citizenships, setCitizenships] = useState<string[]>([]);
  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);

  const fetchEvents = useCallback(async (f: HrFilterState, tab: FilterTab) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams(hrFiltersToQuery(f));
      const et = eventTypeParam(tab);
      if (et) qs.set('eventType', et);
      qs.set('limit', '100');
      const res = await fetch(`/api/dashboard/chronology?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as {
        events?: ChronologyEvent[];
        total?: number;
        hasMore?: boolean;
        from?: string | null;
        to?: string | null;
        filters?: { worksites?: string[]; citizenships?: string[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setEvents(json.events ?? []);
      setTotal(json.total ?? 0);
      setHasMore(Boolean(json.hasMore));
      setWorksites(json.filters?.worksites ?? []);
      setCitizenships(json.filters?.citizenships ?? []);
      const from = json.from ?? '';
      const to = json.to ?? '';
      setRangeLabel(from && to ? `${from} — ${to}` : from || to || '');
    } catch (e) {
      setEvents([]);
      setTotal(0);
      setHasMore(false);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents(applied, activeTab);
  }, [applied, activeTab, fetchEvents]);

  const titleCount = useMemo(() => {
    const shown = events.length.toLocaleString('ru-RU');
    return hasMore ? `${shown}+` : shown;
  }, [events.length, hasMore]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      {dialog}
      <HrEventFilters
        value={filters}
        onChange={setFilters}
        worksites={worksites}
        citizenships={citizenships}
        loading={loading}
        onApply={() => setApplied({ ...filters })}
        onReset={() => {
          setFilters({ ...DEFAULT_HR_FILTERS });
          setApplied({ ...DEFAULT_HR_FILTERS });
        }}
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold">
              Хронология кадровых событий
              {!loading && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({titleCount}
                  {rangeLabel ? ` · ${rangeLabel}` : ''})
                </span>
              )}
            </CardTitle>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="px-3 text-xs">Все</TabsTrigger>
                <TabsTrigger value="прием" className="px-3 text-xs">Приём</TabsTrigger>
                <TabsTrigger value="перевод" className="px-3 text-xs">Перевод</TabsTrigger>
                <TabsTrigger value="увольнение" className="px-3 text-xs">Увольнение</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Calendar className="h-10 w-10" />
              <p className="text-sm">Нет кадровых событий за выбранный период</p>
            </div>
          ) : (
            <div className="relative max-h-[600px] overflow-y-auto pl-1">
              <div className="absolute bottom-2 left-[19px] top-2 w-px bg-border" />
              <AnimatePresence mode="popLayout">
                {events.map((event, idx) => {
                  const cfg = getEventConfig(event.eventType);
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15, delay: idx > 30 ? 0 : idx * 0.01 }}
                      className="relative flex gap-4 pb-4 last:pb-0"
                    >
                      <div
                        className={`relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.bg} ring-2 ${cfg.ring}`}
                      >
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30"
                        onClick={() => openProfile(event.tabNumber)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium leading-tight">
                            {event.fullName}
                          </span>
                          <Badge variant="outline" className={cfg.badge}>
                            {cfg.label}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {event.tabNumber}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {event.eventDate && <span>{event.eventDate}</span>}
                          {event.worksite && <span>{event.worksite}</span>}
                          {event.position && <span>{event.position}</span>}
                          {event.citizenship && <span>{event.citizenship}</span>}
                          {event.prevSite && event.newSite && event.prevSite !== event.newSite && (
                            <span className="italic">
                              {event.prevSite} → {event.newSite}
                            </span>
                          )}
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
