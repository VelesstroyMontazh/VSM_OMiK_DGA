# ВСМ (ВелесстройМонтаж) — Отчётность ОМиК

Система отчётности для отдела ОМиК. Загрузка Excel-файлов, рейтингование сотрудников, аналитика.

## 🚀 Быстрый старт

```bash
# 1. Установка зависимостей
npm install

# 2. Генерация Prisma клиента
npx prisma generate

# 3. Создание/обновление БД
npx prisma db push

# 4. Запуск в режиме разработки
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

## 📋 Требования

- **Node.js** 18+ (рекомендуется 20 LTS)
- **npm** 9+ или **bun** 1+
- **Python** 3.10+ (только для Excel-микросервисов)
- **Root-права**: ❌ НЕ ТРЕБУЮТСЯ
- **Docker**: ❌ НЕ ТРЕБУЕТСЯ

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────┐
│                  Next.js 14                      │
│           (App Router + API Routes)              │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ Страницы  │  │ API      │  │ Middleware      │ │
│  │ (React)   │  │ Routes   │  │ (Security/Rate) │ │
│  └──────────┘  └────┬─────┘  └────────────────┘ │
│                     │                            │
│  ┌──────────────────▼─────────────────────────┐  │
│  │         Prisma ORM (SQLite)                │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Worker Threads   │  │ NodeCache (in-memory) │  │
│  │ (Excel-парсинг)  │  │ (кэш токенов/данных)  │  │
│  └──────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## 📁 Структура проекта

```
src/
├── app/
│   ├── api/           # API Routes (30+ endpoints)
│   │   ├── auth/      # Аутентификация
│   │   ├── excel/     # Excel-загрузка/обработка
│   │   ├── ratings/   # Рейтинги сотрудников
│   │   ├── main-db/   # Основная база данных
│   │   └── utilities/ # Python-утилиты
│   ├── auth/          # Страницы входа
│   ├── error.tsx      # Error Boundary
│   └── global-error.tsx # Глобальный Error Boundary
├── lib/
│   ├── db.ts          # Prisma клиент + DatabaseHelper
│   ├── cache.ts       # Кэш основной БД (globalThis)
│   ├── node-cache.ts  # Единый NodeCache (токены, Excel)
│   ├── security/      # Rate limiting, валидация, токены
│   └── workers/       # Worker Threads для Excel
├── components/        # React-компоненты (shadcn/ui)
└── middleware.ts      # Глобальный rate limiter
```

## 🔧 Основные скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (порт 3000) |
| `npm run build` | Production сборка |
| `npm run start` | Запуск production |
| `npm run lint` | Проверка кода ESLint |
| `npm run test` | Запуск тестов (vitest) |
| `npm run backup` | Создание бэкапа SQLite БД |
| `npm run db:push` | Синхронизация Prisma схемы с БД |
| `npm run db:migrate` | Создание миграции Prisma |

## 🔐 Переменные окружения

Создайте `.env.local` в корне проекта:

```env
# База данных (SQLite по умолчанию)
DATABASE_URL="file:./prisma/dev.db"

# Размер загружаемых файлов (MB)
MAX_FILE_SIZE_MB=100

# Разрешённые типы файлов
ALLOWED_FILE_TYPES=".xlsx,.xls,.csv"

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=60000

# Auto-login (только для разработки)
NEXT_PUBLIC_AUTO_LOGIN=Admin
NEXT_PUBLIC_AUTO_LOGIN_PASSWORD=your_password_here
```

## 👥 Производительность

Система рассчитана на **до 20 одновременных пользователей**:

- **Worker Pool**: до `n-ядер` воркеров для Excel-парсинга
- **NodeCache**: единый in-memory кэш (TTL 30 мин)
- **Rate Limiting**: 200 запросов/мин на IP (middleware) + отдельные лимиты для API
- **SQLite**: оптимизирована для конкурентного чтения (WAL mode)

## 📦 Зависимости

- **Next.js 14** — React-фреймворк
- **Prisma 6** — ORM (SQLite)
- **next-auth 4** — Аутентификация
- **xlsx** — Excel-парсинг
- **node-cache** — In-memory кэш
- **rate-limiter-flexible** — Rate limiting
- **shadcn/ui** — UI-компоненты
- **vitest** — Тестирование

## 🤝 Вклад в проект

1. Создайте бэкап: `npm run backup`
2. Внесите изменения
3. Запустите линтер: `npm run lint`
4. Запустите тесты: `npm run test`
5. Создайте PR

## 📄 Лицензия

Внутреннее использование. ООО "ВелесстройМонтаж"