# OMiK_VSM — Полная документация системы

> **Версия:** 0.2.0 (UI header: v1.0)
> **Организация:** ООО «ВелесстройМонтаж» — Отдел мобилизации и координации персонала (ОМиК)
> **Путь проекта:** `C:\My_Project\omik-project`
> **Обновлено:** июль 2026 — Unified SQLite + Хронология v4.1 + Кандидаты + Ежедневный учёт + Затраты по билетам

---

## Содержание

1. [Общее описание системы](#1-общее-описание-системы)
2. [Архитектура и технологический стек](#2-архитектура-и-технологический-стек)
3. [Структура проекта](#3-структура-проекта)
4. [База данных (Prisma + Unified SQLite)](#4-база-данных-prisma--unified-sqlite)
5. [Аутентификация и RBAC](#5-аутентификация-и-rbac)
6. [SQLite WAL и единая БД](#6-sqlite-wal-и-единая-бд)
7. [Python excel-service (FastAPI)](#7-python-excel-service-fastapi)
8. [Кэш вкладок и производительность UI](#8-кэш-вкладок-и-производительность-ui)
9. [Состояние приложения (Zustand Stores)](#9-состояние-приложения-zustand-stores)
10. [Главный экран (Welcome) и модули](#10-главный-экран-welcome-и-модули)
11. [Вкладки и панели — подробное описание](#11-вкладки-и-панели--подробное-описание)
12. [Управление данными (Settings)](#12-управление-данными-settings)
13. [API-маршруты — справочник](#13-api-маршруты--справочник)
14. [Бизнес-правила](#14-бизнес-правила)
15. [Потоки данных и связи модулей](#15-потоки-данных-и-связи-модулей)
16. [Инфраструктура и развёртывание](#16-инфраструктура-и-развёртывание)
17. [Локальный запуск на Windows](#17-локальный-запуск-на-windows)
18. [Известные проблемы и ограничения](#18-известные-проблемы-и-ограничения)
19. [Планы развития](#19-планы-развития)
20. [Связанная документация](#20-связанная-документация)

---

## 1. Общее описание системы

**OMiK_VSM** — корпоративная информационная система для отдела мобилизации и координации персонала строительной компании «ВелесстройМонтаж» и связанных юрлиц (ВСМ, СК и др.). Система обеспечивает:

- **Управление основной базой сотрудников** (112 000+ записей из выгрузки 1С)
- **Ежедневный учёт персонала** (подвкладки: На площадке / Дома / Статистика)
- **Кандидаты** (На сегодня, Дни оформления, Общая статистика; сопоставление с БД по ФИО+ДР, затем паспорт)
- **Статистику по площадкам** (KPI: на площадке, дома, кандидаты, АУП/ИТР/РОП)
- **Календарь прилёта–вылета**
- **Учёт затрат на авиа-/ЖД-билеты** (организации ВСМ и СК; отдельная очередь загрузки)
- **Хронологию Приёма, Перевода и Увольнения** (v4.1: `employee_chronology.py` + `hr_events_store.py`)
- **Оценки сотрудников** (реестры по полугодиям, сравнение с БД)
- **Работу с Excel** (загрузка, просмотр, объединение, подготовка файлов, VBA-лаборатория)
- **Интеграцию с Outlook** (сканирование почты и вложений — только Windows)
- **Многопользовательский режим** с RBAC (роли, группы, доступ к площадкам)
- **Управление пользователями** и отдельный пароль панели «Управление данными»

Система построена как **веб-приложение на главном экране (Welcome)** с карточками модулей: после логина открывается трёхколоночный дашборд, модули открываются поверх (keep-alive: панель скрывается, не размонтируется). Тяжёлая обработка Excel и доменных данных выполняется в **Python FastAPI excel-service** на порту **3031**; UI и прокси — **Next.js 16** на порту **3000**.

**Платформа:** Windows 11, нативный запуск без Docker/Kubernetes/Podman. Формат дат во всём UI: **ДД.ММ.ГГГГ**.

---

## 2. Архитектура и технологический стек

### 2.1. Высокоуровневая архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│                        Браузер (Client)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  React 19    │  │  Zustand     │  │  Shadcn/UI + Tailwind  │ │
│  │  Next.js 16  │  │  Stores      │  │  Excel panels / grids  │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘ │
│         │                 │                                      │
│         └────────┬────────┘                                      │
└──────────────────┼───────────────────────────────────────────────┘
                   │ cookie omik_session + CSRF + fetch JSON
┌──────────────────┼───────────────────────────────────────────────┐
│                  ▼     Node / Bun                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │           Next.js 16 (App Router, port 3000)              │   │
│  │  ┌─────────────┐  ┌───────────────┐  ┌────────────────┐  │   │
│  │  │ /api/excel/*│  │ Prisma ORM    │  │ Session table  │  │   │
│  │  │ proxy+auth  │  │ (SQLite)      │  │ custom.db      │  │   │
│  │  └──────┬──────┘  └───────┬───────┘  └───────┬────────┘  │   │
│  │         │ X-OMIK-Token     │                   │           │   │
│  │         │ X-OMIK-Role      │                   │           │   │
│  │         │ X-OMIK-Sites     │                   │           │   │
│  └─────────┼──────────────────┼───────────────────┼───────────┘   │
│            │                  │                   │               │
│            ▼                  └─────────┬─────────┘               │
│  ┌─────────────────────────────┐        │                         │
│  │ excel-service (FastAPI)     │◄───────┘ unified_db.py           │
│  │ uvicorn, 1 worker, :3031    │        db/custom.db              │
│  │ daily_tracking, main_db,    │                                  │
│  │ tickets, hr_events, ...     │──► %LOCALAPPDATA%\OMiK_VSM\data\ │
│  └─────────────────────────────┘                                  │
│                                                                   │
│  launcher.mjs / START.bat — поднимает оба процесса                │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2. Технологический стек

| Категория | Технология | Версия | Назначение |
|-----------|-----------|--------|-----------|
| **Фреймворк** | Next.js (App Router) | 16.x | UI, API proxy, standalone |
| **Язык UI** | TypeScript | 5.x | Типобезопасность |
| **Runtime UI** | Bun / Node.js 20+ | — | Dev и production |
| **UI** | React | 19.x | Компонентная модель |
| **Стилизация** | Tailwind CSS | 4.x | Utility-first CSS |
| **Компоненты** | Shadcn/UI + Radix | — | Диалоги, tabs, toast и т.д. |
| **Иконки** | Lucide React | 0.525+ | SVG-иконки |
| **Состояние** | Zustand | 5.x | excel-store, auth-store, … |
| **Серверные данные** | TanStack Query | 5.x | Кеширование запросов |
| **Таблицы** | TanStack Table + Virtual | 8.x / 3.x | Сортировка, виртуализация |
| **ORM (метаданные)** | Prisma | 6.x | Session, ExcelFile, Macro, … |
| **БД** | SQLite (WAL) | — | `db/custom.db` (единая с Python) |
| **Excel (UI)** | SheetJS (xlsx) | 0.20.3 | Чтение на клиенте/edge |
| **Excel (backend)** | openpyxl, pandas, polars | — | Тяжёлая обработка |
| **Бэкенд** | FastAPI + uvicorn | — | Порт 3031, 1 worker |
| **Графики** | Recharts | 2.x | Дашборды |
| **Анимации** | Framer Motion | 12.x | Переходы |
| **Формы** | React Hook Form + Zod | 7.x / 4.x | Валидация |
| **Пароли** | bcryptjs / bcrypt | — | Хеши пользователей |
| **Очередь (опц.)** | Celery + Redis | — | `OMIK_USE_CELERY=1` |
| **Тесты** | Vitest, Playwright, pytest | — | Unit / e2e / Python |
| **Реверс-прокси (опц.)** | Caddy | — | HTTPS-шлюз |

### 2.3. Ключевые архитектурные решения

1. **Гибрид Next.js + Python FastAPI** — UI и сессии в Next.js; вся доменная логика Excel/SQLite — в `mini-services/excel-service/`. UI ходит только через `/api/excel/*`.

2. **Единая SQLite `db/custom.db`** — Prisma и Python через `unified_db.py`. Логические имена реестра (например `employees`) переписываются в физические `{instance_id}_employees` (word-boundary).

3. **Один worker uvicorn** — параллельные тяжёлые запросы встают в очередь; UI может «зависать», если с главной уходит лавина запросов.

4. **Сессии в таблице `Session`** — не в JSON-файлах `.sessions/` (каталог может остаться legacy). Cookie `omik_session`, TTL порядка 8 часов.

5. **Три уровня безопасности** — middleware cookie → проверка сессии/CSRF/RBAC в route handlers → `X-OMIK-Token` (= `OMIK_API_SECRET`) + role/sites в Python.

6. **Keep-alive панелей** — при смене модуля панель `hidden`, а не unmount — сохраняется состояние и кэш.

7. **Ленивая загрузка тяжёлых подвкладок** — в `DailyAccountingPanel`, `CandidatesPanel` грузится только активная подвкладка (цель перехода ~1 с).

8. **Загрузки Excel** — `%LOCALAPPDATA%\OMiK_VSM\data\` (+ `upload/`). Очередь «Затрат по билетам» изолирована в `tickets_costs_vsm/sk.sqlite`, не из общего `upload/`.

---

## 3. Структура проекта

```
C:\My_Project\omik-project\
│
├── .env.example / .env.local           # DATABASE_URL, OMIK_API_SECRET, EXCEL_BACKEND_URL
├── START.bat / STOP.bat                # Основной production-запуск / остановка
├── RESTART-EXCEL.bat                   # Перезапуск только excel-service
├── build-standalone.cmd                # next build + copy static/mini-services
├── INSTALL.bat                         # Первичная установка
├── launcher.mjs                        # Подъём Next :3000 + excel-service :3031
├── package.json                        # Зависимости и скрипты (v0.2.0)
├── next.config.ts                      # standalone output
├── Caddyfile                           # Опциональный HTTPS
├── AGENTS.md                           # Правила для AI/агентов
│
├── prisma/
│   └── schema.prisma                   # Session, ExcelFile, Macro, MacroRun, Operation, MainDatabase(legacy)
│
├── db/
│   └── custom.db                       # Единая SQLite (Prisma + Python)
│
├── upload/                             # Временные/загруженные Excel
├── attachments/                        # Вложения Outlook и пр.
├── download/
├── Utilites/                           # Внешние Python-утилиты (GUI и скрипты)
│
├── mini-services/
│   └── excel-service/                  # Python FastAPI бэкенд (АКТИВЕН)
│       ├── app.py                      # Точка входа FastAPI
│       ├── env_loader.py               # Загрузка OMIK_API_SECRET и env
│       ├── unified_db.py               # Единый доступ к custom.db
│       ├── main_db.py / main_db_registry.py
│       ├── daily_tracking.py / daily_validation.py / daily_merge.py
│       ├── sites_statistics.py
│       ├── employee_rules.py / employee_chronology.py / employee_identity.py
│       ├── hr_events_store.py
│       ├── tickets_costs.py / tickets_db.py
│       ├── calendar_db.py
│       ├── evaluations_db.py
│       ├── users_store.py / rbac.py / auth_middleware.py
│       ├── excel_handler.py / excel_libs.py / excel_reader.py
│       ├── data_merge.py / data_ops.py / file_prepare.py
│       ├── references.py / reports.py / vba_lab.py
│       ├── outlook_integration.py
│       ├── celery_app.py / celery_tasks.py / task_queue.py
│       ├── routers/
│       │   ├── daily.py
│       │   ├── jobs.py
│       │   └── references.py
│       └── requirements.txt / tests/
│
├── scripts/                            # copy-standalone и вспом. скрипты
├── .zscripts/                          # PowerShell/bat: verify, audit, start excel
├── docs/                               # Документация (этот файл — OMIK_DOCUMENTATION2.md)
│
└── src/
    ├── app/
    │   ├── page.tsx                    # MainInterface (корневой shell)
    │   ├── layout.tsx
    │   ├── globals.css
    │   └── api/excel/                  # ~80 route handlers → proxy :3031
    │       ├── auth/                   # login, me, csrf, change-password
    │       ├── main-db/
    │       ├── daily-tracking/
    │       ├── candidates/
    │       ├── today/
    │       ├── welcome-dashboard/
    │       ├── sites-stats/
    │       ├── hr-events/
    │       ├── tickets-costs/
    │       ├── tickets-registry/
    │       ├── calendar/
    │       ├── evaluations/
    │       ├── users/ / groups/
    │       ├── upload/ / files/
    │       ├── outlook/ / macro/ / merge/ …
    │       └── health/
    │
    ├── components/
    │   ├── home/                       # WelcomeScreen, MainInterface, KPI, reports
    │   ├── excel/                      # Все *Panel.tsx модулей
    │   ├── settings/                   # SettingsPanel + tabs
    │   ├── dashboard/                  # ExcelGrid, EmployeeCard, …
    │   ├── outlook/
    │   └── ui/                         # Shadcn primitives
    │
    ├── hooks/
    │   ├── use-welcome-dashboard.ts
    │   ├── use-sites-statistics.ts
    │   └── excel-api/                  # Клиентский API-слой
    │
    ├── lib/
    │   ├── home-modules.ts             # WELCOME_MODULE_CARDS
    │   ├── tab-data-cache.ts           # Кэш вкладок (fetch timeout 45 с)
    │   ├── api-paths.ts
    │   ├── excel-proxy / auth / csrf / session helpers
    │   └── utils.ts                    # formatDateDDMMYYYY и пр.
    │
    ├── middleware.ts                   # Cookie omik_session для /api/*
    │
    └── store/
        ├── excel-store.ts              # activeFile, navHistory, panelContext
        ├── auth-store.ts               # user, validated
        ├── main-db-store.ts
        └── activity-log-store.ts
```

---

## 4. База данных (Prisma + Unified SQLite)

### 4.1. Подключение

| Параметр | Значение |
|----------|----------|
| **Провайдер** | SQLite |
| **Файл** | `db/custom.db` |
| **Prisma URL (Windows)** | `DATABASE_URL=file:C:/My_Project/omik-project/db/custom.db` (**не** `file:/C:/...`) |
| **Python** | `OMIK_UNIFIED_DB` / `unified_db.py` |
| **Данные Excel** | `%LOCALAPPDATA%\OMiK_VSM\data\` (`OMIK_DATA_DIR`) |

### 4.2. Модели Prisma

#### Session — сессии пользователей

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (@id) | 64-char hex token (значение cookie) |
| `login` | String | Логин |
| `role` | String | Роль |
| `access` | String | Уровень доступа |
| `sites` | String | Площадки через запятую |
| `createdAt` | DateTime | Создание |
| `expiresAt` | DateTime | Истечение (индекс) |

#### ExcelFile — реестр Excel в UI

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String (cuid) | ID |
| `name` / `originalName` | String | Имена |
| `path` | String | Путь |
| `size` / `sheetCount` | Int | Метаданные |
| `isActive` | Boolean | Активен |
| `description` | String | Описание |
| Связи | `macros`, `operations` | Cascade |

#### Macro / MacroRun — VBA/Python макросы и запуски

| Модель | Ключевые поля |
|--------|----------------|
| Macro | `name`, `code`, `language` (vba/python), `fileId?`, `isGlobal` |
| MacroRun | `macroId`, `status`, `output`, `duration` |

#### Operation — аудит операций над файлом

| Поле | Описание |
|------|----------|
| `type` | sort, filter, merge, find_replace, pivot, … |
| `params` | JSON-строка |
| `status` | pending / completed / error |
| `fileId` | Связь с ExcelFile |

#### MainDatabase — legacy-метаданные

Модель в schema остаётся для совместимости; **реальные данные сотрудников** живут в Python-слое (`main_db.py`) в физических таблицах unified DB, не как строки Prisma.

### 4.3. Где лежат рабочие данные (Python)

| Реестр | Модуль | UI |
|--------|--------|-----|
| Основная БД сотрудников | `main_db.py`, `main_db_registry.py` | Сотрудники |
| Ежедневный учёт | `daily_tracking.py` | Ежедневный учёт, Welcome, Кандидаты, Площадки |
| HR-события / хронология | `hr_events_store.py`, `employee_chronology.py` | Хронология |
| Календарь | `calendar_db.py` | Календарь Прилет-Вылет |
| Билеты ВСМ/СК | `tickets_costs.py`, `tickets_db.py` | Затраты по билетам |
| Оценки | `evaluations_db.py` | Оценки сотрудников |
| Пользователи | `users_store.py` | Управление данными → Пользователи |

**Важно:** «Очистить очередь загрузки» ≠ «Очистить реестр» (билеты). Очередь изолирована в `tickets_costs_vsm/sk.sqlite`.

---

## 5. Аутентификация и RBAC

### 5.1. Поток входа

```
Пользователь → AppLoginBar (Welcome)
  ↓ POST /api/excel/auth/login { login, password }
  ↓ bcrypt verify (users_store)
  ↓ создание Session в custom.db
  ↓ Cookie: omik_session
  ↓ GET /api/excel/auth/me → auth-store
  ↓ рендер модулей (только при isAuthed)
```

Логин администратора: **`Admin`** (с заглавной **A**). При первом создании пароль пишется в `.first_admin_password`.

### 5.2. Middleware и CSRF

**Файл:** `src/middleware.ts`

- Для `/api/*` требуется cookie сессии (исключения: login, health, публичные stubs).
- Мутации проверяют CSRF через `/api/excel/auth/csrf`.

### 5.3. Прокси к Python

Next.js добавляет заголовки:

| Заголовок | Содержимое |
|-----------|------------|
| `X-OMIK-Token` | `OMIK_API_SECRET` (≥ 32 символа) |
| `X-OMIK-Role` | Роль из Session |
| `X-OMIK-Sites` | Список площадок пользователя |

Python (`auth_middleware.py`, `rbac.py`) проверяет токен и фильтрует данные по роли/площадкам.

### 5.4. Роли

| Роль | Доступ |
|------|--------|
| **Administrator / Admin** | Полный доступ, пользователи, настройки |
| **ЦОК / COK / Manager** | Расширенный доступ к площадкам |
| **Viewer / обычный** | Только назначенные площадки |

### 5.5. Пароль «Управление данными»

Отдельный пароль настроек (файл `.settings.hash` / `settings-password.ts`) — **не путать** с логином приложения. Не сбрасывается при logout UI.

---

## 6. SQLite WAL и единая БД

### 6.1. Unified DB

**Файл:** `mini-services/excel-service/unified_db.py`

- Prisma и Python открывают один `custom.db`.
- Реестр логических имён → физические таблицы с префиксом `instance_id`.
- `pandas.to_sql` — через raw `sqlite3` и **физическое** имя таблицы.

### 6.2. WAL

Для многопользовательского доступа рекомендуется WAL (readers не блокируют writers полностью). При экстремальной нагрузке возможны `database is locked` — excel-service работает с **одним worker**, что снижает конкурентную запись, но удлиняет очередь запросов.

### 6.3. Данные вне custom.db

Часть legacy/рабочих файлов остаётся в `%LOCALAPPDATA%\OMiK_VSM\data\` и постепенно мигрирует в unified-схему.

---

## 7. Python excel-service (FastAPI)

### 7.1. Запуск

| Параметр | Значение |
|----------|----------|
| Порт | **3031** |
| Хост | `127.0.0.1` |
| Workers | **1** (`UVICORN_WORKERS=1`) |
| Entrypoint | `app.py` + `env_loader.py` |
| Health | `/api/health` (проксируется с Next) |
| Перезапуск | `.\RESTART-EXCEL.bat` или `.zscripts\start_excel_service.py --force-restart` |

### 7.2. Ключевые модули

| Модуль | Назначение |
|--------|------------|
| `daily_tracking.py` | Ядро ежедневного учёта, welcome-dashboard, today, кандидаты |
| `sites_statistics.py` | Статистика по площадкам |
| `main_db.py` | Загрузка/статус/поиск основной БД |
| `employee_rules.py` | ПРАВИЛО_0, ПРАВИЛО_5 |
| `employee_chronology.py` | Сборка хронологий v4.1 |
| `hr_events_store.py` | Хранение HR-событий |
| `tickets_costs.py` | Затраты по билетам, jobs |
| `calendar_db.py` | Календарь |
| `evaluations_db.py` | Оценки |
| `rbac.py` | Фильтрация по роли/площадкам |

### 7.3. Очередь задач

- In-process `task_queue.py` / jobs API.
- Опционально Celery: `START-Celery.bat`, `bun run celery:worker`.

---

## 8. Кэш вкладок и производительность UI

**Файл:** `src/lib/tab-data-cache.ts`

| Параметр | Значение |
|----------|----------|
| TTL (типичный) | ~60 с |
| Timeout fetch | **45 с** |
| Инвалидация | `notifyDashboardRefresh()` после загрузки daily |

**Правила UX (важно):**

- Переход на вкладку — данные ≈ **1 с** (stale cache / lazy).
- В `DailyAccountingPanel`, `CandidatesPanel` — **только активная** подвкладка, без параллельной загрузки всех.
- На Welcome: `WelcomeActiveReports` ориентируется на `isPending`, не на `isFetching`.

**Узкие места backend (типичные):**

- Полные сканы daily (`limit` сотни тысяч) в Python-циклах.
- `get_at_home_rows` = полная БД + set on-site.
- Дублирование `useWelcomeDashboard` (Center + Sidebar).
- Лавина 4–5 запросов с главной при cold start.

---

## 9. Состояние приложения (Zustand Stores)

### 9.1. excel-store

**Файл:** `src/store/excel-store.ts`

| Поле | Назначение |
|------|------------|
| `activeFile` | Текущий модуль или Excel-файл (`id`, panel kind) |
| `navHistory` | Стек «Назад» |
| `panelContext` | Контекст (например `siteName` для Площадок) |
| `files` / `sheets` | Spreadsheet-режим |

Навигация: `navigateTo()`, `goBack()`, `openHomeModule()` в `src/lib/home-modules.ts`.

### 9.2. auth-store

**Файл:** `src/store/auth-store.ts` — `user`, `validated`; модули не рендерятся до успешной авторизации.

### 9.3. Прочие

- `main-db-store.ts` — статус/метаданные основной БД на клиенте.
- `activity-log-store.ts` — лог активности UI.
- Ticket costs: локальные store/cache (`ticketCostsCache.ts`, `ticketCostsLoadActionStore.ts`) — очередь загрузки не смешивается с общим upload.

---

## 10. Главный экран (Welcome) и модули

### 10.1. Shell

```
MainInterface
├── Не авторизован → WelcomeScreen + AppLoginBar
├── Авторизован, нет activeFile → WelcomeScreen
├── activeFile.id === 'settings' → SettingsPanel
├── activeFile → модуль (*Panel)
└── обычный Excel → Toolbar + SpreadsheetGrid + SheetTabs
```

### 10.2. Три колонки Welcome

| Колонка | Содержимое |
|---------|------------|
| **Левая** | Карточки модулей (`WelcomeModuleCard`), кнопки «Загрузить Excel», «Управление данными» |
| **Центр** | 4 KPI + `WelcomeActiveReports` (СВОД / Структура / На площадке / Дома / Кандидаты) |
| **Правая** | Площадки → клик открывает модуль «Площадки» с `siteName` |

### 10.3. KPI

Источник: `GET /api/excel/welcome-dashboard` → `daily_tracking.get_welcome_dashboard()`.

| KPI | Смысл |
|-----|--------|
| **Действующие** | По Основной БД (статус «Действующий») |
| **На площадке** | Строки daily с «рабочим» табельным |
| **Кандидаты** | Таб. № = «Кандидат» (и синонимы) |
| **Дома** | Действующие, которых нет в множестве «на площадке» |

### 10.4. Каталог модулей (`WELCOME_MODULE_CARDS`)

| ID | Название | panel | Статус |
|----|----------|-------|--------|
| `main-db` | Сотрудники | `main-db` | ✅ |
| `module-tenure` | Кандидаты | `candidates` | ✅ |
| `module-daily-accounting` | Ежедневный учет | `daily-accounting` | ✅ |
| `calendar-module` | Календарь Прилет-Вылет | `calendar` | ✅ |
| `module-carnet` | Карнет | `placeholder` | 🚧 |
| `module-dismissed` | Отчет по Уволенному персоналу | `placeholder` | 🚧 |
| `module-hiring-costs` | Отчет по затратам на Трудоустройство | `placeholder` | 🚧 |
| `module-mobilization-plan` | Отчет/План Мобилизации ОП | `placeholder` | 🚧 |
| `module-utilities` | Utilites for all | `placeholder` | 🚧 |
| `data-merge` | Объединение данных | `data-merge` | ✅ |
| `ticket-costs` | Затраты по билетам | `ticket-costs` | ✅ |
| `gelendzhik-career` | Хронология Приёма, Перевода и Увольнения | `gelendzhik` | ✅ |
| `module-sites-stats` | Площадки | `sites-stats` | ✅ |
| `vba-laboratory` | Лаборатория VBA+PY | `vba-laboratory` | ✅ |
| `outlook` | Outlook Вложения | `outlook` | ✅ Windows |
| `evaluations` | Оценки сотрудников | `evaluations` | ✅ |
| `file-prepare` | Подготовка файла Excel | `file-prepare` | ✅ |

---

## 11. Вкладки и панели — подробное описание

### 11.1. Сотрудники (`MainDatabasePanel`)

**Файл:** `src/components/excel/MainDatabasePanel.tsx`
**API:** `/api/excel/main-db/*`

- Режим **Данные:** таблица, поиск, фильтры, пагинация, экспорт.
- Режим **Отчеты** (`ReportsPanel`): Трудоустройство / Увольнения / Состав / Календарь.
- Загрузка БД: Управление данными → Основная База 1С **или** кнопка в модуле.

### 11.2. Ежедневный учёт (`DailyAccountingPanel`)

**Файл:** `src/components/excel/DailyAccountingPanel.tsx`

| Подвкладка | API |
|------------|-----|
| На площадке | `/api/excel/daily-tracking/on-site` |
| Дома | `/api/excel/daily-tracking/at-home` (нужна Основная БД) |
| Статистика | `/api/excel/daily-tracking/statistics` |

Файл загружается через **Управление данными → Ежедневный учёт** (не отдельной вкладкой «Файлы данных»).

### 11.3. Кандидаты (`CandidatesPanel`)

| Подвкладка | Описание |
|------------|----------|
| На сегодня | Кандидаты из daily |
| Дни оформления | Сопоставление с БД: **ФИО + дата рождения**, затем **паспорт** |
| Общая статистика | Агрегаты |

API: `/api/excel/candidates?view=today|processing|general`

### 11.4. Площадки (`SitesStatsPanel`)

API: `/api/excel/sites-stats`
KPI + свод + детали: Гражданство / Приёмы / Увольнения. Контекст `panelContext.siteName` с Welcome.

### 11.5. Хронология (`ChronologyPanel` / `GelendzhikCareerPanel`)

Сегменты: ВСМ/СК, ВМ, ВМ-СМУ, Остальные, Общий.
API: `/api/excel/hr-events/chronology?segment=...`
Предварительно: Управление данными → **Приём, Перевод, Увольнение** (build).

### 11.6. Затраты по билетам (`TicketCostsPanel`)

Навигация: Dashboard | ВСМ | СК → внутри реестра: Отчёт / Загрузка.
API: `/api/excel/tickets-costs/*`
Очередь загрузки изолирована; «Очистить очередь» ≠ «Очистить реестр».

### 11.7. Календарь (`CalendarPanel`)

API: `/api/excel/calendar/*` — загрузка, просмотр, связь с Основной БД.

### 11.8. Оценки (`EvaluationsPanel`)

10 периодов (2024-1п … 2028-2п). Загрузка реестров в Settings. Сравнение: `/api/excel/evaluations/compare/[period]`.

### 11.9. Прочие рабочие

| Панель | Назначение |
|--------|------------|
| `DataMergePanel` | Объединение Excel с одинаковыми заголовками |
| `FilePreparePanel` | Листы, столбцы, формулы→значения |
| `VbaLaboratoryPanel` | Импорт/редактирование макросов |
| `OutlookPanel` | Почта COM (Windows) |
| `ModulePlaceholderPanel` | Заглушка «В разработке» |

---

## 12. Управление данными (Settings)

**Файл:** `src/components/settings/SettingsPanel.tsx`
Открывается с Welcome → `activeFile.id = 'settings'`.

| id | Название | Что делает |
|----|----------|------------|
| `base-1c` | Основная База 1С | Импорт выгрузки 1С |
| `refs-templates` | Справочники | Справочные Excel / шаблоны |
| `hr-events` | Приём, Перевод, Увольнение | Исходники хронологии |
| `daily-upload` | Ежедневный учёт | Excel по площадкам + дата |
| `sites` | Площадки | Статусы площадок в БД |
| `users-access` | Пользователи и доступ | Группы / роли / пользователи |
| `evaluations` | Реестры с оценками | Периоды оценок |

Lazy mount: вкладка монтируется при первом посещении. UI/статус-бар «файлов данных» встраивается в эти подвкладки — **отдельная вкладка «Файлы данных» не создаётся**.

---

## 13. API-маршруты — справочник

### 13.1. Схема

```
UI  →  /api/excel/{path}  →  EXCEL_BACKEND_URL/api/{path}
         (+ session, CSRF, X-OMIK-*)
```

### 13.2. Auth

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/excel/auth/login` | POST | Вход |
| `/api/excel/auth/me` | GET | Текущий пользователь |
| `/api/excel/auth/csrf` | GET | CSRF-токен |
| `/api/excel/auth/change-password` | POST | Смена пароля |

### 13.3. Доменные (ключевые)

| UI | Next.js | Python (типично) |
|----|---------|------------------|
| Welcome KPI | `/api/excel/welcome-dashboard` | `/api/daily-tracking/welcome-dashboard` |
| СВОД / today | `/api/excel/today?view=` | `/api/daily-tracking/today` |
| Кандидаты | `/api/excel/candidates` | `/api/daily-tracking/candidates` |
| Ежедневный учёт | `/api/excel/daily-tracking/*` | `/api/daily-tracking/*` |
| Площадки | `/api/excel/sites-stats` | `/api/daily-tracking/sites-stats` |
| Сотрудники | `/api/excel/main-db` | `/api/main-db/*` |
| Хронология | `/api/excel/hr-events/chronology` | `/api/hr-events/chronology` |
| Билеты | `/api/excel/tickets-costs/*` | tickets_costs API |
| Календарь | `/api/excel/calendar` | calendar API |
| Оценки | `/api/excel/evaluations/*` | evaluations API |
| Пользователи | `/api/excel/users`, `/groups` | users_store |
| Health | `/api/excel/health` | `/api/health` |

Полный список Next routes: `src/app/api/excel/**/route.ts`.

---

## 14. Бизнес-правила

### 14.1. ПРАВИЛО_0 — статус сотрудника

```
Если дата увольнения ≤ сегодня → «Уволен»
Иначе → «Действующий»
```

Применяется при загрузке БД и ежедневном обновлении статуса.

### 14.2. ПРАВИЛО_5 — компания по табельному

| Префикс | Компания |
|---------|----------|
| ВСМ | ВелесстройМонтаж |
| ВС | Велесстрой |
| ВМ | ВелесстройМонтаж |
| ВУ | Велесстрой-СМУ |
| ГК | ГКК |
| СА | СМК |
| МВ | Стройконстракшен |

### 14.3. Классификация daily

| Категория | Условие |
|-----------|---------|
| **Кандидат** | Нормализованный таб. = «Кандидат» (сырьё: прием/приём/нелегал) |
| **На площадке** | Таб. ≥ 2 символов и не кандидат |
| **Дома** | Действующий в БД, таб. не в on-site за дату |

### 14.4. Дни оформления

1. ФИО + дата рождения
2. При неоднозначности — паспорт
3. Дата приёма для повторного оформления уволенных не сравнивается «вслепую» со старой датой

### 14.5. Формат дат

Отображение: **ДД.ММ.ГГГГ**. Парсинг: `%d.%m.%Y`, `%Y-%m-%d`, `%d/%m/%Y`.

---

## 15. Потоки данных и связи модулей

### 15.1. Загрузка основной БД

```
Settings Base1cTab → POST /api/excel/main-db (load)
→ main_db.py + employee_rules → unified tables
→ MainDatabasePanel / Welcome KPI / Дома / Площадки / Хронология
```

### 15.2. Ежедневный учёт

```
DailyUploadSettingsTab → upload Excel (площадка + дата)
→ daily_tracking → on-site / candidates / stats
→ WelcomeActiveReports + DailyAccountingPanel + CandidatesPanel + SitesStats
```

### 15.3. Хронология

```
HrEventsSettingsTab (Приём/Перевод/Увольнение) → build
→ hr_events_store + employee_chronology
→ ChronologyPanel (карточки сотрудников)
```

### 15.4. Граф зависимостей (кратко)

```
Основная БД ──► Действующие, Дома, Площадки, Отчёты, Хронология, сравнение Оценок
Ежедневный  ──► На площадке, Кандидаты, СВОД, Welcome KPI, SitesStats
HR-события  ──► Хронология
Билеты      ──► TicketCosts (очередь изолирована)
Календарь   ──► CalendarPanel (+ опц. связь с БД)
```

### 15.5. Матрица «модуль → обязательные данные»

| Модуль | Основная БД | Ежедневный учёт | Прочее |
|--------|:-----------:|:---------------:|--------|
| Главный экран | ✅ acting/дома | ✅ on-site/кандидаты | — |
| Сотрудники | ✅ | — | — |
| Ежедневный учёт | ✅ для «Дома» | ✅ | — |
| Кандидаты | ✅ оформление | ✅ | — |
| Площадки | ✅ | ✅ | — |
| Хронология | ✅ | — | ✅ HR build |
| Календарь | опц. | — | ✅ календарь |
| Билеты | опц. | — | ✅ реестры |
| Оценки | для сравнения | — | ✅ реестры |

---

## 16. Инфраструктура и развёртывание

### Порты

| Сервис | Порт | Статус |
|--------|------|--------|
| Next.js standalone | **3000** | ✅ (порт **не** берётся из `PORT` в `.env.local`) |
| excel-service | **3031** | ✅ обязателен |
| Caddy (опц.) | 8443 / иные | опционально |
| Celery worker | — | опционально |

### Переменные окружения (обязательные)

```bash
# Windows: прямые слеши!
DATABASE_URL=file:C:/My_Project/omik-project/db/custom.db

EXCEL_BACKEND_URL=http://127.0.0.1:3031
EXCEL_SERVICE_URL=http://127.0.0.1:3031

# ≥ 32 символов
OMIK_API_SECRET=................................
OMIK_SESSION_SECRET=................................

# опционально
OMIK_UNIFIED_DB=C:/My_Project/omik-project/db/custom.db
OMIK_DATA_DIR=%LOCALAPPDATA%\OMiK_VSM\data
CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
UVICORN_WORKERS=1
```

### Скрипты npm/bun

| Команда | Описание |
|---------|----------|
| `bun run launcher` | `node launcher.mjs` |
| `bun run build` | Production build + copy-standalone |
| `bun run db:generate` / `db:push` | Prisma |
| `bun run test:unit` | Vitest |
| `bun run test:python` | pytest excel-service |
| `bun run verify:win` | Проверка Windows-окружения |
| `bun run e2e:tickets` | E2E API билетов |

### Production workflow

```bat
STOP.bat
.\build-standalone.cmd /force
START.bat
```

Требования: `.env.local`, собранный `.next/standalone/server.js`.

---

## 17. Локальный запуск на Windows

### 17.1. Требования

- Windows 11
- Node.js 20+ или Bun
- Python 3.11+ (venv excel-service)
- Git
- **Без** sudo/root, **без** Docker/K8s/Podman

### 17.2. Первый запуск

```powershell
cd C:\My_Project\omik-project

# 1. Установка
.\INSTALL.bat

# 2. Окружение
copy .env.example .env.local
# Задать OMIK_API_SECRET (≥32), поправить DATABASE_URL на file:C:/...

# 3. Prisma
bunx prisma generate
bunx prisma db push

# 4. Сборка и старт
.\build-standalone.cmd
.\START.bat
```

### 17.3. Ежедневная работа

| Действие | Команда |
|----------|---------|
| Запуск | `.\START.bat` |
| Остановка | `.\STOP.bat` |
| Только excel-service | `.\RESTART-EXCEL.bat` |
| Dev UI | `bun run dev` + excel вручную |
| Пересборка UI/API | `.\STOP.bat` → `.\build-standalone.cmd /force` → `.\START.bat` |

### 17.4. Доступ

- URL: http://127.0.0.1:3000
- Логин: **Admin**
- Пароль: `.first_admin_password` при первом создании (далее — как задан в users)

### 17.5. Типичные проблемы Windows

| Проблема | Решение |
|----------|---------|
| `DATABASE_URL` с `file:/C:/` | Использовать `file:C:/...` |
| excel health fail | `.\RESTART-EXCEL.bat` (дважды при сбое) |
| UI после правок Python/UI | full rebuild `/force` после STOP |
| TLS/прокси | корпоративный прокси — см. LOCAL_SETUP.md |

---

## 18. Известные проблемы и ограничения

### Производительность

1. **Один worker uvicorn** — тяжёлые запросы сериализуются; UI может ждать минуты при лавине с Welcome.
2. **Полные сканы daily/main DB** в Python вместо SQL-агрегаций.
3. **Дубль welcome-dashboard** (Center + Sidebar) и несколько параллельных запросов ActiveReports.
4. **Кэш только in-memory** на вкладке браузера — после F5 cold start.

### Функциональные

5. **Часть карточек** — заглушки (Карнет, Уволенные, Затраты на трудоустройство, Мобилизация, Utilites).
6. **Outlook** — только Windows + установленный Outlook.
7. **Секреты** — без `OMIK_API_SECRET` excel-service не принимает проксированные запросы.

### Архитектурные отличия от «VSM Node-only» ветки

В отличие от документации `VSM_DOCUMENTATION2.md` (где FastAPI декомиссирован, а Excel в `excel-server.ts`):

- в **omik-project** Python excel-service **активен и обязателен**;
- нет Worker Thread Pool / DuckDB / месячной архивации как в той ветке;
- auth — **своя Session-таблица**, не NextAuth.js.

---

## 19. Планы развития

### Высокий приоритет

- [ ] SQL-агрегации вместо `get_rows(limit=500_000)` для Welcome / Sites / Daily
- [ ] Единый `WelcomeDashboardProvider` (dedupe запросов)
- [ ] Stale-while-revalidate (sessionStorage / SWR) для мгновенного показа
- [ ] Строгая ленивость всех тяжёлых подвкладок (~1 с)
- [ ] Snapshot дашборда с TTL + инвалидация на upload

### Средний

- [ ] Доработка модулей-заглушек по приоритету бизнеса
- [ ] Дальнейшая миграция legacy SQLite из `%LOCALAPPDATA%` в unified
- [ ] Улучшение status-bar / информативности подвкладок Управления данными
- [ ] Расширение e2e (Playwright) на Daily / Candidates / Chronology

### Низкий

- [ ] Полная замена mock/placeholder модулей
- [ ] Опциональный HTTPS через Caddy в штатной инструкции
- [ ] Celery по умолчанию для фоновых jobs

---

## 20. Связанная документация

| Файл | Содержание |
|------|------------|
| [ОПИСАНИЕ_ПРОЕКТА.md](ОПИСАНИЕ_ПРОЕКТА.md) | Краткий обзор |
| [ПОЛНОЕ_ОПИСАНИЕ_ПРОЕКТА.md](ПОЛНОЕ_ОПИСАНИЕ_ПРОЕКТА.md) | Детальное описание UI/API/зависимостей |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Диаграммы архитектуры |
| [DATA_LAYER.md](DATA_LAYER.md) | Слой данных |
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | Настройка окружения |
| [MONITORING.md](MONITORING.md) | Мониторинг |
| [../AGENTS.md](../AGENTS.md) | Правила для агентов |
| [../README.md](../README.md) | Быстрый старт |
| [../ЗАПУСК.md](../ЗАПУСК.md) / LAUNCH | Инструкция запуска |

---

## Приложение A. Чеклист «тупит при загрузке»

1. Основная БД загружена? `/api/excel/main-db` → `loaded: true`
2. Есть дата daily? `welcome-dashboard.reportDate`
3. DevTools → Network: сколько параллельных запросов при открытии вкладки
4. Время `welcome-dashboard`, `sites-stats`, `today`, `candidates`
5. Если endpoint > 5 с — узкое место в Python (полные сканы)
6. После правок: `STOP.bat` → `.\build-standalone.cmd /force` → `START.bat`
7. Excel упал: сообщение «Дважды щёлкните RESTART-EXCEL.bat»

---

## Приложение B. Версия и метаданные

| Параметр | Значение |
|----------|----------|
| package.json version | 0.2.0 |
| UI header | v1.0 |
| Next.js | 16.x |
| React | 19.x |
| Prisma | 6.x |
| Порт UI | 3000 |
| Порт excel-service | 3031 |
| Лицензия | Private (внутренний проект) |
| Дата документа | июль 2026 |

---

*Документация составлена по исходной кодовой базе `C:\My_Project\omik-project` в формате, аналогичном `VSM_DOCUMENTATION2.md`.
При изменении модулей обновляйте разделы 10–15 и приложения.*
