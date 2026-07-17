## Learned User Preferences

- Prefer complete, production-style implementations when requesting a full script.

## Learned Workspace Facts

- Treat `upload/` as source-only input data; write generated databases and logs under `db/` instead.
- Load warehouse Excel from `upload/` subfolders via `python etl_loader.py` (or `run_etl.bat`); the UI Files tab is a separate Prisma/in-memory channel.
- Warehouse dashboard APIs use SQLite in `db/` (`project_data.db` / `vsm_database.db`); auth and legacy employee APIs use Prisma at `db/custom.db` (`DATABASE_URL=file:../db/custom.db`).
