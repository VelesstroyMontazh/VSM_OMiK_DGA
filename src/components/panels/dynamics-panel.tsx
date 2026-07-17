'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, ArrowRightLeft, UserMinus } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import HrEventFilters, {
  DEFAULT_HR_FILTERS,
  hrFiltersToQuery,
  type HrFilterState,
} from '@/components/HrEventFilters';
import type { DynamicsPoint } from '@/app/api/dashboard/dynamics/route';

const COLORS = {
  hire: '#22c55e',
  transfer: '#f59e0b',
  fire: '#ef4444',
};

const LABELS: Record<string, string> = {
  hire: 'Нанято',
  transfer: 'Переведено',
  fire: 'Уволено',
};

interface SummaryDef {
  key: 'hire' | 'transfer' | 'fire';
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const SUMMARY_CARDS: SummaryDef[] = [
  { key: 'hire', label: 'Нанято', icon: UserPlus, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  { key: 'transfer', label: 'Переведено', icon: ArrowRightLeft, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { key: 'fire', label: 'Уволено', icon: UserMinus, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
];

function DynTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{LABELS[p.name] ?? p.name}</span>
          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
            {p.value.toLocaleString('ru-RU')}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function DynamicsPanel() {
  const [dynamics, setDynamics] = useState<DynamicsPoint[]>([]);
  const [summary, setSummary] = useState({ hire: 0, transfer: 0, fire: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HrFilterState>(DEFAULT_HR_FILTERS);
  const [applied, setApplied] = useState<HrFilterState>(DEFAULT_HR_FILTERS);
  const [worksites, setWorksites] = useState<string[]>([]);
  const [citizenships, setCitizenships] = useState<string[]>([]);
  const [rangeLabel, setRangeLabel] = useState('');

  const fetchDynamics = useCallback(async (f: HrFilterState) => {
    setLoading(true);
    setError(null);
    try {
      const qs = hrFiltersToQuery(f);
      const res = await fetch(`/api/dashboard/dynamics?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as {
        dynamics?: DynamicsPoint[];
        summary?: { hire: number; transfer: number; fire: number };
        from?: string | null;
        to?: string | null;
        filters?: { worksites?: string[]; citizenships?: string[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDynamics(json.dynamics ?? []);
      setSummary(json.summary ?? { hire: 0, transfer: 0, fire: 0 });
      setWorksites(json.filters?.worksites ?? []);
      setCitizenships(json.filters?.citizenships ?? []);
      const from = json.from ?? '';
      const to = json.to ?? '';
      setRangeLabel(from && to ? `${from} — ${to}` : from || to || '');
    } catch (e) {
      setDynamics([]);
      setSummary({ hire: 0, transfer: 0, fire: 0 });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDynamics(applied);
  }, [applied, fetchDynamics]);

  const fmt = (n: number) => n.toLocaleString('ru-RU');

  return (
    <div className="space-y-4 p-4 md:p-6">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="mt-2 h-4 w-28" />
              </Card>
            ))
          : SUMMARY_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <Card className={`border ${card.bg} p-4`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-3xl font-bold tabular-nums tracking-tight">
                          {fmt(summary[card.key])}
                        </p>
                        <p className={`mt-1 text-sm ${card.color}`}>{card.label}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
                        <Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Кадровая динамика по месяцам
            {rangeLabel && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({rangeLabel})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[350px] w-full rounded-md" />
          ) : error ? (
            <p className="py-16 text-center text-sm text-destructive">{error}</p>
          ) : dynamics.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center text-muted-foreground">
              Нет данных за выбранный период
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={dynamics} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<DynTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  formatter={(value: string) => LABELS[value] ?? value}
                />
                <Area
                  type="monotone"
                  dataKey="hire"
                  name="hire"
                  stackId="1"
                  stroke={COLORS.hire}
                  fill={COLORS.hire}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="transfer"
                  name="transfer"
                  stackId="1"
                  stroke={COLORS.transfer}
                  fill={COLORS.transfer}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="fire"
                  name="fire"
                  stackId="1"
                  stroke={COLORS.fire}
                  fill={COLORS.fire}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
