#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
warehouse_marts.py — очистка мусорных tab_number и пересборка агрегатов (витрин).

Используется из:
  - clean_data.py / update_aggregates.py (CLI)
  - etl_loader.py (в конце пайплайна)
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent

# Табельный считается валидным, если не пустой, не «Прием» и содержит хотя бы одну цифру
# (формат ВМ-0010166 не начинается с цифры, поэтому [0-9]* не подходит).
TAB_FILTER_SQL = """
    "tab_number" IS NOT NULL
    AND TRIM("tab_number") != ''
    AND LOWER(TRIM("tab_number")) NOT IN ('прием', 'перевод', 'увольнение', 'hire', 'transfer', 'terminate')
    AND "tab_number" GLOB '*[0-9]*'
"""

GARBAGE_WHERE_SQL = """
    "tab_number" IS NULL
    OR TRIM("tab_number") = ''
    OR LOWER(TRIM("tab_number")) IN ('прием', 'перевод', 'увольнение', 'hire', 'transfer', 'terminate')
    OR "tab_number" NOT GLOB '*[0-9]*'
"""


def resolve_db_path() -> Path:
    env = os.environ.get("DATABASE_PATH")
    if env:
        return Path(env)
    for candidate in (
        PROJECT_ROOT / "vsm_database.db",
        PROJECT_ROOT / "db" / "project_data.db",
    ):
        if candidate.exists():
            return candidate
    return PROJECT_ROOT / "vsm_database.db"


def clean_garbage_tab_numbers(conn: sqlite3.Connection) -> dict[str, int]:
    """
    Удалить строки с мусорным tab_number из фактов.
    Возвращает {table_name: deleted_count}.
    """
    fact_tables = ["fact_daily_attendance", "fact_kpi", "fact_flights"]
    stats: dict[str, int] = {}

    for table in fact_tables:
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
        if not exists:
            stats[table] = 0
            continue

        cols = [r[1] for r in conn.execute(f'PRAGMA table_info("{table}")')]
        if "tab_number" not in cols:
            stats[table] = 0
            continue

        cur = conn.execute(
            f'DELETE FROM "{table}" WHERE {GARBAGE_WHERE_SQL}'
        )
        stats[table] = cur.rowcount

    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_fact_daily_tab
            ON fact_daily_attendance(tab_number);
        CREATE INDEX IF NOT EXISTS idx_fact_daily_date
            ON fact_daily_attendance(report_date);
        CREATE INDEX IF NOT EXISTS idx_fact_daily_date_tab
            ON fact_daily_attendance(report_date, tab_number);
        CREATE INDEX IF NOT EXISTS idx_fact_daily_worksite_date
            ON fact_daily_attendance(worksite_name, report_date);
        """
    )
    conn.commit()
    return stats


def update_aggregates(conn: sqlite3.Connection) -> dict[str, int]:
    """
    Пересобрать витрины agg_daily_worksite_stats и agg_top_worksites
    из очищенного fact_daily_attendance.
    """
    conn.executescript(
        """
        DROP TABLE IF EXISTS agg_daily_worksite_stats;
        DROP TABLE IF EXISTS agg_top_worksites;

        CREATE TABLE agg_daily_worksite_stats (
            report_date TEXT NOT NULL PRIMARY KEY,
            total_employees INTEGER NOT NULL,
            worksite_stats TEXT NOT NULL
        );

        CREATE TABLE agg_top_worksites (
            report_date TEXT NOT NULL,
            worksite_name TEXT NOT NULL,
            employee_count INTEGER NOT NULL,
            rank INTEGER NOT NULL,
            PRIMARY KEY (report_date, rank)
        );
        """
    )

    dates = conn.execute(
        f"""
        SELECT DISTINCT "report_date"
        FROM "fact_daily_attendance"
        WHERE "report_date" IS NOT NULL AND {TAB_FILTER_SQL}
        ORDER BY "report_date"
        """
    ).fetchall()

    agg_days = 0
    agg_top_rows = 0

    for (report_date,) in dates:
        total = conn.execute(
            f"""
            SELECT COUNT(DISTINCT "tab_number")
            FROM "fact_daily_attendance"
            WHERE "report_date" = ? AND {TAB_FILTER_SQL}
            """,
            (report_date,),
        ).fetchone()[0]

        rows = conn.execute(
            f"""
            SELECT COALESCE("worksite_name", '(без площадки)') AS ws,
                   COUNT(DISTINCT "tab_number") AS cnt
            FROM "fact_daily_attendance"
            WHERE "report_date" = ? AND {TAB_FILTER_SQL}
            GROUP BY "worksite_name"
            ORDER BY cnt DESC
            """,
            (report_date,),
        ).fetchall()

        worksite_stats = json.dumps(
            {ws: cnt for ws, cnt in rows},
            ensure_ascii=False,
        )

        conn.execute(
            """
            INSERT INTO agg_daily_worksite_stats
                (report_date, total_employees, worksite_stats)
            VALUES (?, ?, ?)
            """,
            (report_date, total, worksite_stats),
        )
        agg_days += 1

        for rank, (ws, cnt) in enumerate(rows[:10], start=1):
            conn.execute(
                """
                INSERT INTO agg_top_worksites
                    (report_date, worksite_name, employee_count, rank)
                VALUES (?, ?, ?, ?)
                """,
                (report_date, ws, cnt, rank),
            )
            agg_top_rows += 1

    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_agg_top_date
            ON agg_top_worksites(report_date);
        CREATE INDEX IF NOT EXISTS idx_agg_daily_date
            ON agg_daily_worksite_stats(report_date);
        """
    )
    conn.commit()
    return {"agg_days": agg_days, "agg_top_rows": agg_top_rows}
