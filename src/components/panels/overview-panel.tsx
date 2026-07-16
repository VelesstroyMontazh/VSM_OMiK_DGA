'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  MapPin,
  CalendarDays,
  Plane,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/* ── colour palettes ─────────────────────────────────────────── */
const CITIZENSHIP_COLORS = [
  '#059669', '#10b981', '#34d399', '#6ee7b7',
  '#a7f3d0', '#d1fae5', '#ecfdf5', '#f0fdf4',
];

const SITE_COLORS = [
  '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4',
  '#99f6e4', '#ccfbf1', '#f0fdfa', '#f0fdf4',
];

const DYNAMICS_COLORS = {
  hire: '#22c55e',
  transfer: '#f59e0b',
  fire: '#ef4444',
};

/* ── types ───────────────────────────────────────────────────── */
interface OverviewData {
  totalEmployees: number;
  dbLoaded: boolean;
  dbFileName: string;
  dbRows: number;
  onSite: number;
  offSite: number;
  onVacation: number;
  dailyTotal: number;
  citizenship: { name: string; value: number }[];
  sites: { name: string; value: number }[];
  dynamics: { month: string; hire: number; transfer: number; fire: number }[];
  visaRisks: number;
  totalEvents: number;
  totalFlights: number;
  recentFiles: { id: string; name: string; category: string; rows: number; size: number; loadedAt: string }[];
}

/* ── KPI card definition ─────────────────────────────────────── */
interface KpiDef {
  key: keyof Pick<OverviewData, 'totalEmployees' | 'onSite' | 'totalEvents' | 'totalFlights' | 'visaRisks' | 'dbRows'>;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const KPI_CARDS: KpiDef[] = [
  { key: 'totalEmployees', label: 'Всего сотрудников', icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { key: 'onSite', label: 'На площадке', icon: MapPin, color: 'text-teal-700', bg: 'bg-teal-100' },
  { key: 'totalEvents', label: 'Кадровых событий', icon: CalendarDays, color: 'text-amber-700', bg: 'bg-amber-100' },
  { key: 'totalFlights', label: 'Рейсов (П-В)', icon: Plane, color: 'text-sky-700', bg: 'bg-sky-100' },
  { key: 'visaRisks', label: 'Визовые риски', icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-100' },
  { key: 'dbRows', label: 'Загруженных файлов', icon: FileSpreadsheet, color: 'text-purple-700', bg: 'bg-purple-100' },
];

/* ── reusable tooltip ────────────────────────────────────────── */
function SimpleTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
            {p.value.toLocaleString('ru-RU')}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ── KPI card skeleton ───────────────────────────────────────── */
function KpiSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </Card>
  );
}

/* ── chart skeleton ──────────────────────────────────────────── */
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function OverviewPanel() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/overview');
      if (!res.ok) throw new Error('Ошибка загрузки данных');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  /* helpers */
  const fmt = (n: number) => n.toLocaleString('ru-RU');

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* KPI cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
            : KPI_CARDS.map((kpi, i) => {
                const Icon = kpi.icon;
                const value = data?.[kpi.key] ?? 0;
                return (
                  <motion.div
                    key={kpi.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                  >
                    <Card className="p-4 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-3xl font-bold tabular-nums tracking-tight">
                            {fmt(value)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{kpi.label}</p>
                        </div>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${kpi.bg}`}>
                          <Icon className={`h-5 w-5 ${kpi.color}`} />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </motion.div>
      )}

      {/* Two bar charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Citizenship distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Распределение по гражданству
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(data?.citizenship ?? []).slice(0, 8)}
                      margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                      <Bar dataKey="value" name="Сотрудники" radius={[4, 4, 0, 0]}>
                        {(data?.citizenship ?? []).slice(0, 8).map((_, idx) => (
                          <Cell
                            key={`cit-${idx}`}
                            fill={CITIZENSHIP_COLORS[idx % CITIZENSHIP_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sites distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Распределение по площадкам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(data?.sites ?? []).slice(0, 8)}
                      margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                      <Bar dataKey="value" name="Сотрудники" radius={[4, 4, 0, 0]}>
                        {(data?.sites ?? []).slice(0, 8).map((_, idx) => (
                          <Cell
                            key={`site-${idx}`}
                            fill={SITE_COLORS[idx % SITE_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* Dynamics stacked bar chart */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Динамика кадровых событий
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data?.dynamics ?? []}
                  margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    formatter={(value: string) => {
                      const labels: Record<string, string> = {
                        hire: 'Приём',
                        transfer: 'Перевод',
                        fire: 'Увольнение',
                      };
                      return labels[value] ?? value;
                    }}
                  />
                  <Bar
                    dataKey="hire"
                    name="Приём"
                    stackId="dynamics"
                    fill={DYNAMICS_COLORS.hire}
                    radius={undefined}
                  />
                  <Bar
                    dataKey="transfer"
                    name="Перевод"
                    stackId="dynamics"
                    fill={DYNAMICS_COLORS.transfer}
                  />
                  <Bar
                    dataKey="fire"
                    name="Увольнение"
                    stackId="dynamics"
                    fill={DYNAMICS_COLORS.fire}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}