'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, CalendarCheck, UserPlus, Building2,
  History, TrendingUp, Plane, FileSpreadsheet, Settings, Activity, Star,
  ChevronLeft, ChevronRight, LogOut, Moon, Sun, Leaf, Menu,
  Bell, Clock, Shield, Ticket,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAppStore, type TabId } from '@/store/use-app-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

// Dynamic panel imports
import dynamic from 'next/dynamic';
const OverviewPanel = dynamic(() => import('@/components/panels/overview-panel'), { ssr: false });
const EmployeesPanel = dynamic(() => import('@/components/panels/employees-panel'), { ssr: false });
const TodayPanel = dynamic(() => import('@/components/panels/today-panel'), { ssr: false });
const FilesPanel = dynamic(() => import('@/components/panels/files-panel'), { ssr: false });
const DynamicsPanel = dynamic(() => import('@/components/panels/dynamics-panel'), { ssr: false });
const ChronologyPanel = dynamic(() => import('@/components/panels/chronology-panel'), { ssr: false });
const HrMovementPanel = dynamic(() => import('@/components/panels/hr-movement-panel'), { ssr: false });
const KpiPanel = dynamic(() => import('@/components/panels/kpi-panel'), { ssr: false });
const TicketsPanel = dynamic(() => import('@/components/panels/tickets-panel'), { ssr: false });
const AdminPanel = dynamic(() => import('@/components/panels/admin-panel'), { ssr: false });

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  group: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard, group: 'Аналитика' },
  { id: 'employees', label: 'Сотрудники', icon: Users, group: 'Аналитика' },
  { id: 'today', label: 'На сегодня', icon: CalendarCheck, group: 'Аналитика' },
  { id: 'candidates', label: 'Кандидаты', icon: UserPlus, group: 'Аналитика' },
  { id: 'sites', label: 'Площадки', icon: Building2, group: 'Аналитика' },
  { id: 'chronology', label: 'Хронология', icon: History, group: 'Данные' },
  { id: 'dynamics', label: 'Динамика', icon: TrendingUp, group: 'Данные' },
  { id: 'hr-movement', label: 'HR Движение', icon: Activity, group: 'Данные' },
  { id: 'kpi', label: 'KPI / Оценки', icon: Star, group: 'Данные' },
  { id: 'tickets', label: 'Билеты', icon: Ticket, group: 'Данные' },
  { id: 'migration', label: 'Миграция', icon: Plane, group: 'Данные' },
  { id: 'files', label: 'Файлы данных', icon: FileSpreadsheet, group: 'Система' },
  { id: 'admin', label: 'Админка', icon: Shield, group: 'Система' },
  { id: 'settings', label: 'Настройки', icon: Settings, group: 'Система' },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function ThemeIcon({ theme }: { theme: string | undefined }) {
  if (theme === 'dark') return <Moon className="h-4 w-4" />;
  if (theme === 'green') return <Leaf className="h-4 w-4" />;
  return <Sun className="h-4 w-4" />;
}

