# VSM ОМиК — Полная документация системы

> **Версия:** 1.2
> **Организация:** ООО «ВелесстройМонтаж» — Отдел мобилизации и координации персонала (ОМиК)
> **Репозиторий:** https://github.com/VelesstroyMontazh/VSM_OMIK_2
> **Обновлено:** Domain tables + Worker pool + DuckDB + Архивация

---

## Содержание

1. [Общее описание системы](#1-общее-описание-системы)
2. [Архитектура и технологический стек](#2-архитектура-и-технологический-стек)
3. [Структура проекта](#3-структура-проекта)
4. [База данных (Prisma/SQLite)](#4-база-данных-prismasqlite)
5. [Аутентификация и многопользовательский режим](#5-аутентификация-и-многопользовательский-режим)
6. [SQLite WAL: настройка для 20 пользователей](#6-sqlite-wal-настройка-для-20-пользователей)
7. [Worker Thread Pool](#7-worker-thread-pool)
8. [DuckDB: аналитические запросы](#8-duckdb-аналитические-запросы)
9. [Архивация: месячные архивы](#9-архивация-месячные-архивы)
10. [Состояние приложения (Zustand Stores)](#10-состояние-приложения-zustand-stores)
11. [Вкладки и панели — подробное описание](#11-вкладки-и-панели--подробное-описание)
12. [API-маршруты — полный справочник](#12-api-маршруты--полный-справочник)
13. [Серверная обработка Excel](#13-серверная-обработка-excel)
14. [Python-утилиты](#14-python-утилиты)
15. [Боковая панель (Sidebar)](#15-боковая-панель-sidebar)
16. [Главная страница (Dashboard)](#16-главная-страница-dashboard)
17. [Темы оформления](#17-темы-оформления)
18. [Инфраструктура и развёртывание](#18-инфраструктура-и-развёртывание)
19. [Локальный запуск на Windows](#19-локальный-запуск-на-windows)
20. [Потоки данных и связи между модулями](#20-потоки-данных-и-связи-между-модулями)
21. [Известные проблемы и ограничения](#21-известные-проблемы-и-ограничения)
22. [Планы развития](#22-планы-развития)

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
- **Многопользовательский режим** — до 20 одновременных пользователей с изоляцией рабочих пространств
- **Аутентификацию** — вход по логину/паролю (NextAuth.js + bcrypt)

Система построена как **одностраничное приложение (SPA)** с боковой навигацией и динамической загрузкой панелей. Основные данные сотрудников хранятся в памяти сервера (in-memory cache) для быстрого доступа; метаданные файлов, пользователи и аудит-логи — в SQLite через Prisma ORM.

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
                   │ fetch() / JSON+base64 + JWT cookie
┌──────────────────┼───────────────────────────────────────────────┐
│                  ▼     Сервер (Node.js / Bun)                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 (App Router, port 3000)           │   │
│  │  ┌─────────────┐  ┌───────────────┐  ┌────────────────┐  │   │
│  │  │ API Routes  │  │ excel-server  │  │  Prisma ORM    │  │   │
│  │  │ /api/*      │  │ (55KB, in-mem)│  │  (SQLite WAL)  │  │   │
│  │  └──────┬──────┘  └───────┬───────┘  └───────┬────────┘  │   │
│  │         │                 │                    │           │   │
│  │  ┌──────┴──────┐          │                    │           │   │
│  │  │ NextAuth.js │          │                    │           │   │
│  │  │ /api/auth/* │          │                    │           │   │
│  │  └─────────────┘          │                    │           │   │
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
| **ORM** | Prisma | 6.11.1 (пин) | Доступ к SQLite |
| **БД** | SQLite (WAL mode) | — | Персистентное хранение, многопользовательский доступ |
| **Excel** | SheetJS (xlsx) | 0.18.5 | Чтение/запись XLSX/XLS файлов |
| **Графики** | Recharts | 2.x | Визуализация данных |
| **Анимации** | Framer Motion | 12.x | Плавные переходы |
| **Формы** | React Hook Form + Zod | 7.x / 4.x | Валидация форм |
| **Drag & Drop** | dnd-kit | 6.x | Перетаскивание элементов |
| **Аутентификация** | NextAuth.js | 4.24.11 | JWT-сессии (8ч), credentials provider |
| **Хеширование паролей** | bcryptjs | 3.0.3 | bcrypt с salt rounds = 10 |
| **AI SDK** | z-ai-web-dev-sdk | 0.0.17 | LLM, VLM, TTS, ASR, генерация изображений |
| **Реверс-прокси** | Caddy | — | Маршрутизация, HTTPS |
| **OLAP Аналитика** | DuckDB | 1.4.4 | In-process OLAP, чтение SQLite через sqlite_scan() |
| **Архивация (subprocess)** | better-sqlite3 | 12.x | Прямой доступ к SQLite в отдельном процессе |

### 2.3. Ключевые архитектурные решения

1. **In-memory кеш вместо полной БД** — Основная база сотрудников (113K+ записей) хранится в оперативной памяти через `globalThis` для переживания HMR. SQLite используется для метаданных файлов, пользователей и аудита.

2. **JSON+base64 вместо multipart/form-data** — Caddy-прокси ломает multipart-запросы, поэтому все загрузки файлов используют JSON с base64-кодированием.

3. **Динамический импорт панелей** — Все панели загружаются через `next/dynamic` с `ssr: false` для уменьшения размера начального бандла.

4. **Декомиссия FastAPI** — Изначально система имела Python FastAPI бэкенд на порту 3031. Вся логика перенесена в `excel-server.ts` (Node.js), Python-бэкенд не запускается.

5. **Worker Thread для тяжёлых операций** — Загрузка основной базы данных вынесена в Worker Thread для предотвращения блокировки event loop.

6. **SQLite WAL + retry** — Для поддержки 20 одновременных пользователей включён WAL-режим, `busy_timeout=10с`, `synchronous=NORMAL`, и реализован `withRetry()` wrapper с экспоненциальной задержкой (см. раздел 6).

7. **Многопользовательская изоляция** — Каждая модель данных имеет поле `userId` для привязки к пользователю. Поле `workspace` на User позволяет группировать пользователей по рабочим пространствам (например, `vsm`, `sk`, `default`).

---

## 3. Структура проекта

```
/home/z/my-project/
│
├── .env                                    # DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
├── Caddyfile                               # Реверс-прокси: :81 → :3000
├── package.json                            # Зависимости и скрипты
├── next.config.ts                          # standalone output, 100MB body limit, turbopackUseSystemTlsCerts
├── tsconfig.json                           # TypeScript конфигурация
├── tailwind.config.ts                      # Tailwind CSS конфигурация
├── components.json                         # Shadcn/UI: new-york стиль
│
├── prisma/
│   ├── schema.prisma                       # 8 моделей: User, ExcelFile, MainDatabase, TicketCost, Macro, Operation, TicketExpense, FileRecord, RatingPeriod
│   └── seed.ts                             # Создание admin/admin123, user1/user123, user2/user123
│
├── db/
│   ├── custom.db                           # SQLite файл базы данных (WAL mode)
│   ├── custom.db-wal                       # Write-Ahead Log (создаётся автоматически)
│   └── custom.db-shm                       # Shared memory (создаётся автоматически)
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
│       ├── browse_dialog.py                #   Stub (tkinter недоступен в headless)
│       ├── auth_middleware.py
│       ├── celery_app.py / celery_tasks.py / task_queue.py
│       ├── deps.py / data_paths.py
│       ├── routers/                        #   API-роутеры
│       ├── requirements.txt                #   Python-зависимости
│       └── run.sh / start.sh               #   Скрипты запуска
│
├── scripts/
│   ├── excel-loader.cjs                    # Child-process Excel загрузчик (Node.js)
│   └── archive.js                          # ✅ Standalone архивация (better-sqlite3, subprocess)
│
└── src/
    ├── app/
    │   ├── globals.css                     # 3 темы, анимации, утилиты
    │   ├── layout.tsx                      # Root layout: ThemeProvider + AuthProvider + Toaster
    │   ├── page.tsx                        # Главная SPA-страница (~1100 строк)
    │   ├── login/
    │   │   └── page.tsx                    # ✅ Страница входа (NextAuth credentials)
    │   └── api/                            # API-маршруты
    │       ├── route.ts                    #   GET → "Hello, world!"
    │       ├── health/route.ts             #   GET → healthCheck()
    │       ├── auth/
    │       │   └── [...nextauth]/route.ts  #   ✅ NextAuth.js handler (credentials provider)
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
    │   ├── ThemeInitializer.tsx            # Инициализация темы на клиенте
    │   ├── auth-provider.tsx               # ✅ SessionProvider (next-auth/react)
    │   ├── theme-toggle.tsx               # Переключатель темы
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
    │   │   └── [и другие...]
    │   └── ui/                             # 50+ Shadcn/UI примитивов
    │
    ├── hooks/
    │   ├── use-mobile.ts                   # Определение мобильного устройства
    │   ├── use-theme.ts                    # Хук темы
    │   └── use-toast.ts                    # Хук уведомлений
    │
    ├── lib/
    │   ├── db.ts                           # ✅ Prisma Client + WAL + busy_timeout + withRetry()
    │   ├── auth.ts                         # ✅ getCurrentUser() для server components
    │   ├── worker-pool.ts                  # ✅ Worker Thread Pool (4 воркера, FIFO, прогресс)
    │   ├── duckdb.ts                       # ✅ DuckDB аналитика (sqlite_scan, cross-period)
    │   ├── archive.ts                      # ✅ Месячная архивация (archive-YYYY-MM.db)
    │   ├── workers/
    │   │   └── excel-parser.worker.ts      # ✅ Worker: парсинг Excel (4 типа задач)
    │   ├── excel-backend.ts                # FastAPI клиент (localhost:3031, legacy)
    │   ├── excel-server.ts                 # Ядро обработки Excel (55KB!)
    │   ├── safe-fetch.ts                   # Безопасный JSON-fetch с обработкой ошибок
    │   ├── upload-helper.ts                # Утилита загрузки файлов (в /upload)
    │   └── utils.ts                        # cn(), formatDateDDMMYYYY(), formatDateDDMMYYYYHHmmss()
    │
    ├── middleware.ts                       # ✅ withAuth: защита всех маршрутов кроме /login, /api/auth
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
- **Файл БД:** `db/custom.db`
- **Строка подключения:** `DATABASE_URL=file:/home/z/my-project/db/custom.db` (Linux) или `file:C:/My_Project/vsm-code-only/db/custom.db` (Windows)
- **Режим:** WAL (Write-Ahead Logging) — включён программно в `src/lib/db.ts`
- **Singleton клиент:** `src/lib/db.ts` — `import { db, withRetry, withRetryTx } from '@/lib/db'`

### 4.2. Модели данных

#### User — Пользователь системы (НОВОЕ)

**Файл:** `prisma/schema.prisma`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Уникальный идентификатор |
| `username` | String (@unique) | Логин (уникальный) |
| `passwordHash` | String | bcrypt-хеш пароля (salt rounds = 10) |
| `displayName` | String (default: "") | Отображаемое имя |
| `role` | String (default: "user") | Роль: `admin` или `user` |
| `workspace` | String (default: "default") | Рабочее пространство: `default`, `vsm`, `sk` и т.д. |
| `isActive` | Boolean (default: true) | Активна ли учётная запись |
| `lastLoginAt` | DateTime? | Время последнего входа |
| `createdAt` | DateTime | Время создания |
| `updatedAt` | DateTime | Время обновления |

**Связи:** `excelFiles`, `mainDatabases`, `fileRecords`, `operations`, `ticketCosts`, `ticketExpenses`, `ratingPeriods` (cascade delete)

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
| `userId` | String? | ✅ Привязка к пользователю (изоляция) |

#### MainDatabase — Основная база данных сотрудников (метаданные)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Уникальный идентификатор |
| `name` | String | Системное имя файла |
| `originalName` | String | Оригинальное имя |
| `filePath` | String | Путь к файлу |
| `totalRows` | Int (default: 0) | Общее количество строк (113,000+) |
| `totalCols` | Int (default: 0) | Количество столбцов |
| `sheetName` | String? | Имя листа |
| `fileSize` | Int (default: 0) | Размер файла |
| `keyColumns` | String (default: "[]") | JSON-массив ключевых столбцов |
| `isActive` | Boolean (default: false) | Активная база |
| `loadedAt` | DateTime | Время загрузки |
| `updatedAt` | DateTime | Время обновления |
| `userId` | String? | ✅ Привязка к пользователю |

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
| `userId` | String? | ✅ Привязка к пользователю |

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
| `userId` | String? | ✅ Кто выполнил операцию |

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
| `userId` | String? | ✅ Привязка к пользователю |

#### FileRecord — Реестр файлов (НОВОЕ)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `fileName` | String | Имя файла |
| `originalName` | String | Оригинальное имя |
| `filePath` | String | Путь |
| `fileSize` | Int (default: 0) | Размер |
| `mimeType` | String (default: "") | MIME-тип |
| `fileType` | String (default: "other") | Тип: main-db, reference, calendar, ticket, other |
| `status` | String (default: "uploaded") | Статус: uploaded, processing, active, error |
| `uploadedAt` | DateTime | Время загрузки |
| `updatedAt` | DateTime | Время обновления |
| `metadata` | String? | JSON-строка с доп. данными |
| `userId` | String? | ✅ Привязка к пользователю |

#### RatingPeriod — Реестр оценок по полугодиям (НОВОЕ)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `year` | Int | Год (2024, 2025, 2026...) |
| `half` | Int | Полугодие: 1 или 2 |
| `label` | String | Метка: "2024 Реестр за 1 полугодие" |
| `fileName` | String | Имя файла |
| `originalName` | String | Оригинальное имя |
| `filePath` | String | Путь |
| `fileSize` | Int (default: 0) | Размер |
| `totalRows` | Int (default: 0) | Количество строк |
| `status` | String (default: "uploaded") | Статус |
| `uploadedAt` | DateTime | Время загрузки |
| `updatedAt` | DateTime | Время обновления |
| `userId` | String? | ✅ Привязка к пользователю |

**Уникальный индекс:** `@@unique([year, half])` — один файл на полугодие

#### DailyTrackingRecord — Ежедневный учёт персонала (НОВОЕ)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `fileRecordId` | String | Ссылка на FileRecord |
| `userId` | String? | Привязка к пользователю |
| `employeeFio` | String | ФИО сотрудника |
| `employeeTn` | String? | Табельный номер |
| `site` | String | Площадка (ВСП, СК, Геленджик) |
| `status` | String | "на объекте" / "в командировке" / "в отпуске" / "уволен" |
| `eventDate` | DateTime | Дата события |
| `department` | String? | Подразделение |
| `position` | String? | Должность |
| `comment` | String? | Комментарий |
| `sourceFile` | String | Имя исходного файла |
| `sourceRow` | Int | Строка в исходнике |

**Индексы:** `[eventDate, site]`, `[userId, eventDate]`, `[employeeTn]`, `[site, eventDate]`

#### FlightEvent — Рейсы Календаря Прилёт-Вылет (НОВОЕ)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `fileRecordId` | String | Ссылка на FileRecord |
| `userId` | String? | Привязка к пользователю |
| `employeeFio` | String | ФИО сотрудника |
| `employeeTn` | String? | Табельный номер |
| `passport` | String? | Номер паспорта |
| `flightType` | String | "arrival" / "departure" |
| `flightDate` | DateTime | Дата рейса |
| `route` | String? | Маршрут |
| `flightNumber` | String? | Номер рейса |
| `carrier` | String? | Перевозчик |
| `ticketPrice` | Float (default: 0) | Стоимость билета |
| `sheetName` | String | Из какого листа (1-30) |
| `sourceRow` | Int | Строка в исходнике |

**Индексы:** `[flightDate, flightType]`, `[userId, flightDate]`, `[employeeTn]`, `[fileRecordId]`

#### TicketRecord — Обработанные записи билетов (НОВОЕ)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `fileRecordId` | String | Ссылка на FileRecord |
| `userId` | String? | Привязка к пользователю |
| `org` | String | "vsm" / "sk" |
| `employeeFio` | String? | ФИО |
| `employeeFioEn` | String? | ФИО на английском |
| `employeeTn` | String? | Табельный номер |
| `passport` | String? | Номер паспорта |
| `tabNumber1C` | String? | Табельный номер 1С |
| `fio1C` | String? | ФИО 1С |
| `site` | String? | Площадка |
| `route` | String? | Маршрут |
| `flightDate` | DateTime? | Дата рейса |
| `ticketPrice` | Float (default: 0) | Стоимость |
| `ticketType` | String? | Тип билета |
| `ticketNumber` | String? | Номер билета |
| `sourceFile` | String | Исходный файл |
| `sourceRow` | Int | Строка в исходнике |

**Индексы:** `[org, flightDate]`, `[userId, org]`, `[employeeTn]`, `[fileRecordId]`

#### RatingRecord — Оценки KPI сотрудников (НОВОЕ)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id @default(cuid())) | Идентификатор |
| `ratingPeriodId` | String? | Ссылка на RatingPeriod |
| `userId` | String? | Привязка к пользователю |
| `employeeFio` | String | ФИО |
| `employeeTn` | String? | Табельный номер |
| `department` | String? | Подразделение |
| `position` | String? | Должность |
| `score` | Float (default: 0) | Оценка (1-5) |
| `period` | String? | Период оценки |
| `sourceFile` | String | Исходный файл |
| `sourceRow` | Int | Строка в исходнике |

**Индексы:** `[ratingPeriodId]`, `[userId]`, `[employeeTn]`, `[department]`

### 4.3. Важное замечание о хранении данных

**113,000+ записей сотрудников НЕ хранятся в SQLite.** Они хранятся в **in-memory кеше** через `globalThis`. SQLite используется для:
- Метаданных файлов (имя, путь, размер, статус)
- Пользователей и их хешей паролей
- Аудит-лога операций
- Реестра файлов по типам
- **Доменных данных:** DailyTrackingRecord, FlightEvent, TicketRecord, RatingRecord
- **Архивов:** archive-YYYY-MM.db (месячные архивы доменных данных)

---

## 5. Аутентификация и многопользовательский режим

### 5.1. NextAuth.js — Credentials Provider

**Файл:** `src/app/api/auth/[...nextauth]/route.ts`

Система аутентификации построена на **NextAuth.js v4** с провайдером **Credentials** (логин/пароль).

**Конфигурация:**

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: { username, password },
      async authorize(credentials) {
        // 1. Поиск пользователя в БД (с retry для WAL)
        const user = await withRetry(() =>
          db.user.findUnique({ where: { username: credentials.username } })
        )
        // 2. Проверка пароля через bcrypt
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        // 3. Обновление lastLoginAt
        // 4. Возврат { id, name, role, workspace }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 часов
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
```

**Поток аутентификации:**

```
Пользователь → /login (страница входа)
  ↓ ввод логина/пароля
  ↓ signIn('credentials', { redirect: false })
  ↓ POST /api/auth/callback/credentials
  ↓ authorize() → bcrypt.compare() → JWT token
  ↓ Cookie: next-auth.session-token
  ↓ Redirect → / (защищённая страница)
```

### 5.2. Middleware — защита маршрутов

**Файл:** `src/middleware.ts`

```typescript
export default withAuth(
  function middleware() { return NextResponse.next() },
  { pages: { signIn: '/login' } }
)

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
}
```

**Защищены:** все маршруты, кроме:
- `/api/auth/*` — endpoints NextAuth
- `/login` — страница входа
- `/_next/static`, `/_next/image` — статика
- `/favicon.ico`

### 5.3. Страница входа

**Файл:** `src/app/login/page.tsx`

- Зелёная корпоративная тема (Shield иконка)
- Поля: логин, пароль
- Обработка ошибок: «Неверный логин или пароль», «Ошибка подключения»
- Loading state с спиннером
- После успеха — редирект на `/`

### 5.4. SessionProvider

**Файл:** `src/components/auth-provider.tsx`

Оборачивает всё приложение в `SessionProvider` из `next-auth/react`. Подключён в `layout.tsx`:

```tsx
<ThemeProvider>
  <AuthProvider>
    <ThemeInitializer />
    {children}
    <Toaster />
  </AuthProvider>
</ThemeProvider>
```

### 5.5. getCurrentUser() — server-side helper

**Файл:** `src/lib/auth.ts`

```typescript
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user as {
    id: string
    name: string
    email: string
    role: string      // "admin" | "user"
    workspace: string // "default" | "vsm" | "sk" | ...
  } | null
}
```

Используется в server components и API routes для получения текущего пользователя.

### 5.6. Seed — стартовые пользователи

**Файл:** `prisma/seed.ts`
**Команда:** `bun run db:seed`

Создаёт 3 пользователей:

| Логин | Пароль | Роль | Workspace | DisplayName |
|-------|--------|------|-----------|-------------|
| `admin` | `admin123` | admin | default | Администратор |
| `user1` | `user123` | user | vsm | Пользователь 1 |
| `user2` | `user123` | user | sk | Пользователь 2 |

Пароли хешируются через `bcrypt.hash(password, 10)`.

### 5.7. Изоляция рабочих пространств

Каждая модель данных имеет поле `userId` (опциональное для обратной совместимости). При создании записи:

```typescript
const user = await getCurrentUser()
const file = await withRetry(() =>
  db.excelFile.create({
    data: { ...fileData, userId: user?.id }
  })
)
```

При чтении — фильтрация по `userId`:

```typescript
const files = await withRetry(() =>
  db.excelFile.findMany({ where: { userId: user?.id } })
)
```

Поле `workspace` на User позволяет группировать пользователей по организациям (ВСП, СК, Геленджик и т.д.).

---

## 6. SQLite WAL: настройка для 20 пользователей

### 6.1. Проблема

SQLite по умолчанию использует режим `DELETE` journal, при котором:
- Писатель блокирует всю БД для других писателей и читателей
- При 20 одновременных пользователях возникают ошибки `SQLITE_BUSY`
- Высокая вероятность «database is locked»

### 6.2. Решение

**Файл:** `src/lib/db.ts`

Включены следующие PRAGMA при инициализации:

```typescript
const SQLITE_PRAGMAS = [
  `PRAGMA journal_mode=WAL`,        // Readers не блокируют writers (и наоборот)
  `PRAGMA busy_timeout=10000`,      // Ждать до 10с вместо немедленной ошибки SQLITE_BUSY
  `PRAGMA synchronous=NORMAL`,      // Безопасно в WAL, быстрее чем FULL
  `PRAGMA cache_size=-20000`,       // 20MB кеш страниц (по умолчанию 2MB)
  `PRAGMA temp_store=MEMORY`,       // Временные таблицы и индексы в RAM
  `PRAGMA mmap_size=268435456`,     // Memory-mapped I/O до 256MB
  `PRAGMA foreign_keys=ON`,         // Включить внешние ключи
]
```

**Инициализация** запускается один раз при первом обращении:

```typescript
let prismaInitialized = false

async function initSqlite() {
  if (prismaInitialized) return
  prismaInitialized = true
  for (const pragma of SQLITE_PRAGMAS) {
    try {
      await db.$executeRawUnsafe(pragma)
    } catch {
      // Игнорируем — возможно, не SQLite
    }
  }
}

// Fire and forget
initSqlite().catch(() => {})
```

### 6.3. withRetry() — retry wrapper для операций

Даже с `busy_timeout` SQLite может периодически выбрасывать «database is locked» при высокой нагрузке. `withRetry()` реализует retry с экспоненциальной задержкой:

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number       // default: 5
    baseDelayMs?: number   // default: 50
    maxDelayMs?: number    // default: 2000
  } = {},
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isLockError = msg.includes('locked') || msg.includes('busy')
      if (!isLockError || attempt === retries) throw error

      // Экспоненциальная задержка с джиттером
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 50
      )
      await new Promise(r => setTimeout(r, delay))
    }
  }
}
```

**Паттерны retry-ошибок:**
- `locked`
- `busy`
- `sqlite_busy`
- `database is locked`
- `could not obtain lock`
- `transaction conflicts`

**Задержки (с базой 50ms):**
| Попытка | Задержка |
|---------|----------|
| 1 | ~50ms + джиттер |
| 2 | ~100ms + джиттер |
| 3 | ~200ms + джиттер |
| 4 | ~400ms + джиттер |
| 5 | ~800ms + джиттер |

### 6.4. withRetryTx() — retry для транзакций

```typescript
export async function withRetryTx<T>(
  fn: (tx) => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<T> {
  return withRetry(() => db.$transaction(fn), options)
}
```

### 6.5. Рекомендации по использованию

**Всегда оборачивайте БД-операции в `withRetry`:**

```typescript
// ❌ Плохо — может упасть при 20 пользователях
const user = await db.user.findUnique({ where: { id } })

// ✅ Хорошо — retry при блокировке
const user = await withRetry(() => db.user.findUnique({ where: { id } }))
```

**Для транзакций:**

```typescript
const result = await withRetryTx(async (tx) => {
  const user = await tx.user.create({ data: { ... } })
  await tx.fileRecord.create({ data: { userId: user.id, ... } })
  return user
})
```

### 6.6. Сравнение режимов SQLite

| Режим | Писателей | Читателей | Изоляция | Стоимость | Подходит для |
|-------|-----------|-----------|----------|-----------|-------------|
| DELETE (default) | 1 (блокирует всё) | 0 во время записи | Полная | 0₽ | 1-3 пользователя |
| **WAL (наш выбор)** | **1, но не блокирует чтение** | **Много** | **Snapshot** | **0₽** | **До 20 пользователей** |
| PostgreSQL | Много | Много | MVCC | Платно/RU-доступ | 50+ пользователей |

### 6.7. Файлы WAL

При включении WAL создаются два дополнительных файла рядом с `custom.db`:

| Файл | Назначение |
|------|-----------|
| `db/custom.db` | Основная база данных |
| `db/custom.db-wal` | Write-Ahead Log (журнал операций) |
| `db/custom.db-shm` | Shared memory index для WAL |

**Важно:** Не удаляйте `.wal` и `.shm` файлы во время работы приложения. При корректном закрытии SQLite автоматически выполняет checkpoint и переносит данные из WAL в основной файл.

---

## 7. Worker Thread Pool

**Файл:** `src/lib/worker-pool.ts`
**Worker script:** `src/lib/workers/excel-parser.worker.ts`

### 7.1. Проблема

При 150+ файлов/день и файлах с 30 листами парсинг Excel в основном потоке блокирует event loop → 502 Bad Gateway для всех пользователей.

### 7.2. Решение: WorkerPool

Пул из N worker-потоков (по умолчанию = min(CPU cores, 4)), которые парсят Excel в фоновых потоках:

```
API Route → workerPool.execute(task) → Worker Thread (парсинг XLSX)
         ← Promise<WorkerResult>     ← Progress → UI (onProgress callback)
```

### 7.3. Поддерживаемые типы задач

| Type | Описание | Прогресс |
|------|----------|----------|
| `parse-excel` | Универсальный парсинг (все листы) | По листам |
| `parse-daily` | Ежедневный учёт (1 лист) | По завершении |
| `parse-calendar` | Календарь (до 30 листов) | По листам |
| `parse-tickets` | Билеты ВСП/СК | По завершении |

### 7.4. API WorkerPool

```typescript
import { workerPool, type WorkerTask } from '@/lib/worker-pool'

const result = await workerPool.execute({
  id: 'task-1',
  type: 'parse-calendar',
  payload: { filePath: '/data/calendar.xlsx' },
  onProgress: (percent, message) => {
    console.log(`${percent}%: ${message}`) // "50%: Лист 15/30: Июль"
  },
  signal: abortController.signal, // Опциональная отмена
})
// result: { taskId, success, data, error?, duration }
```

### 7.5. Ключевые возможности

- **FIFO очередь** — задачи ждут свободного worker'а
- **Progress reporting** — callback `onProgress` из worker'а (критично для 30-листовых файлов)
- **AbortSignal** — отмена задачи до или во время выполнения
- **Auto-restart** — упавший worker автоматически перезапускается
- **HMR-safe singleton** — пул переживает hot reload (как `db.ts`)
- **TaskId correlation** — каждое сообщение от worker'а содержит `taskId`

### 7.6. Мониторинг

```typescript
const { total, busy, queued } = workerPool.status
// { total: 4, busy: 2, queued: 5 }
```

---

## 8. DuckDB: аналитические запросы

**Файл:** `src/lib/duckdb.ts`
**API route:** `src/app/api/analytics/route.ts`

### 8.1. Проблема

SQLite оптимизирован для OLTP (точечные чтения/записи). Аналитические запросы (агрегация по миллионам строк, GROUP BY, UNION ALL) выполняются медленно.

### 8.2. Решение: DuckDB

DuckDB — in-process OLAP база данных, запускается без сервера, читает SQLite напрямую через `sqlite_scan()`.

```typescript
import { duckQuery } from '@/lib/duckdb'

// Аналитика по всем рейсам за год (DuckDB в 100× быстрее SQLite)
const result = await duckQuery(`
  SELECT site, COUNT(*) as cnt, AVG(ticketPrice) as avg_price
  FROM sqlite_scan('/path/to/custom.db', 'FlightEvent')
  WHERE flightDate >= '2025-01-01' AND flightDate < '2026-01-01'
  GROUP BY site
  ORDER BY cnt DESC
`)
```

### 8.3. Ключевые функции

| Функция | Описание |
|---------|----------|
| `duckQuery(sql, params?)` | Выполнить SQL, вернуть массив строк |
| `duckQueryOne(sql, params?)` | Выполнить SQL, вернуть одну строку |
| `buildCrossPeriodQuery(table, opts)` | Построить UNION ALL по основной + архивным БД |
| `listArchives()` | Список доступных архивов (YYYY-MM) |
| `getMainDbPath()` | Путь к основной БД |
| `getArchiveDbPath(ym)` | Путь к архиву |
| `archiveExists(ym)` | Проверить существование архива |
| `closeDuckDB()` | Закрыть соединение (graceful shutdown) |

### 8.4. Cross-period запросы

```typescript
// Запрос по текущей БД + всем архивам за указанный период
const sql = buildCrossPeriodQuery('FlightEvent', {
  dateColumn: 'flightDate',
  startDate: '2024-06-01',
  endDate: '2025-06-30',
  select: 'site, COUNT(*) as total_flights',
  groupBy: 'site',
})
const result = await duckQuery(sql)
```

### 8.5. API: `/api/analytics`

| Метод | Параметры | Описание |
|-------|-----------|----------|
| `POST` | `{ query: "SELECT ..." }` | Raw SQL (только SELECT) |
| `POST` | `{ table, dateColumn, startDate, endDate, ... }` | Builder mode |
| `GET` | — | Список архивов + путь к основной БД |

**Безопасность:** Разрешены только `SELECT` и `WITH` запросы. INSERT/UPDATE/DELETE → 403.

---

## 9. Архивация: месячные архивы

**Файл:** `src/lib/archive.ts`
**Script:** `scripts/archive.js` (standalone, better-sqlite3)
**API route:** `src/app/api/archive/route.ts`

### 9.1. Проблема

При 150 файлов/день основная БД вырастет до миллионов строк за год → замедление запросов, раздувание файла, долгий VACUUM.

### 9.2. Решение: месячные архивы

Каждый 1-й день месяца данные за прошлый месяц переносятся в `archive-YYYY-MM.db`:

```
custom.db (текущие данные ~800K строк)
├── archive-2025-01.db (read-only)
├── archive-2025-02.db (read-only)
├── archive-2025-03.db (read-only)
└── ...
```

### 9.3. Архивируемые таблицы

| Таблица | Столбец даты | Объём/мес |
|---------|-------------|-----------|
| `DailyTrackingRecord` | `eventDate` | ~13K-52K строк (26 файлов) |
| `FlightEvent` | `flightDate` | ~10K-40K строк |
| `TicketRecord` | `flightDate` | ~5K-20K строк |
| `RatingRecord` | `createdAt` | ~1K-5K строк |

### 9.4. Процесс архивации

1. Создаётся `archive-YYYY-MM.db` с аналогичной схемой
2. Данные за указанный месяц COPY в архив (transaction)
3. Удаление скопированных данных из основной БД
4. `VACUUM` обеих БД для сжатия
5. Создание индексов в архиве
6. Если ошибка — partial archive удаляется (atomic)

### 9.5. API: `/api/archive`

| Метод | Параметры | Описание |
|-------|-----------|----------|
| `POST` | `{ yearMonth: "2025-01" }` | Архивировать конкретный месяц |
| `POST` | `{ auto: true }` | Авто-архивация прошлого месяца (для cron) |
| `GET` | — | Список архивов + размер |
| `GET` | `?yearMonth=2025-01&table=FlightEvent` | Превью записей из архива |

### 9.6. Автоматическая архивация (Cron)

**Расписание:** 1-е число каждого месяца в 02:00 (Europe/Moscow)

Cron-задача вызывает `POST /api/archive {"auto":true}`.

### 9.7. Запросы к архивам

Архивы — read-only SQLite файлы. Запрашиваются через:
1. **DuckDB `sqlite_scan()`** — для аналитических запросов
2. **`queryArchive(yearMonth, sql)`** — для точечных запросов через better-sqlite3
3. **`buildCrossPeriodQuery()`** — автоматический UNION ALL по текущей + архивным БД

### 9.8. Прогноз по объёмам

| Период | Строк в current DB | Архивов | Производительность |
|--------|-------------------|---------|-------------------|
| Месяц 1 | ~800K | 0 | ✅ Мгновенно |
| Месяц 6 | ~800K | 5 | ✅ Мгновенно |
| Год 1 | ~800K | 11 | ✅ + DuckDB для аналитики |
| Год 3 | ~800K | 35 | ✅ Текущая БД та же |

---

## 10. Состояние приложения (Zustand Stores)

### 10.1. useAppStore (основной store)

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

  // Флаг онлайн-статуса бэкенда
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

### 10.2. useTaskStore (менеджер задач)

**Файл:** `src/store/task-store.ts`

Продвинутый менеджер задач с Map-хранилищем. Поддерживает:

- **Типы задач:** upload, download, processing, export, load, validate, other
- **Под-шаги:** Каждая задача может иметь массив `TaskStep[]` с отдельными статусами
- **AbortController:** Каждая задача имеет сигнал отмены для fetch-запросов
- **Auto-dismiss:** Завершённые задачи автоматически удаляются через 5000мс
- **Автоочистка:** Каждые 30 секунд удаляются завершённые задачи

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

**Важно:** Проверки статуса (`fetchStatus`) выполняются **молча** — без создания задач в `useTaskStore`, чтобы избежать бесконечных циклов «Запрос статуса...».

---

## 11. Вкладки и панели — подробное описание

### 11.1. ✅ Рабочие панели

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
- Backend health: каждые 30 сек (`/api/health`) — **молча**
- DB status: каждые 60 сек (`/api/main-db/status`) — **молча**
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
- Проверка статуса — сначала Node.js `/api/main-db/status`, затем Python backend (молча)

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
- Очередь загрузки — локальный React state (не глобальный store), чтобы избежать бесконечных ре-рендеров

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
- **Fallback площадки:** Когда бэкенд офлайн, показывает дефолтные площадки (ВСП, СК, Геленджик)
- **Загрузка файлов:** Доступна даже при выборе «Все площадки» (не блокирует)
- **UI-состояния:** Оранжевый баннер «Бэкенд не запущен» с подсказкой команды запуска

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

**Важно:** Сообщения о недоступности бэкенда логируются как `logInfo` (ожидаемое состояние), а не `logError`.

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
- Рабочая директория: `/home/z/my-project/upload/` (Linux) или `process.cwd()/upload/` (Windows)

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

### 11.2. 🚧 Вкладки в разработке (UnderDevelopment)

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

## 12. API-маршруты — полный справочник

### 12.1. Аутентификация (NextAuth.js)

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js handler (вход, выход, сессия, callback) |
| `/api/auth/signin` | GET | Страница входа (redirect на /login) |
| `/api/auth/signout` | POST | Выход из системы |
| `/api/auth/session` | GET | Текущая сессия (JSON) |

### 12.2. Корневые маршруты

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api` | GET | Возвращает "Hello, world!" |
| `/api/health` | GET | Проверка здоровья |
| `/api/[...path]` | * | Catch-all 404 (бывший FastAPI прокси) |

### 12.3. Основная база данных (Main DB)

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/main-db/status` | GET | Статус загрузки БД | — |
| `/api/main-db/data` | POST | Запрос данных с пагинацией | `{ page, page_size, key_columns_only, search, sort_column, sort_direction, filter_column, filter_value, filters }` |
| `/api/main-db/load` | POST | Загрузка Excel → in-memory | `{ filePath? }` |
| `/api/main-db/columns` | GET | Метаданные столбцов | — |
| `/api/main-db/stats` | GET | Статистика БД | — |
| `/api/main-db/clear` | DELETE | Очистка in-memory базы | — |

### 12.4. Билеты (Tickets)

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

### 12.5. Excel-файлы

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/excel/list` | GET | Список Excel-файлов (Prisma) |
| `/api/excel/files` | GET | Список файлов с диска |
| `/api/excel/files/[id]` | GET/DELETE | Получить/удалить файл |
| `/api/excel/sheet-data` | GET | Чтение данных листа |
| `/api/excel/[...path]` | * | Прокси к FastAPI (legacy) |

### 12.6. Файловый менеджер

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/files` | GET | Список/поиск/скачивание | `?action=list\|search\|download&path=&q=` |
| `/api/files` | DELETE | Удаление файла/папки | `{ path }` |
| `/api/files` | POST | Загрузка/создание папки/переименование | `{ action: upload\|mkdir\|rename, ... }` |

### 12.7. Утилиты

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/utilities` | GET | Список/исходник/скачивание | `?action=list\|source\|download&name=` |
| `/api/utilities` | POST | Запуск утилиты | `{ name, args, timeout? }` (default timeout: 10 сек) |

### 12.8. Прочие

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/main-database/list` | GET | Список MainDatabase (Prisma) |
| `/api/main-database/status` | GET | Активная MainDatabase (Prisma) |
| `/api/ticket-expenses/list` | GET | Список TicketExpense (Prisma) |
| `/api/daily-accounting/list` | GET | Список записей (Prisma) |
| `/api/reports/filters` | GET | Опции фильтров отчётов |
| `/api/reports/generate` | POST | Генерация отчёта |
| `/api/excel-proxy` | * | Прокси к FastAPI 3031 (legacy) |

### 12.9. Аналитика (DuckDB) — НОВОЕ

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/analytics` | POST | Аналитический SQL-запрос | `{ query }` или `{ table, dateColumn, startDate, endDate }` |
| `/api/analytics` | GET | Метаданные: список архивов, путь к БД | — |

**Безопасность:** Только `SELECT`/`WITH` запросы. INSERT/UPDATE/DELETE → 403.

### 12.10. Архивация — НОВОЕ

| Маршрут | Метод | Описание | Параметры |
|---------|-------|----------|-----------|
| `/api/archive` | POST | Архивация данных за месяц | `{ yearMonth: "2025-01" }` или `{ auto: true }` |
| `/api/archive` | GET | Список архивов + размер | — |
| `/api/archive` | GET | Превью записей из архива | `?yearMonth=2025-01&table=FlightEvent&limit=100` |

---

## 13. Серверная обработка Excel (excel-server.ts)

**Файл:** `src/lib/excel-server.ts` (55KB!)
**Назначение:** Полная замена Python FastAPI бэкенда

### 13.1. In-memory кеши

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

### 13.2. Экспортируемые функции

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

### 13.3. Внутренние алгоритмы

- **readExcelToRows()** — Стандартное чтение через SheetJS
- **readTicketExcelToRows()** — Чтение с авто-поиском строки заголовков (сканирует первые 15 строк)
- **transliterateLatToCyr() / transliterateCyrToLat()** — Кириллица ↔ Латиница
- **levenshteinDistance()** — Расстояние Левенштейна (DP-алгоритм)
- **similarityPercent()** — Процент схожести (0-100), порог 70% для match
- **detectMonth()** — Извлечение месяца из имени файла
- **detectCategory()** — Категория по ключевым словам

### 13.4. Ключевые столбцы

13 ключевых столбцов по индексам: `[0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13]`

---

## 14. Python-утилиты

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

## 15. Боковая панель (Sidebar)

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

## 16. Главная страница (Dashboard)

**Компонент:** Интегрирован в `src/app/page.tsx`

Два режима:
1. **Dashboard** — Приветствие, часы, бегущая строка, статистика, модули, таблицы, монитор здоровья
2. **Панель** — Хлебные крошки + динамически загруженная панель

Динамический импорт: все панели через `next/dynamic` с `ssr: false`

---

## 17. Темы оформления

**3 темы:**
1. **Color (Amber/Orange)** — Корпоративная VSM, oklch-based тёплые тона
2. **Light** — Минималистичная светлая
3. **Dark** — Тёмная

**CSS-анимации:** ticker, card-entrance, pulse-glow, progress-fill, slide-in-right, line-clamp

---

## 18. Инфраструктура и развёртывание

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
- `output: "standalone"`, `bodySizeLimit: 100MB`, `ignoreBuildErrors: true`
- `experimental.turbopackUseSystemTlsCerts: true` — для обхода SSL-проблем с корпоративными прокси

### Переменные окружения (.env)

```bash
# База данных
DATABASE_URL=file:/home/z/my-project/db/custom.db

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=vsm-dev-secret-change-in-production
```

### Скрипты

| Команда | Описание |
|---------|----------|
| `bun run dev` | Dev-сервер :3000 |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run db:push` | Push Prisma схемы в БД |
| `bun run db:generate` | Генерация Prisma клиента |
| `bun run db:seed` | Создание стартовых пользователей |

### Формат дат
Все даты в формате **ДД.ММ.ГГГГ** через `formatDateDDMMYYYY()` из `src/lib/utils.ts`

---

## 19. Локальный запуск на Windows

### 19.1. Требования

- **Node.js** 20+ или **Bun** latest
- **Python** 3.10+ (для утилит, опционально)
- **Git** (для клонирования репозитория)

### 19.2. Установка

```powershell
# 1. Клонировать репозиторий
cd C:\My_Project
git clone https://github.com/VelesstroyMontazh/VSM_OMIK_2.git vsm-code-only
cd vsm-code-only

# 2. Установить зависимости
bun install
# или: npm install

# 3. Настроить .env (см. ниже)

# 4. Сгенерировать Prisma клиент
npx prisma generate

# 5. Создать БД и применить схему
npx prisma db push

# 6. Создать стартовых пользователей
bun run db:seed

# 7. Запустить dev-сервер
bun run dev
```

### 19.3. .env для Windows

```bash
# Используйте прямые слеши! Обратные слеши вызовут ошибку "url must start with protocol file:"
DATABASE_URL=file:C:/My_Project/vsm-code-only/db/custom.db

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=vsm-dev-secret-change-in-production
```

### 19.4. Решение проблем на Windows

#### SSL-ошибки при скачивании Prisma engines

Корпоративные прокси могут перехватывать SSL-трафик. Решение:

```powershell
# PowerShell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
bun install
npx prisma generate
```

Также в `next.config.ts` добавлен флаг:

```typescript
experimental: {
  turbopackUseSystemTlsCerts: true,
}
```

#### Ошибка "url must start with protocol file:"

**Причина:** Обратные слеши в пути.

```bash
# ❌ Неправильно
DATABASE_URL=file:C:\My_Project\vsm-code-only\db\custom.db

# ✅ Правильно (прямые слеши)
DATABASE_URL=file:C:/My_Project/vsm-code-only/db/custom.db
```

#### Ошибка "Required column `filePath` cannot be added to non-empty table"

При изменении схемы на существующей БД с данными:

```powershell
npx prisma db push --force-reset
```

**Внимание:** `--force-reset` удаляет все данные! Используйте только при разработке.

#### Google Fonts TLS-ошибка

Если `next/font/google` не загружает шрифты из-за SSL:

Шрифты Geist/Geist_Mono удалены из `layout.tsx`, используются системные шрифты.

#### Prisma 7.x incompatibility

**Важно:** Не обновляйте Prisma до 7.x! Версия 7 убрала поле `url` из datasource block.

В `package.json` версия пинится без `^`:

```json
"@prisma/client": "6.11.1",
"prisma": "6.11.1"
```

#### Dev-скрипт для Windows

Оригинальный скрипт использовал Unix-only синтаксис `2>&1 | tee`. Исправлено:

```json
"dev": "next dev -p 3000"
```

#### ModuleNotFoundError: browse_dialog

Файл `mini-services/excel-service/browse_dialog.py` — stub (tkinter недоступен в headless-режиме). Возвращает ошибку-словарь вместо краша.

### 19.5. Доступ к приложению

После запуска `bun run dev`:

- **Локально:** http://localhost:3000
- **Логин:** admin / admin123
- **Демо-пользователи:** user1/user123 (workspace: vsm), user2/user123 (workspace: sk)

---

## 20. Потоки данных и связи между модулями

### Загрузка основной базы
```
SettingsPanel (загрузка) → POST /api/main-db/load → excel-server.loadMainDb()
→ SheetJS: XLSX.read() → JSON → mainDbCache (globalThis)
→ Dashboard: GET /api/main-db/status → обновление UI (молча)
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

### Аутентификация пользователя
```
/login → signIn('credentials') → POST /api/auth/callback/credentials
→ authorize() → db.user.findUnique (withRetry) → bcrypt.compare
→ JWT token (8h) → Cookie → middleware проверяет на каждом запросе
→ getCurrentUser() в server components/API routes
```

### Многопользовательская запись файла
```
Пользователь A загружает файл → getCurrentUser() → userId: "user-aaa"
→ withRetry(() => db.excelFile.create({ data: { ..., userId: "user-aaa" } }))
→ Пользователь B видит только свои файлы (where: { userId: "user-bbb" })
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
DailyTrackingPanel → (mock data + fallback площадки)

NextAuth.js → middleware → защищает все маршруты
getCurrentUser() → userId → изоляция данных в Prisma
```

---

## 21. Известные проблемы и ограничения

### Критические
1. **502 Bad Gateway при загрузке** — Долгая обработка XLSX.read() блокирует event loop
2. **Caddy ломает multipart/form-data** — Обход через JSON+base64 (на 33% больше размер)

### Производительность
3. **113K+ записей в памяти** — ~100+ МБ RAM
4. **Нет виртуализации таблиц** — Пагинация без виртуализации
5. **SheetJS segfault** — На больших файлах в Turbopack

### Многопользовательский режим
6. **In-memory кеш общей базы — глобальный** — Основная база сотрудников (mainDbCache) хранится в `globalThis` и **не изолирована** между пользователями. Все пользователи видят одну и ту же загруженную базу. Изоляция `userId` применяется только к метаданным в SQLite (ExcelFile, FileRecord и т.д.).
7. **WAL checkpoint** — При большом количестве записей WAL-файл может расти. SQLite автоматически выполняет checkpoint, но при экстремальной нагрузке может потребоваться ручной `PRAGMA wal_checkpoint(TRUNCATE)`.

### Функциональные
8. **Mock-данные** — DailyTracking, Ratings, Dashboard stats
9. **10 из 19 вкладок в разработке**
10. **Нет кнопки «Очистить»** — Для загрузок DailyTracking
11. **Нет persisted state** — Zustand stores не персистятся

---

## 22. Планы развития

### Приоритет: Высокий
- [x] ~~Аутентификация (NextAuth.js + credentials provider)~~ ✅ Выполнено
- [x] ~~SQLite WAL + busy_timeout + retry для 20 пользователей~~ ✅ Выполнено
- [x] ~~Многопользовательская изоляция (userId на всех моделях)~~ ✅ Выполнено
- [x] ~~Доменные таблицы (DailyTrackingRecord, FlightEvent, TicketRecord, RatingRecord)~~ ✅ Выполнено
- [x] ~~Worker Thread Pool для парсинга Excel (4 воркера, FIFO, прогресс)~~ ✅ Выполнено
- [x] ~~DuckDB для аналитических запросов (sqlite_scan, cross-period)~~ ✅ Выполнено
- [x] ~~Месячная архивация (archive-YYYY-MM.db + cron)~~ ✅ Выполнено
- [ ] Виртуализация таблиц (@tanstack/react-virtual)
- [ ] Решение 502 при загрузке (Worker Thread / streaming)
- [ ] Изоляция in-memory кеша основной базы по workspace
- [ ] Кнопка «Активировать» в Settings → БАЗА

### Приоритет: Средний
- [ ] Вкладка «Оценки» — Многоканальная загрузка реестров оценок за полугодие
- [ ] Вкладка «Стаж» — Расчёт стажа из основной базы
- [ ] Вкладка «Уволенный персонал» — Отчёт по уволенным
- [ ] Вкладка «Мобилизация ОП» — План мобилизации
- [ ] Кнопка «Очистить» для DailyTracking
- [ ] Persisted state (Zustand persist middleware)
- [ ] Реструктуризация шапки: бегущая строка, логин/пароль, кнопка «Назад», колокол
- [ ] Сокращение вкладок (удалить Справочники и Реестр билетов)
- [ ] Замена времени на календарь+время виджет
- [ ] Детальные статус-бары для каждого действия
- [ ] Фоновая загрузка файлов при переключении вкладок
- [ ] Персистентное хранение файлов в БД

### Приоритет: Низкий
- [ ] Вкладки: Карнет, Путь сотрудника, VBA Лаборатория, Интеграция, Слияние данных, Подготовка файлов
- [ ] Реальные данные для Ratings и DailyTracking
- [ ] Реальные данные для Dashboard статистики
- [ ] Реструктуризация Справочников (удалить Login_Pass_Status.xlsx, добавить Role_OP.xlsx и Log_pass_role.xlsx)
- [ ] Отображение данных Оценок в Карточке сотрудника

---

*Документация сгенерирована на основе исходного кода проекта VSM ОМиК.*
*Версия 1.1 — добавлены разделы: аутентификация, SQLite WAL, локальный запуск на Windows.*
