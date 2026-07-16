'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MapPin, LogOut, PlaneTakeoff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* ── types ───────────────────────────────────────────────────── */
interface DailyRecord {
  tabNumber: string;
  fullName: string;
  site: string;
  status: string;
}

interface TodayData {
  onSite: number;
  offSite: number;
  onVacation: number;
  dailyTotal: number;
  dailyRecordsList: DailyRecord[];
}

/* ── stat card definition ────────────────────────────────────── */
interface StatDef {
  key: keyof Pick<TodayData, 'onSite' | 'offSite' | 'onVacation'>;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const STAT_CARDS: StatDef[] = [
  {
    key: 'onSite',
    label: 'На площадке',
    icon: MapPin,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    key: 'offSite',
    label: 'Вне площадки',
    icon: LogOut,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    key: 'onVacation',
    label: 'В отпуске / командировке',
    icon: PlaneTakeoff,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
];

/* ── status badge map ─────────────────────────────────────────── */
function getStatusStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes('площадк')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s.includes('отпуск') || s.includes('командировк')) return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

/* ── skeleton ────────────────────────────────────────────────── */
function StatSkeleton() {
  return (
    <Card className={`p-4`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </Card>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function TodayPanel() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
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
    fetchToday();
  }, [fetchToday]);

  const fmt = (n: number) => n.toLocaleString('ru-RU');

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
            : STAT_CARDS.map((stat, i) => {
                const Icon = stat.icon;
                const value = data?.[stat.key] ?? 0;
                return (
                  <motion.div
                    key={stat.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                  >
                    <Card className={`border ${stat.border} ${stat.bg} p-4`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-3xl font-bold tabular-nums tracking-tight">
                            {fmt(value)}
                          </p>
                          <p className={`mt-1 text-sm ${stat.color}`}>{stat.label}</p>
                        </div>
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80 ${stat.color}`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
        </div>

        {/* Daily records table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Список на сегодня
              {!loading && data && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({data.dailyTotal.toLocaleString('ru-RU')} записей)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data || data.dailyRecordsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <MapPin className="h-10 w-10" />
                <p className="text-sm">Нет данных на сегодня</p>
              </div>
            ) : (
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Таб. №
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        ФИО
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Площадка
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyRecordsList.map((rec, idx) => (
                      <tr
                        key={`${rec.tabNumber}-${idx}`}
                        className="border-b transition-colors hover:bg-muted/40 even:bg-muted/20"
                      >
                        <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-muted-foreground">
                          {rec.tabNumber}
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-2 text-xs font-medium">
                          {rec.fullName || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                          {rec.site || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <Badge
                            variant="outline"
                            className={getStatusStyle(rec.status)}
                          >
                            {rec.status || '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}