export default function DashboardPage() {
  const { activeTab, sidebarOpen, setActiveTab, setSidebarOpen, dbLoaded, dbRows, setDbLoaded } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState('');
  const [greeting, setGreeting] = useState('');
  const [mounted, setMounted] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'loaded' | 'empty'>('loading');

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const h = new Date().getHours();
    setGreeting(h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер');
    const tick = () => setCurrentTime(new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check DB status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/main-db/status');
        const data = await res.json();
        if (data.loaded) {
          setDbLoaded(true, data.rows);
          setDbStatus('loaded');
        } else {
          setDbStatus('empty');
        }
      } catch { setDbStatus('empty'); }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [setDbLoaded]);

  const cycleTheme = useCallback(() => {
    const themes = ['light', 'dark', 'green'];
    const idx = themes.indexOf(theme || 'light');
    setTheme(themes[(idx + 1) % themes.length]);
  }, [theme, setTheme]);

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPanel />;
      case 'employees': return <EmployeesPanel />;
      case 'today': return <TodayPanel />;
      case 'files': return <FilesPanel />;
      case 'dynamics': return <DynamicsPanel />;
      case 'chronology': return <ChronologyPanel />;
      case 'hr-movement': return <HrMovementPanel />;
      case 'kpi': return <KpiPanel />;
      case 'tickets': return <TicketsPanel />;
      case 'admin': return <AdminPanel />;
      case 'candidates':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><UserPlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /></div>
              <div><h2 className="text-2xl font-bold">Кандидаты</h2><p className="text-sm text-muted-foreground">Аналитика по ожиданию оформления</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {['Ожидают оформления', 'Дни до приёма', 'Общая статистика'].map((title, i) => (
                <Card key={i} title={title} icon={<UserPlus className="h-8 w-8 text-emerald-500" />} value="—" />
              ))}
            </div>
            <div className="rounded-xl border border-dashed p-12 text-center">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Загрузите «Ежедневный учёт» для анализа кандидатов</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Данные появятся после импорта на вкладке «Файлы данных»</p>
            </div>
          </motion.div>
        );
      case 'sites':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30"><Building2 className="h-6 w-6 text-teal-600 dark:text-teal-400" /></div>
              <div><h2 className="text-2xl font-bold">Площадки</h2><p className="text-sm text-muted-foreground">Статистика по объектам и регионам</p></div>
            </div>
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Загрузите справочник «Площадки_Регион»</p>
            </div>
          </motion.div>
        );
      case 'migration':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30"><Plane className="h-6 w-6 text-sky-600 dark:text-sky-400" /></div>
              <div><h2 className="text-2xl font-bold">Миграция и визы</h2><p className="text-sm text-muted-foreground">Визовый контроль и риски</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: 'Действующих виз', value: '—', sub: 'загрузите ежедневный учёт', color: 'text-sky-600' },
                { title: 'Истекающих виз', value: '—', sub: 'ближайшие 30 дней', color: 'text-amber-600' },
                { title: 'Риск невъезда', value: '—', sub: 'просроченные документы', color: 'text-red-600' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground mb-1">{item.title}</p>
                  <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{item.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"><Settings className="h-6 w-6 text-gray-600 dark:text-gray-400" /></div>
              <div><h2 className="text-2xl font-bold">Настройки</h2><p className="text-sm text-muted-foreground">Управление системой</p></div>
            </div>
            <div className="grid gap-6 max-w-2xl">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <h3 className="font-semibold text-lg">Тема оформления</h3>
                <div className="flex gap-3">
                  {[
                    { id: 'light', label: 'Светлая', icon: Sun, cls: 'bg-white border-gray-300' },
                    { id: 'dark', label: 'Тёмная', icon: Moon, cls: 'bg-gray-900 border-gray-700' },
                    { id: 'green', label: 'Зелёная', icon: Leaf, cls: 'bg-emerald-900 border-emerald-700' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTheme(t.id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${theme === t.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/20'} ${t.cls}`}>
                      <t.icon className="h-4 w-4 text-foreground" />
                      <span className="text-sm font-medium text-foreground">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <h3 className="font-semibold text-lg">Статус базы данных</h3>
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${dbStatus === 'loaded' ? 'bg-emerald-500' : dbStatus === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-sm">
                    {dbStatus === 'loaded' ? `Загружена: ${dbRows.toLocaleString('ru-RU')} записей` : dbStatus === 'loading' ? 'Проверка...' : 'Не загружена'}
                  </span>
                </div>
                {dbStatus === 'empty' && (
                  <p className="text-xs text-muted-foreground">Загрузите базу 1С на вкладке «Файлы данных» → категория «БАЗА (1С)»</p>
                )}
              </div>
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <h3 className="font-semibold text-lg">О системе</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>VSM ОМиК — Аналитический дашборд v1.0</p>
                  <p>Отдел мобилизации и координации персонала</p>
                  <p>ООО «ВелесстройМонтаж»</p>
                  <p className="text-xs pt-2">Next.js 16 · React 19 · Prisma · SQLite · Tailwind CSS 4 · shadcn/ui</p>
                </div>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  // Group navigation items
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 260 : 64 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex flex-col border-r bg-card overflow-hidden shrink-0 z-30"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-600 text-white font-bold text-sm shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
                  <p className="font-bold text-sm">VSM ОМиК</p>
                  <p className="text-[10px] text-muted-foreground -mt-0.5">ВелесстройМонтаж</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-4">
                {sidebarOpen && <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{group}</p>}
                {items.map(item => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all mb-0.5 group relative
                            ${isActive
                              ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                          {isActive && <motion.div layoutId="activeTab" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-emerald-600" />}
                          <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground group-hover:text-foreground'}`} />
                          {sidebarOpen && <span className="truncate">{item.label}</span>}
                          {item.badge && sidebarOpen && <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{item.badge}</Badge>}
                        </button>
                      </TooltipTrigger>
                      {!sidebarOpen && <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>}
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Toggle */}
          <div className="border-t p-2 shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {sidebarOpen ? <><ChevronLeft className="h-4 w-4" /><span>Свернуть</span></> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </motion.aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg hover:bg-muted">
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{mounted ? greeting : ''}, <span className="text-emerald-600 dark:text-emerald-400">Администратор</span></p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {mounted ? currentTime : '...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dbLoaded && (
                <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  БД: {dbRows.toLocaleString('ru-RU')}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={cycleTheme} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Сменить тему">
                    {mounted && <ThemeIcon theme={theme} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Тема: {theme === 'dark' ? 'Тёмная' : theme === 'green' ? 'Зелёная' : 'Светлая'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
                    <Bell className="h-4.5 w-4.5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Уведомления</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-emerald-600 text-white text-xs font-bold">АД</AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">Админ</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderPanel()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className="h-8 border-t bg-card/50 flex items-center justify-between px-4 text-[11px] text-muted-foreground/60 shrink-0">
            <span>VSM ОМиК v1.0 — ООО «ВелесстройМонтаж»</span>
            <span className="hidden sm:inline">Отдел мобилизации и координации персонала</span>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Helper card component for placeholder panels
function Card({ title, icon, value }: { title: string; icon: React.ReactNode; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
