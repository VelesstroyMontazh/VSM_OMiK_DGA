'use client';

import { useEffect, useState, useCallback } from 'react';
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

/* ── colours ─────────────────────────────────────────────────── */
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

/* ── types ───────────────────────────────────────────────────── */
interface DynamicsPoint {
  month: string;
  hire: number;
  transfer: number;
  fire: number;
}

interface DynamicsData {
  dynamics: DynamicsPoint[];
}

/* ── summary card ────────────────────────────────────────────── */
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

/* ── tooltip ─────────────────────────────────────────────────── */
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
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">
            {LABELS[p.name] ?? p.name}
          </span>
          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
            {p.value.toLocaleString('ru-RU')}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function DynamicsPanel() {
  const [data, setData] = useState<DynamicsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDynamics = useCallback(async () => {
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
    fetchDynamics();
  }, [fetchDynamics]);

  /* compute totals */
  const totals = {
    hire: data?.dynamics?.reduce((sum, d) => sum + (d.hire ?? 0), 0) ?? 0,
    transfer: data?.dynamics?.reduce((sum, d) => sum + (d.transfer ?? 0), 0) ?? 0,
    fire: data?.dynamics?.reduce((sum, d) => sum + (d.fire ?? 0), 0) ?? 0,
  };

  const fmt = (n: number) => n.toLocaleString('ru-RU');

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                </Card>
              ))
            : SUMMARY_CARDS.map((card, i) => {
                const Icon = card.icon;
                const value = totals[card.key];
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
                            {fmt(value)}
                          </p>
                          <p className={`mt-1 text-sm ${card.color}`}>
                            {card.label}
                          </p>
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

        {/* Stacked area chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Кадровая динамика по месяцам
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[350px] w-full rounded-md" />
            ) : !data?.dynamics?.length ? (
              <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                Нет данных для отображения
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={data.dynamics}
                  margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                >
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
                    name="Нанято"
                    stackId="1"
                    stroke={COLORS.hire}
                    fill={COLORS.hire}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="transfer"
                    name="Переведено"
                    stackId="1"
                    stroke={COLORS.transfer}
                    fill={COLORS.transfer}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="fire"
                    name="Уволено"
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
      </motion.div>
    </div>
  );
}