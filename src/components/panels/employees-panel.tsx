'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { useEmployeeProfileDialog } from '@/components/EmployeeDetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/* ── types ───────────────────────────────────────────────────── */
interface EmployeeRecord {
  [key: string]: unknown;
}

interface EmployeesResponse {
  employees: EmployeeRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  columns: string[];
}

/* ── display columns to show first ───────────────────────────── */
const PRIORITY_COLS = [
  'Табельный номер',
  'ФИО',
  'Площадка',
  'Должность',
  'Подразделение',
  'Гражданство',
  'Статус',
  'Таб. номер',
  'ФИО Полностью',
];

function extractTabNumber(emp: EmployeeRecord): string | null {
  for (const key of Object.keys(emp)) {
    if (/таб/i.test(key) && emp[key]) {
      const value = String(emp[key]).trim();
      if (value && value !== '—') return value;
    }
  }
  return null;
}

function getDisplayColumns(columns: string[], max: number = 10) {
  const priority = columns.filter((c) =>
    PRIORITY_COLS.some((p) => c.toLowerCase().includes(p.toLowerCase()))
  );
  const rest = columns.filter(
    (c) => !PRIORITY_COLS.some((p) => c.toLowerCase().includes(p.toLowerCase()))
  );
  const ordered = [...priority, ...rest];
  return ordered.slice(0, max);
}

/* ── skeleton rows ───────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function EmployeesPanel() {
  const { openProfile, dialog } = useEmployeeProfileDialog();
  const [data, setData] = useState<EmployeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 50;

  const fetchEmployees = useCallback(
    async (p: number, q: string) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(pageSize),
          search: q,
        });
        const res = await fetch(`/api/employees?${params}`);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  /* initial load */
  useEffect(() => {
    fetchEmployees(1, '');
  }, [fetchEmployees]);

  /* debounced search */
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchEmployees(1, value);
    }, 350);
  };

  const goPage = (p: number) => {
    setPage(p);
    fetchEmployees(p, search);
  };

  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;
  const columns = getDisplayColumns(data?.columns ?? []);
  const employees = data?.employees ?? [];
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {dialog}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Search bar */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по всем полям..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Список сотрудников
              </CardTitle>
              {!loading && data && (
                <span className="text-sm text-muted-foreground">
                  Показано {rangeStart}–{rangeEnd} из {total.toLocaleString('ru-RU')} записей
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4">
                <TableSkeleton />
              </div>
            ) : !data || employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Database className="h-12 w-12" />
                <p className="text-sm font-medium">База данных не загружена</p>
                <p className="text-xs">
                  Загрузите файл базы сотрудников для начала работы
                </p>
              </div>
            ) : (
              <>
                <div className="max-h-[520px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                          №
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, rowIdx) => {
                        const tab = extractTabNumber(emp);
                        return (
                        <tr
                          key={rowIdx}
                          className={`border-b transition-colors even:bg-muted/20 ${tab ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                          onClick={() => tab && openProfile(tab)}
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground tabular-nums">
                            {rangeStart + rowIdx}
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="max-w-[200px] truncate px-3 py-2 text-xs"
                              title={String(emp[col] ?? '')}
                            >
                              {String(emp[col] ?? '—')}
                            </td>
                          ))}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      Страница {page} из {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => goPage(page - 1)}
                        className="h-8 gap-1 px-3"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Назад
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => goPage(page + 1)}
                        className="h-8 gap-1 px-3"
                      >
                        Далее
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
