'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowRightLeft, UserMinus, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/* ── types ───────────────────────────────────────────────────── */
interface HrEvent {
  id: string;
  tabNumber: string;
  fullName: string;
  eventType: string;
  eventDate: string;
  department: string;
  position: string;
  basis: string;
}

interface ChronologyData {
  recentEvents: HrEvent[];
}

/* ── event type config ───────────────────────────────────────── */
type EventType = 'прием' | 'перевод' | 'увольнение';

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

/* ── tab filter type ─────────────────────────────────────────── */
type FilterTab = 'all' | 'прием' | 'перевод' | 'увольнение';

/* ── main component ──────────────────────────────────────────── */
export default function ChronologyPanel() {
  const [data, setData] = useState<ChronologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/overview');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* filtered events */
  const filteredEvents = useMemo(() => {
    const events = data?.recentEvents ?? [];
    if (activeTab === 'all') return events;
    return events.filter((e) => {
      const t = e.eventType.toLowerCase().trim();
      if (activeTab === 'прием') return t === 'прием' || t.includes('прием');
      if (activeTab === 'перевод') return t === 'перевод' || t.includes('перевод');
      if (activeTab === 'увольнение') return t === 'увольнение' || t.includes('увольнение');
      return true;
    });
  }, [data, activeTab]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-semibold">
                Хронология кадровых событий
                {!loading && data && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredEvents.length})
                  </span>
                )}
              </CardTitle>

              {/* Filter tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as FilterTab)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="px-3 text-xs">
                    Все
                  </TabsTrigger>
                  <TabsTrigger value="прием" className="px-3 text-xs">
                    Приём
                  </TabsTrigger>
                  <TabsTrigger value="перевод" className="px-3 text-xs">
                    Перевод
                  </TabsTrigger>
                  <TabsTrigger value="увольнение" className="px-3 text-xs">
                    Увольнение
                  </TabsTrigger>
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
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Calendar className="h-10 w-10" />
                <p className="text-sm">Нет кадровых событий</p>
              </div>
            ) : (
              <div className="relative max-h-[600px] overflow-y-auto pl-1">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

                <AnimatePresence mode="popLayout">
                  {filteredEvents.map((event, idx) => {
                    const cfg = getEventConfig(event.eventType);
                    const Icon = cfg.icon;

                    return (
                      <motion.div
                        key={event.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.2, delay: idx > 20 ? 0 : idx * 0.02 }}
                        className="relative flex gap-4 pb-4 last:pb-0"
                      >
                        {/* Icon node on the line */}
                        <div
                          className={`relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.bg} ring-2 ${cfg.ring}`}
                        >
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium leading-tight">
                              {event.fullName || '—'}
                            </span>
                            <Badge
                              variant="outline"
                              className={cfg.badge}
                            >
                              {cfg.label}
                            </Badge>
                          </div>

                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            {event.eventDate && (
                              <span>{event.eventDate}</span>
                            )}
                            {event.department && (
                              <span>{event.department}</span>
                            )}
                            {event.position && (
                              <span>{event.position}</span>
                            )}
                            {event.basis && (
                              <span className="italic">({event.basis})</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}