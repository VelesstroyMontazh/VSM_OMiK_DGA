## Learned User Preferences

- Prefer complete, production-style implementations (dependencies, error handling, environment setup) when requesting a full script.
- Prefer English warehouse column names; return dates from APIs as `DD.MM.YYYY`.
- Include Telegram monitoring and file logging as standard practice for ETL scripts.

## Learned Workspace Facts

- Treat `upload/` as source-only input data; write generated databases and logs under `db/` instead.
- Load warehouse Excel from `upload/` subfolders via `python etl_loader.py` (or `run_etl.bat`); the UI Files tab is a separate Prisma/in-memory channel.
- Warehouse dashboard APIs use SQLite in `db/` (`project_data.db` / `vsm_database.db`) via better-sqlite3; auth and legacy employee APIs use Prisma at `db/custom.db` (`DATABASE_URL=file:../db/custom.db`).
- Extra Excel sources also live under `upload/Реестры по билетам`, `upload/Мара`, and `upload/Маври` (beyond the core daily/flights/HR folders).
- Local stack is Windows-only in user space (no Docker, no admin rights).
