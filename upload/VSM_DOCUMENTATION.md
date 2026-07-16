# VSM ОМиК — Полная документация системы

> **Версия:** 1.0
> **Организация:** ООО «ВелесстройМонтаж» — Отдел мобилизации и координации персонала (ОМиК)
> **Репозиторий:** https://github.com/VelesstroyMontazh/VSM_OMIK_2

---

## Содержание

1. [Общее описание системы](#1-общее-описание-системы)
2. [Архитектура и технологический стек](#2-архитектура-и-технологический-стек)
3. [Структура проекта](#3-структура-проекта)
4. [База данных (Prisma/SQLite)](#4-база-данных-prismasqlite)
5. [Состояние приложения (Zustand Stores)](#5-состояние-приложения-zustand-stores)
6. [Вкладки и панели — подробное описание](#6-вкладки-и-панели--подробное-описание)
7. [API-маршруты — полный справочник](#7-api-маршруты--полный-справочник)
8. [Серверная обработка Excel (excel-server.ts)](#8-серверная-обработка-excel-excel-serverts)
9. [Python-утилиты](#9-python-утилиты)
10. [Боковая панель (Sidebar)](#10-боковая-панель-sidebar)
11. [Главная страница (Dashboard)](#11-главная-страница-dashboard)
12. [Темы оформления](#12-темы-оформления)
13. [Инфраструктура и развёртывание](#13-инфраструктура-и-развёртывание)
14. [Потоки данных и связи между модулями](#14-потоки-данных-и-связи-между-модулями)
15. [Известные проблемы и ограничения](#15-известные-проблемы-и-ограничения)
16. [Планы развития](#16-планы-развития)

---

## 1. Общее описание системы

**VSM ОМиК** — корпоративная информационная система для отдела мобилизации и координации персонала строительной компании «ВелесстройМонтаж». Система обеспечивает:

- **Управление базой данных сотрудников** (113,000+ записей из 1С)
- **Учёт затрат на авиа- и ЖД-билеты** (организации ВСП и СК)
- **Ежедневный учёт персонала** (на объекте, в командировке, в отпуске)
- **Календарь прилёта-вылета** (отслеживание перемещений)
- **Автоматизированную обработку данных** (24 Python-утилиты)
- **Файловый менеджер** (загрузка, просмотр, удаление, каталогизация)
- **Систему оценок KPI** (рейтинг персонала)
- **Генерацию отчётов** (по трудоустройству, увольнениям, мобилизации)

Система построена как **одностраничное приложение (SPA)** с боковой навигацией и динамической загрузкой панелей. Все данные хранятся в памяти сервера (in-memory cache) и/или в SQLite через Prisma ORM.

---

## 2. Архитектура и технологический стек

### 2.1. Высокоуровневая архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│                        Браузер (Client)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  React 19    │  │  Zustand     │  │  Shadcn/UI Components  │ │
│  │  Next.js 16  │  │  Stores      │  │  (50+ компонентов)     │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘ │
│         │                 │                                      │
│         └────────┬────────┘                                      │
└──────────────────┼───────────────────────────────────────────────┘
                   │ fetch() / JSON+base64
┌──────────────────┼───────────────────────────────────────────────┐
│                  ▼     Сервер (Node.js / Bun)                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 (App Router, port 3000)           │   │
│  │  ┌─────────────┐  ┌───────────────┐  ┌────────────────┐  │   │
│  │  │ API Routes  │  │ excel-server  │  │  Prisma ORM    │  │   │
│  │  │ /api/*      │  │ (55KB, in-mem)│  │  (SQLite)      │  │   │
│  │  └──────┬──────┘  └───────┬───────┘  └───────┬────────┘  │   │
│  │         │                 │                    │           │   │
│  │         └────────┬────────┘                    │           │   │
│  │                  ▼                             │           │   │
│  │  ┌─────────────────────────────┐               │           │   │
│  │  │  /upload/ (файловая система)│               │           │   │
│  │  └─────────────────────────────┘               │           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Caddy Reverse Proxy (port 81 → :3000)                    │   │
│  │  XTransformPort query для маршрутизации на другие порты   │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2. Технологический стек

| Категория | Технология | Версия | Назначение |
|-----------|-----------|--------|-----------|
| **Фреймворк** | Next.js (App Router) | 16.x | SSR/SSG, API routes, routing |
| **Язык** | TypeScript | 5.x | Типобезопасность |
| **Runtime** | Bun | latest | Выполнение, пакетный менеджер |
| **UI** | React | 19.x | Компонентная модель |
| **Стилизация** | Tailwind CSS | 4.x | Utility-first CSS |
| **Компоненты** | Shadcn/UI (New York) | latest | 50+ UI-примитивов на Radix UI |
| **Иконки** | Lucide React | 0.525+ | 1500+ SVG-иконок |
| **Состояние** | Zustand | 5.x | Клиентский стейт-менеджмент |
| **Серверные данные** | TanStack Query | 5.x | Кеширование серверных запросов |
| **Таблицы** | TanStack Table | 8.x | Виртуализация, сортировка, фильтры |
| **ORM** | Prisma | 6.x | Доступ к SQLite |
| **БД** | SQLite | — | Персистентное хранение метаданных |
| **Excel** | SheetJS (xlsx) | 0.18.5 | Чтение/запись XLSX/XLS файлов |
| **Графики** | Recharts | 2.x | Визуализация данных |
| **Анимации** | Framer Motion | 12.x | Плавные переходы |
| **Формы** | React Hook Form + Zod | 7.x / 4.x | Валидация форм |
| **Drag & Drop** | dnd-kit | 6.x | Перетаскивание элементов |
| **Аутентификация** | NextAuth.js | 4.x | (присутствует, не задействована) |
| **AI SDK** | z-ai-web-dev-sdk | 0.0.17 | LLM, VLM, TTS, ASR, генерация изображений |
| **Реверс-прокси** | Caddy | — | Маршрутизация, HTTPS |

### 2.3. Ключевые архитектурные решения

1. **In-memory кеш вместо полной БД** — Основная база сотрудников (113K+ записей) хранится в оперативной памяти через `globalThis` для переживания HMR. SQLite используется только для метаданных файлов.

2. **JSON+base64 вместо multipart/form-data** — Caddy-прокси ломает multipart-запросы, поэтому все загрузки файлов используют JSON с base64-кодированием.

3. **Динамический импорт панелей** — Все панели загружаются через `next/dynamic` с `ssr: false` для уменьшения размера начального бандла.

4. **Декомиссия FastAPI** — Изначально система имела Python FastAPI бэкенд на порту 3031. Вся логика перенесена в `excel-server.ts` (Node.js), Python-бэкенд не запускается.

5. **Worker Thread для тяжёлых операций** — Загрузка основной базы данных вынесена в Worker Thread для предотвращения блокировки event loop.

---

## 3. Структура проекта

```
/home/z/my-project/
│
├── .env                                    # DATABASE_URL=file:/home/z/my-project/db/custom.db
├── Caddyfile                               # Реверс-прокси: :81 → :3000
├── package.json                            # Зависимости и скрипты
├── next.config.ts                          # standalone output, 100MB body limit
├── tsconfig.json                           # TypeScript конфигурация
├── tailwind.config.ts                      # Tailwind CSS конфигурация
├── components.json                         # Shadcn/UI: new-york стиль, Geist шрифты
│
├── prisma/
│   └── schema.prisma                       # 6 моделей: ExcelFile, MainDatabase, TicketCost, Macro, Operation, TicketExpense
│
├── db/
│   └── custom.db                           # SQLite файл базы данных
│
├── upload/                                 # Директория загруженных файлов
│   ├── main-database/                      #   Файлы основной базы
│   ├── tickets_costs/
│   │   ├── vsm/                            #   Билеты организации ВСП
│   │   └── sk/                             #   Билеты организации СК
│   └── general/                            #   Прочие загруженные файлы
│
├── download/                               # Директория скачивания
│
├── utilities/                              # 24 Python-утилиты
│   ├── ExcelHeaderComparator.py
│   ├── Ticket_Parse.py
│   ├── XLSB_to_XLSX.py
│   ├── file_organizer.py / file_organizer2.py
│   ├── file_renamer.py / rename_tool.py
│   ├── folderforge_pro_v3.py
│   ├── outlook_app.py
│   ├── translit_passport.py
│   ├── АвиаЖД_билеты_(из_pdf_в_Excel).py
│   ├── Транслит_ФИО_RU_EN.py
│   ├── Создание_папок.py
│   └── [и другие...]
│
├── mini-services/
│   └── excel-service/                      # Python FastAPI бэкенд (ДЕКОМИССИРОВАН)
│       ├── app.py                          #   FastAPI основное приложение
│       ├── main_db.py                      #   Операции с основной базой
│       ├── tickets.py / tickets_costs.py / tickets_db.py
│       ├── daily_tracking.py / daily_validation.py
│       ├── excel_handler.py / excel_libs.py
│       ├── data_merge.py / data_ops.py
│       ├── references.py / reports.py
│       ├── vba_lab.py / macro_engine.py
│       ├── python_handler.py
│       ├── integration_ops.py
│       ├── gelendzhik_report.py
│       ├── welcome_settings.py / calendar_db.py
│       ├── browse_dialog.py / auth_middleware.py
│       ├── celery_app.py / celery_tasks.py / task_queue.py
│       ├── deps.py / data_paths.py
│       ├── routers/                        #   API-роутеры
│       ├── requirements.txt                #   Python-зависимости
│       └── run.sh / start.sh               #   Скрипты запуска
│
├── scripts/
│   └── excel-loader.cjs                    # Child-process Excel загрузчик (Node.js)
│
└── src/
    ├── app/
    │   ├── globals.css                     # 3 темы, анимации, утилиты
    │   ├── layout.tsx                      # Root layout: ThemeProvider + Toaster
    │   ├── page.tsx                        # Главная SPA-страница (~1100 строк)
    │   └── api/                            # API-маршруты
    │       ├── route.ts                    #   GET → "Hello, world!"
    │       ├── health/route.ts             #   GET → healthCheck()
    │       ├── [...path]/route.ts          #   Catch-all 404 (бывший FastAPI прокси)
    │       ├── main-db/                    #   6 подмаршрутов
    │       ├── main-database/              #   2 подмаршрута (Prisma)
    │       ├── tickets/                    #   13 подмаршрутов
    │       ├── ticket-expenses/            #   1 подмаршрут (list)
    │       ├── excel/                      #   4 подмаршрута
    │       ├── excel-proxy/                #   Прокси к localhost:3031 (legacy)
    │       ├── daily-accounting/           #   1 подмаршрут (list)
    │       ├── reports/                    #   2 подмаршрута (filters, generate)
    │       ├── utilities/                  #   GET (list/source/download), POST (execute)
    │       └── files/                      #   Файловый менеджер: GET, DELETE, POST
    │
    ├── components/
    │   ├── AppSidebar.tsx                  # Боковая панель: 4 группы, 20 пунктов навигации
    │   ├── Sidebar.tsx                     # Legacy боковая панель
    │   ├── GlobalStatusBar.tsx             # Глобальная строка состояния
    │   ├── ThemeProvider.tsx               # Провайдер темы (next-themes)
    │   ├── theme-toggle.tsx               # Переключатель тема
    │   ├── panels/                         # 32 компонента-панели
    │   │   ├── MainDatabasePanel.tsx       #   ✅ Браузер базы сотрудников + отчёты
    │   │   ├── TicketExpensesPanel.tsx     #   ✅ Управление затратами на билеты (ВСП + СК)
    │   │   ├── CalendarPanel.tsx           #   ✅ Календарь Прилёт-Вылет
    │   │   ├── DailyTrackingPanel.tsx      #   ✅ Ежедневный учёт персонала
    │   │   ├── SettingsPanel.tsx           #   ✅ Настройки системы (4 подвкладки)
    │   │   ├── UtilitiesPanel.tsx          #   ✅ Python-утилиты + запуск приложений
    │   │   ├── FileManagerPanel.tsx        #   ✅ Файловый менеджер
    │   │   ├── RatingsPanel.tsx            #   ✅ Система оценок KPI
    │   │   ├── UnderDevelopment.tsx        #   ✅ Заглушка для модулей в разработке
    │   │   ├── DailyAccountingPanel.tsx    #   Ежедневная бухгалтерия
    │   │   ├── ExcelEditorPanel.tsx        #   Редактор Excel
    │   │   ├── TicketsCostsPanel.tsx       #   Стоимость билетов
    │   │   ├── PersonnelPanel.tsx          #   Персонал
    │   │   ├── MobilizationPanel.tsx       #   Мобилизация
    │   │   ├── ReportsPanel.tsx            #   Отчёты
    │   │   ├── VBALabPanel.tsx             #   VBA-лаборатория
    │   │   └── [и другие...]
    │   └── ui/                             # 50+ Shadcn/UI примитивов
    │
    ├── hooks/
    │   ├── use-mobile.ts                   # Определение мобильного устройства
    │   ├── use-theme.ts                    # Хук темы
    │   └── use-toast.ts                    # Хук уведомлений
    │
    ├── lib/
    │   ├── db.ts                           # Prisma Client singleton
    │   ├── excel-backend.ts                # FastAPI клиент (localhost:3031, legacy)
    │   ├── excel-server.ts                 # Ядро обработки Excel (55KB!)
    │   ├── safe-fetch.ts                   # Безопасный JSON-fetch с обработкой ошибок
    │   ├── upload-helper.ts                # Утилита загрузки файлов (в /upload)
    │   └── utils.ts                        # cn(), formatDateDDMMYYYY(), formatDateDDMMYYYYHHmmss()
    │
    └── store/
        ├── useAppStore.ts                  # Основной store (activeTab, theme, sidebar, backend)
        ├── vsm-store.ts                    # Re-export: useAppStore → useVSMStore
        ├── app-store.ts                    # Legacy store (старые PanelType + persist)
        └── task-store.ts                   # Продвинутый менеджер задач (Map-based)
```

---

## 4. База данных (Prisma/SQLite)

### 4.1. Подключение

- **Провайдер:** SQLite
- **Файл БД:** `/home/z/my-project/db/custom.db`
- **Строка подключения:** `DATABASE_URL=file:/home/z/my-project/db/custom.db`
- **Singleton клиент:** `src/lib/db.ts` — `import { db } from '@/lib/db'`

### 4.2. Модели данных

#### ExcelFile — Реестр загруженных Excel-файлов

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Уникальный идентификатор |
| `name` | String | Системное имя файла |
| `originalName` | String | Оригинальное имя при загрузке |
| `filePath` | String | Абсолютный путь на диске |
| `fileSize` | Int | Размер в байтах |
| `sheetName` | String (default: "Лист1") | Имя листа |
| `totalRows` | Int (default: 0) | Количество строк |
| `totalCols` | Int (default: 0) | Количество столбцов |
| `category` | String (default: "general") | Категория (general, main-database, билеты и т.д.) |
| `status` | String (default: "uploaded") | Статус: uploaded, processing, processed, error |
| `isActive` | Boolean (default: false) | Является ли файл активным |
| `loadedAt` | DateTime | Время загрузки |
| `createdAt` | DateTime | Время создания записи |
| `updatedAt` | DateTime | Время последнего обновления |

#### MainDatabase — Основная база данных сотрудников (метаданные)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Уникальный идентификатор |
| `name` | String | Системное имя файла |
| `originalName` | String | Оригинальное имя |
| `filePath` | String | Путь к файлу |
| `totalRows` | Int (default: 0) | Общее количество строк (113,000+) |
| `totalCols` | Int (default: 0) | Количество столбцов |
| `sheetName` | String (default: "Лист1") | Имя листа |
| `fileSize` | Int (default: 0) | Размер файла |
| `keyColumns` | String (default: "[]") | JSON-массив ключевых столбцов |
| `isActive` | Boolean (default: false) | Активная база |
| `loadedAt` | DateTime | Время загрузки |
| `updatedAt` | DateTime | Время обновления |

#### TicketCost — Записи о затратах на билеты

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `name` | String | Имя файла |
| `originalName` | String | Оригинальное имя |
| `filePath` | String | Путь |
| `fileSize` | Int | Размер |
| `month` | String? | Месяц (определяется из имени файла) |
| `category` | String (default: "билеты") | Категория: билеты, монтаж, допы, итоговый |
| `totalAmount` | Float (default: 0) | Общая сумма |
| `rowCount` | Int (default: 0) | Количество строк |
| `uploadedAt` | DateTime | Время загрузки |
| `createdAt` | DateTime | Время создания |
| `updatedAt` | DateTime | Время обновления |

#### Macro — Хранилище VBA/Python макросов

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `name` | String | Имя макроса |
| `code` | String | Исходный код |
| `language` | String (default: "python") | Язык: python, vba |
| `fileId` | String? | Привязка к файлу |
| `createdAt` | DateTime | Время создания |
| `updatedAt` | DateTime | Время обновления |

#### Operation — Аудит-лог операций

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `type` | String | Тип операции (upload, load, process, delete и т.д.) |
| `fileId` | String? | ID связанного файла |
| `details` | String? | Детали операции (JSON) |
| `createdAt` | DateTime | Время операции |

#### TicketExpense — Записи о затратах на билеты (альтернативная модель)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `fileName` | String | Имя файла |
| `originalName` | String | Оригинальное имя |
| `filePath` | String | Путь |
| `fileSize` | Int | Размер |
| `isActive` | Boolean (default: false) | Активен |
| `loadedAt` | DateTime | Время загрузки |
| `createdAt` | DateTime | Время создания |
| `updatedAt` | DateTime | Время обновления |

### 4.3. Важное замечание о хранении данных

**113,000+ записей сотрудников НЕ хранятся в SQLite.** Они хранятся в **in-memory кеше** (`excel-server.ts`) через `globalThis`, который переживает HMR-перезагрузки в dev-режиме. SQLite используется только для метаданных файлов (имя, путь, размер, статус).

---

## 5. Состояние приложения (Zustand Stores)

### 5.1. useAppStore (основной store)

**Файл:** `src/store/useAppStore.ts`
**Реэкспорт:** `src/store/vsm-store.ts` → `useVSMStore`

```typescript
interface AppState {
  // Активная вкладка (19 вариантов)
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Legacy: активная панель (для обратной совместимости)
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void

  // Тема оформления: 'color' (amber/оранжевая) | 'light' | 'dark'
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void

  // Подвкладка настроек: 'main-base' | 'references' | 'modules' | 'auth'
  settingsSubTab: SettingsSubTab
  setSettingsSubTab: (tab: SettingsSubTab) => void

  // Состояние боковой панели
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void

  // Статус бэкенда: 'online' | 'offline' | 'checking'
  backendStatus: 'online' | 'offline' | 'checking'
  setBackendStatus: (status: ...) => void

  // Флаг онлайн-статуса бэкенда (используется в page.tsx)
  backendOnline: boolean
  setBackendOnline: (online: boolean) => void

  // Глобальный флаг загрузки
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}
```

#### TabId — 19 типов вкладок

| TabId | Название | Группа | Работает |
|-------|----------|--------|----------|
| `dashboard` | Главная | main | ✅ |
| `main-db` | Основная База | data | ✅ |
| `experience` | Стаж | data | ❌ |
| `daily-tracking` | Ежедневный учёт | data | ✅ |
| `calendar` | Календарь П-В | data | ✅ |
| `carnet` | Карнет | data | ❌ |
| `tickets` | Затраты на билеты | data | ✅ |
| `employee-path` | Путь сотрудника | data | ❌ |
| `dismissed-report` | Уволенный персонал | reports | ❌ |
| `employment-costs` | Затраты на труд. | reports | ❌ |
| `mobilization-plan` | Мобилизация ОП | reports | ❌ |
| `ratings` | Оценки | reports | ✅ |
| `utilities` | Утилиты | system | ✅ |
| `vba-lab` | VBA Лаборатория | system | ❌ |
| `file-prepare` | Подготовка файлов | system | ❌ |
| `settings` | Настройки | system | ✅ |
| `integration` | Интеграция | system | ❌ |
| `data-merge` | Слияние данных | system | ❌ |
| `file-manager` | Файловый менеджер | system | ✅ |

### 5.2. useTaskStore (менеджер задач)

**Файл:** `src/store/task-store.ts`

Продвинутый менеджер задач с Map-хранилищем. Поддерживает:

- **Типы задач:** upload, download, processing, export, load, validate, other
- **Под-шаги:** Каждая задача может иметь массив `TaskStep[]` с отдельными статусами
- **AbortController:** Каждая задача имеет сигнал отмены для fetch-запросов
- **Auto-dismiss:** Завершённые задачи автоматически удаляются через N мс
- **Автоочистка:** Каждые 30 секунд удаляются задачи, завершённые более 10 секунд назад

```typescript
interface TaskInfo {
  id: string                    // "task-{timestamp}-{counter}"
  name: string                  // Читаемое имя задачи
  type: TaskInfo['type']        // Тип для группировки
  sourceTab: string             // Вкладка-источник
  status: TaskStatus            // pending | running | done | error | cancelled
  progress: number              // 0-100, -1 = неопределённый
  message: string               // Детальный статус
  steps: TaskStep[]             // Под-шаги
  fileName?: string             // Имя файла (если применимо)
  startedAt: number             // Timestamp начала
  finishedAt?: number           // Timestamp завершения
  abortController?: AbortController  // Для отмены
  autoDismissMs: number         // Автоудаление через N мс (default: 5000)
  error?: string                // Сообщение об ошибке
}
```

---

## 6. Вкладки и панели — подробное описание

### 6.1. ✅ Рабочие панели

---

#### 📊 Главная (Dashboard)

**TabId:** `dashboard`
**Компонент:** Интегрирован в `page.tsx`
**Группа:** Главная

**Содержимое:**
- **Приветствие** — Адаптивное (Доброе утро / Добрый день / Добрый вечер / Доброй ночи)
- **Живые часы** — Обновляются каждую секунду, показывают дату и время
- **Бегущая строка (Ticker)** — 8 новостей системы с иконками и автопрокруткой
- **4 карточки статистики** с ProgressRing:
  - Сотрудников (из БД или «—» если не загружена)
  - Онлайн (время работы)
  - БД Статус (загружена / не загружена)
  - Бэкенд (онлайн / офлайн / проверка)
- **Хронология последней активности** — 6 событий с иконками и временем
- **Сетка модулей** — 18 карточек (цветные иконки, WIP-бейджи, зелёные точки для рабочих)
- **Таблица распределения по подразделениям** — 6 строк
- **Таблица ежемесячных затрат на билеты** — 6 месяцев (ВСП + СК)
- **Монитор системного здоровья** — CPU, Память, Диск (симуляция каждые 5 сек)

**Автоматические проверки:**
- Backend health: каждые 30 сек (`/api/health`)
- DB status: каждые 60 сек (`/api/main-db/status`)
- System health: каждые 5 сек (симуляция)

---

#### 🗄️ Основная База (MainDatabasePanel)

**TabId:** `main-db`
**Компонент:** `src/components/panels/MainDatabasePanel.tsx`
**Группа:** Данные
**API:** `/api/main-db/*`, `/api/reports/*`

**Два режима работы:**

1. **Режим «Данные»:**
   - Пагинированная таблица (50 строк на страницу)
   - Полнотекстовый поиск по всем столбцам
   - Фильтры по столбцам (Excel-подобные multi-select)
   - Сортировка по любому столбцу (asc/desc)
   - Переключатель «Только ключевые столбцы» (13 столбцов с индексами [0,1,2,3,4,5,6,8,10,11,12,13])
   - Авто-загрузка при наличии файла в `/upload/main-database/`

2. **Режим «Отчёты»:**
   - Отчёт по трудоустройству (фильтры: год, гражданство, территория)
   - Отчёт по увольнениям (фильтры: период, подразделение)
   - Отчёт по составу (фильтры: статус, организация)
   - Календарный отчёт (фильтры: год, месяц, направление)

**Связи:**
- Данные загружаются через `/api/main-db/load` в in-memory кеш
- Запросы данных через `/api/main-db/data` (пагинация, поиск, фильтры, сортировка)
- Используется как источник данных для `fillByPassport()` и `fillByFuzzyFIO()` в панели билетов

---

#### 🎫 Затраты на билеты (TicketExpensesPanel)

**TabId:** `tickets`
**Компонент:** `src/components/panels/TicketExpensesPanel.tsx`
**Группа:** Данные
**API:** `/api/tickets/*`

**Три подвкладки:**

1. **Дашборд:**
   - KPI-карточки: всего билетов, общая сумма, средняя цена, уникальных сотрудников
   - Сравнение организаций ВСП vs СК
   - Топ-10 маршрутов (по количеству и сумме)
   - Топ-10 сотрудников (по количеству поездок)
   - Помесячная разбивка

2. **Организация ВСП:**
   - Загрузка Excel-файлов билетов
   - Список исходных файлов
   - Таблица данных (пагинация, поиск, фильтры, сортировка)
   - **Действия по обработке:**
     - `clean-tab-passport` — Очистка табельного номера и транслитерация паспорта
     - `fill-passport` — Заполнение Табельный_1С и ФИО_1С по номеру паспорта
     - `fill-fio-en` — Заполнение ФИО_1С на английском по Ф.И.О. на русском
     - `fill-fio-fuzzy` — Нечёткий поиск ФИО в основной базе (Levenshtein distance, порог 70%)
     - `fill-ploshchadka` — Заполнение Площадка по табельному номеру

3. **Организация СК:** — Аналогично ВСП, но данные из `/upload/tickets_costs/sk/`

**Связи:**
- Зависит от основной базы (MainDatabase) для действий fill-passport, fill-fio-fuzzy, fill-ploshchadka
- Данные кешируются в памяти (`ticketDataCache[vsm|sk]`)

---

#### 📅 Календарь Прилёт-Вылет (CalendarPanel)

**TabId:** `calendar`
**Компонент:** `src/components/panels/CalendarPanel.tsx`
**Группа:** Данные
**API:** `/api/main-db/*`, `/api/tickets/*`

**Функциональность:**
- Загрузка Excel-файлов (билеты, расписания)
- Загрузка данных в основную базу
- Отображение пагинированных данных о билетах
- Фильтрация по году и месяцу
- Визуализация дат прилёта и вылета

---

#### 📋 Ежедневный учёт (DailyTrackingPanel)

**TabId:** `daily-tracking`
**Компонент:** `src/components/panels/DailyTrackingPanel.tsx`
**Группа:** Данные

**Функциональность:**
- **Карточки сводки:** На объекте, В командировке, В отпуске
- **Таблица активности** — Лог событий (ФИО, действие, дата, подразделение)
- **Форма добавления** — Новая запись (ФИО, тип, подразделение, дата, комментарий)
- Использует **mock-данные** (нет API-интеграции)

---

#### ⚙️ Настройки (SettingsPanel)

**TabId:** `settings`
**Компонент:** `src/components/panels/SettingsPanel.tsx`
**Группа:** Система

**4 подвкладки:**

1. **Главная база (main-base):**
   - Загрузка Excel-файла основной базы (JSON+base64 через `/api/main-db/load`)
   - Статус базы (загружена/не загружена, строк, столбцов, память МБ)
   - Управление данными: перезагрузка, очистка

2. **Справочники (references):**
   - Гражданство, Территории, Организации, Должности, Статусы, Направления

3. **Модули (modules):** — Переключатель 6 модулей (вкл/выкл)

4. **Авторизация (auth):** — Placeholder для будущей системы авторизации

---

#### 🔧 Утилиты (UtilitiesPanel)

**TabId:** `utilities`
**Компонент:** `src/components/panels/UtilitiesPanel.tsx`
**Группа:** Система
**API:** `/api/utilities`

**Два раздела:**

1. **Python-утилиты (24 скрипта в 6 категориях):**

   | Категория | Утилиты |
   |-----------|---------|
   | **Файлы** | file_organizer, file_organizer2, file_renamer, rename_tool, folderforge_pro_v3, Создание_папок, Создать_структуру2, Переименовать_файлы, Переименовать_файлы_по_назв_папки |
   | **Excel** | ExcelHeaderComparator, Excel_Header_Comparator, XLSB_to_XLSX, excel_resaver, Анализ_и_структура_папки_и_EXCEL, apply_manual_mapping |
   | **Транслитерация** | translit_passport, Транслит_ФИО_RU_EN, ФИО_перевод_RU-EN |
   | **Билеты/Авиа** | Ticket_Parse, АвиаЖД_билеты_(из_pdf_в_Excel), АвиаЖД_билеты_(из_pdf_в_Excel)_only_RU |
   | **Анализ** | Синтаксический_анализатор_Python-файлов, счёт_листов_в_ПДФ |
   | **Email** | outlook_app |

   Для каждой утилиты: просмотр исходного кода, скачивание .py файла, диалог запуска (аргументы, таймаут 10 сек), проверка зависимостей

2. **Запуск приложений (App Launcher):** — 8 предустановленных ярлыков + произвольная команда

---

#### 📁 Файловый менеджер (FileManagerPanel)

**TabId:** `file-manager`
**Компонент:** `src/components/panels/FileManagerPanel.tsx`
**Группа:** Система
**API:** `/api/files`

**Функциональность:**
- Сетка / Список отображение
- Навигация по хлебным крошкам
- Поиск файлов по имени
- Загрузка файлов (base64 → сервер)
- Создание папки, переименование, удаление, скачивание
- Статистика: типы файлов, размер хранилища
- Рабочая директория: `/home/z/my-project/upload/`

---

#### ⭐ Оценки (RatingsPanel)

**TabId:** `ratings`
**Компонент:** `src/components/panels/RatingsPanel.tsx`
**Группа:** Отчёты

**Функциональность (всё на mock-данных):**
- Таблица рейтингов подразделений (сортируемая)
- Топ-5 сотрудников с прогресс-баром
- Диаграмма распределения оценок (1-5 баллов)
- Хронология последних оценок

---

### 6.2. 🚧 Вкладки в разработке (UnderDevelopment)

Все эти вкладки показывают компонент `UnderDevelopment` с анимацией строительства.

| TabId | Название | Описание |
|-------|----------|----------|
| `experience` | Стаж | Учёт и расчёт стажа. Автоподсчёт общего, непрерывного и льготного стажа |
| `carnet` | Карнет | Управление документами. Отслеживание сроков, уведомления о продлении |
| `dismissed-report` | Уволенный персонал | Аналитика увольнений: причины, сроки, статистика по подразделениям |
| `employment-costs` | Затраты на трудоустройство | Учёт затрат: билеты, проживание, питание, медкомиссии |
| `mobilization-plan` | Мобилизация ОП | План мобилизации: графики, заявки, контроль исполнения |
| `employee-path` | Путь сотрудника | Визуализация пути: от найма до текущей позиции |
| `vba-lab` | VBA Лаборатория | Редактор макросов VBA и скриптов Python |
| `file-prepare` | Подготовка файлов | Предобработка Excel: очистка, нормализация, валидация |
| `integration` | Интеграция | Внешние системы: 1С, ERP, SAP, API |
| `data-merge` | Слияние данных | Объединение из разных источников: база, справочники, билеты |

---

## 7. API-маршруты — полный справочник

### 7.1. Корневые маршруты

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api` | GET | Возвращает "Hello, world!" |
| `/api/health` | GET | Проверка здоровья |
| `/api/[...path]` | * | Catch-all 404 (бывший FastAPI прокси) |

### 7.2. Основная база данных (Main DB)

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/main-db/status` | GET | Статус загрузки БД | — |
| `/api/main-db/data` | POST | Запрос данных с пагинацией | `{ page, page_size, key_columns_only, search, sort_column, sort_direction, filter_column, filter_value, filters }` |
| `/api/main-db/load` | POST | Загрузка Excel → in-memory | `{ filePath? }` |
| `/api/main-db/columns` | GET | Метаданные столбцов | — |
| `/api/main-db/stats` | GET | Статистика БД | — |
| `/api/main-db/clear` | DELETE | Очистка in-memory базы | — |

### 7.3. Билеты (Tickets)

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/tickets/list` | GET | Список файлов билетов | — |
| `/api/tickets/summary` | GET | Сводная статистика | — |
| `/api/tickets/analyze` | POST | Анализ данных билетов | — |
| `/api/tickets/dashboard` | GET | Данные дашборда | `?org=vsm\|sk` |
| `/api/tickets/table-data` | POST | Пагинированные данные таблицы | `{ org, page, page_size, search, filters, sort_column, sort_direction }` |
| `/api/tickets/table-action` | POST | Действия обработки | `{ action: clean-tab-passport\|fill-passport\|fill-fio-en\|fill-fio-fuzzy\|fill-ploshchadka, org }` |
| `/api/tickets/source-files` | GET | Исходные файлы | `?org=vsm\|sk` |
| `/api/tickets/filter-options` | GET | Опции фильтров | `?org=vsm\|sk` |
| `/api/tickets/bulk-upload` | POST/GET | Загрузка файлов билетов | JSON+base64 |
| `/api/tickets/process` | POST | История обработки | — |
| `/api/tickets/clear-registry` | POST | Очистка реестра | — |
| `/api/tickets/clear-source-files` | POST | Очистка исходных файлов | — |
| `/api/tickets/data/[id]` | GET | Данные билета по ID | — |

### 7.4. Excel-файлы

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/excel/list` | GET | Список Excel-файлов (Prisma) |
| `/api/excel/files` | GET | Список файлов с диска |
| `/api/excel/files/[id]` | GET/DELETE | Получить/удалить файл |
| `/api/excel/sheet-data` | GET | Чтение данных листа |
| `/api/excel/[...path]` | * | Прокси к FastAPI (legacy) |

### 7.5. Файловый менеджер

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/files` | GET | Список/поиск/скачивание | `?action=list\|search\|download&path=&q=` |
| `/api/files` | DELETE | Удаление файла/папки | `{ path }` |
| `/api/files` | POST | Загрузка/создание папки/переименование | `{ action: upload\|mkdir\|rename, ... }` |

### 7.6. Утилиты

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/utilities` | GET | Список/исходник/скачивание | `?action=list\|source\|download&name=` |
| `/api/utilities` | POST | Запуск утилиты | `{ name, args, timeout? }` (default timeout: 10 сек) |

### 7.7. Прочие

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/main-database/list` | GET | Список MainDatabase (Prisma) |
| `/api/main-database/status` | GET | Активная MainDatabase (Prisma) |
| `/api/ticket-expenses/list` | GET | Список TicketExpense (Prisma) |
| `/api/daily-accounting/list` | GET | Список записей (Prisma) |
| `/api/reports/filters` | GET | Опции фильтров отчётов |
| `/api/reports/generate` | POST | Генерация отчёта |
| `/api/excel-proxy` | * | Прокси к FastAPI 3031 (legacy) |

---

## 8. Серверная обработка Excel (excel-server.ts)

**Файл:** `src/lib/excel-server.ts` (55KB!)
**Назначение:** Полная замена Python FastAPI бэкенда

### 8.1. In-memory кеши

```typescript
// Кеш основной базы (переживает HMR через globalThis)
mainDbCache: MainDbCache | null
  ├── df: Record<string, unknown>[]       // Массив строк данных (113K+)
  ├── columns: ColumnMeta[]               // Метаданные столбцов
  └── metadata: { file_name, file_path, total_rows, total_cols, loaded_at }

// Кеш файлов билетов
ticketCache: Record<string, TicketCacheEntry>

// Кеш распарсенных данных билетов по организациям
ticketDataCache: Record<string, TicketDataCache>
  └── [org: 'vsm'|'sk']: { rows, columns, loadedAt, fileCount }
```

### 8.2. Экспортируемые функции

| Функция | Описание |
|---------|----------|
| `healthCheck()` | Проверка здоровья сервиса |
| `getUploadDir()` | Путь к /upload |
| `ensureDir(dir)` | Создание директории (recursive) |
| `saveUploadedFile(buffer, name, category)` | Сохранение файла на диск |
| `getMainDbStatus()` | Статус основной БД |
| `loadMainDb(filePath?)` | Загрузка Excel → in-memory кеш |
| `getMainDbData(params)` | Запрос данных (пагинация, поиск, фильтры, сортировка) |
| `getMainDbColumns()` | Метаданные столбцов |
| `getMainDbStats()` | Статистика (память, ключ. столбцы) |
| `searchMainDb(params)` | Поиск по базе |
| `clearMainDb()` | Очистка in-memory кеша |
| `getTicketList()` | Список файлов билетов |
| `getTicketData(fileId, page, pageSize)` | Данные конкретного файла |
| `getTicketSummary()` | Сводная статистика билетов |
| `analyzeTickets()` | Анализ всех файлов билетов |
| `bulkUploadTickets(files, org)` | Пакетная загрузка билетов |
| `getTicketDashboard(org)` | Данные дашборда |
| `getTicketFilterOptions(org)` | Опции фильтров |
| `getTicketTableData(params)` | Пагинированные данные таблицы |
| `cleanTabPassport(org)` | Очистка табельного номера + транслитерация паспорта |
| `fillByPassport(org)` | Заполнение по номеру паспорта из основной базы |
| `fillByFIOEn(org)` | Заполнение ФИО на английском (транслитерация) |
| `fillByFuzzyFIO(org)` | Нечёткий поиск ФИО (Levenshtein, порог 70%) |
| `fillByPloshchadka(org)` | Заполнение Площадка из основной базы |
| `getReportFilters()` | Опции фильтров отчётов |
| `generateReport(params)` | Генерация отчёта (заглушка) |

### 8.3. Внутренние алгоритмы

- **readExcelToRows()** — Стандартное чтение через SheetJS
- **readTicketExcelToRows()** — Чтение с авто-поиском строки заголовков (сканирует первые 15 строк)
- **transliterateLatToCyr() / transliterateCyrToLat()** — Кириллица ↔ Латиница
- **levenshteinDistance()** — Расстояние Левенштейна (DP-алгоритм)
- **similarityPercent()** — Процент схожести (0-100), порог 70% для match
- **detectMonth()** — Извлечение месяца из имени файла
- **detectCategory()** — Категория по ключевым словам

### 8.4. Ключевые столбцы

13 ключевых столбцов по индексам: `[0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13]`

---

## 9. Python-утилиты

**Директория:** `/home/z/my-project/utilities/`
**Количество:** 24 скрипта

### Категории

| Категория | Количество | Скрипты |
|-----------|-----------|---------|
| **Файлы** | 9 | file_organizer, file_organizer2, file_renamer, rename_tool, folderforge_pro_v3, Создание_папок, Создать_структуру2, Переименовать_файлы, Переименовать_файлы_по_назв_папки |
| **Excel** | 6 | ExcelHeaderComparator, Excel_Header_Comparator, XLSB_to_XLSX, excel_resaver, Анализ_и_структура_папки_и_EXCEL, apply_manual_mapping |
| **Транслитерация** | 3 | translit_passport, Транслит_ФИО_RU_EN, ФИО_перевод_RU-EN |
| **Билеты/Авиа** | 3 | Ticket_Parse, АвиаЖД_билеты_(из_pdf_в_Excel), АвиаЖД_билеты_(из_pdf_в_Excel)_only_RU |
| **Анализ** | 2 | Синтаксический_анализатор_Python-файлов, счёт_листов_в_ПДФ |
| **Email** | 1 | outlook_app |

Запуск: `POST /api/utilities { name, args, timeout }` → `python3 {utilities_dir}/{name} {args}` через child_process

---

## 10. Боковая панель (Sidebar)

**Компонент:** `src/components/AppSidebar.tsx`
**Базовый:** Shadcn/UI Sidebar (collapsible="icon")

**4 группы навигации:**

| Группа | Ключ | Пунктов |
|--------|------|---------|
| Главная | main | 1 (Dashboard) |
| Данные | data | 7 |
| Отчёты | reports | 4 |
| Система | system | 7 |

Каждый пункт: Иконка (Lucide) в цветном квадрате + Название + Описание + WIP-бейдж (если не работает) + Зелёная полоса слева (если активен)

Функции: сворачивание, тултипы, статус бэкенда, счётчик модулей, версия

---

## 11. Главная страница (Dashboard)

**Компонент:** Интегрирован в `src/app/page.tsx`

Два режима:
1. **Dashboard** — Приветствие, часы, бегущая строка, статистика, модули, таблицы, монитор здоровья
2. **Панель** — Хлебные крошки + динамически загруженная панель

Динамический импорт: все панели через `next/dynamic` с `ssr: false`

---

## 12. Темы оформления

**3 темы:**
1. **Color (Amber/Orange)** — Корпоративная VSM, oklch-based тёплые тона
2. **Light** — Минималистичная светлая
3. **Dark** — Тёмная

**CSS-анимации:** ticker, card-entrance, pulse-glow, progress-fill, slide-in-right, line-clamp

---

## 13. Инфраструктура и развёртывание

### Порты

| Сервис | Порт | Статус |
|--------|------|--------|
| Next.js | 3000 | ✅ |
| Caddy Proxy | 81 | ✅ |
| FastAPI | 3031 | ❌ Декомиссирован |

### Caddy
- Порт 81 → прокси на localhost:3000
- `XTransformPort` для маршрутизации на другие порты
- Таймауты: read/write 300s, dial 30s
- **Критическое ограничение:** ломает multipart/form-data → JSON+base64

### Next.js конфигурация
- output: "standalone", bodySizeLimit: 100MB, ignoreBuildErrors: true

### Скрипты

| Команда | Описание |
|---------|----------|
| `bun run dev` | Dev-сервер :3000 |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run db:push` | Push Prisma схемы |
| `bun run db:generate` | Генерация Prisma клиента |

### Формат дат
Все даты в формате **ДД.ММ.ГГГГ** через `formatDateDDMMYYYY()` из `src/lib/utils.ts`

---

## 14. Потоки данных и связи между модулями

### Загрузка основной базы
```
SettingsPanel (загрузка) → POST /api/main-db/load → excel-server.loadMainDb()
→ SheetJS: XLSX.read() → JSON → mainDbCache (globalThis)
→ Dashboard: GET /api/main-db/status → обновление UI
→ MainDatabasePanel: POST /api/main-db/data → пагинированный запрос
```

### Обработка билетов
```
TicketExpensesPanel (загрузка) → POST /api/tickets/bulk-upload → bulkUploadTickets()
→ Сохранение в /upload/tickets_costs/{org}/ → Инвалидация ticketDataCache
→ table-action: fill-passport/fill-fio-fuzzy/fill-ploshchadka → Поиск в mainDbCache
```

### Запуск Python-утилит
```
UtilitiesPanel → POST /api/utilities { name, args, timeout }
→ child_process.execFile("python3", [utilities/name, ...args]) → Результат → UI
```

### Диаграмма связей модулей
```
Dashboard ←→ MainDatabasePanel ←→ excel-server.ts (in-memory)
                  ↑
TicketExpensesPanel → fill-by-passport/fuzzy-FIO/ploshchadka
CalendarPanel → read mainDb data
SettingsPanel → /api/main-db/load
UtilitiesPanel → /api/utilities → Python scripts
FileManagerPanel → /api/files → /upload/ dir
RatingsPanel → (mock data)
DailyTrackingPanel → (mock data)
```

---

## 15. Известные проблемы и ограничения

### Критические
1. **502 Bad Gateway при загрузке** — Долгая обработка XLSX.read() блокирует event loop
2. **Caddy ломает multipart/form-data** — Обход через JSON+base64 (на 33% больше размер)

### Производительность
3. **113K+ записей в памяти** — ~100+ МБ RAM
4. **Нет виртуализации таблиц** — Пагинация без виртуализации
5. **SheetJS segfault** — На больших файлах в Turbopack

### Функциональные
6. **Нет аутентификации** — NextAuth.js не настроен
7. **Mock-данные** — DailyTracking, Ratings, Dashboard stats
8. **10 из 19 вкладок в разработке**
9. **Нет кнопки «Очистить»** — Для загрузок DailyTracking
10. **Нет persisted state** — Zustand stores не персистятся

---

## 16. Планы развития

### Приоритет: Высокий
- [ ] Аутентификация (NextAuth.js + Login_Pass_Status.xlsx)
- [ ] Виртуализация таблиц (@tanstack/react-virtual)
- [ ] Решение 502 при загрузке (Worker Thread / streaming)

### Приоритет: Средний
- [ ] Вкладка «Стаж» — Расчёт стажа из основной базы
- [ ] Вкладка «Уволенный персонал» — Отчёт по уволенным
- [ ] Вкладка «Мобилизация ОП» — План мобилизации
- [ ] Кнопка «Очистить» для DailyTracking
- [ ] Persisted state (Zustand persist middleware)

### Приоритет: Низкий
- [ ] Вкладки: Карнет, Путь сотрудника, VBA Лаборатория, Интеграция, Слияние данных, Подготовка файлов
- [ ] Реальные данные для Ratings и DailyTracking
- [ ] Реальные данные для Dashboard статистики

---

*Документация сгенерирована на основе исходного кода проекта VSM ОМиК.*
