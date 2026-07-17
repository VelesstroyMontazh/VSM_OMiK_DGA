#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
dq_check.py — проверка качества данных warehouse SQLite.

Запуск из корня проекта:
    python dq_check.py

Путь БД: DATABASE_PATH или vsm_database.db / db/project_data.db
Колонки — английские имена из ETL (tab_number, full_name, employee_uid, report_date).
"""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import date
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent


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


def has_column(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
    return any(r[1] == column for r in rows)


def section(title: str) -> None:
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def main() -> int:
    db_path = resolve_db_path()
    if not db_path.exists():
        print(f"ERROR: DB not found: {db_path}")
        return 1

    print(f"DQ check | DB = {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # --- 1. Дубликаты табельных в dim_employee ---
    section("1. Дубликаты табельных номеров (dim_employee)")
    if has_column(conn, "dim_employee", "tab_number"):
        dups = conn.execute(
            """
            SELECT "tab_number", COUNT(*) AS cnt
            FROM "dim_employee"
            WHERE "tab_number" IS NOT NULL AND TRIM("tab_number") != ''
            GROUP BY "tab_number"
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 50
            """
        ).fetchall()
        if not dups:
            print("OK: дубликатов нет")
        else:
            print(f"Найдено {len(dups)} табельных с дублями (топ-50):")
            for row in dups:
                print(f"  {row['tab_number']}: {row['cnt']}")
    else:
        print("SKIP: колонка tab_number отсутствует")

    # --- 2. Пустые ФИО ---
    section("2. Пустые ФИО (dim_employee)")
    empty_fio = conn.execute(
        """
        SELECT COUNT(*) AS c FROM "dim_employee"
        WHERE "full_name" IS NULL OR TRIM("full_name") = ''
        """
    ).fetchone()["c"]
    total_emp = conn.execute('SELECT COUNT(*) AS c FROM "dim_employee"').fetchone()["c"]
    pct = (100.0 * empty_fio / total_emp) if total_emp else 0.0
    print(f"Пустых ФИО: {empty_fio} из {total_emp} ({pct:.2f}%)")

    # --- 3. Orphan employee_uid в fact_daily_attendance ---
    section("3. Orphan records (fact_daily_attendance → dim_employee)")
    total_fact = conn.execute(
        'SELECT COUNT(*) AS c FROM "fact_daily_attendance"'
    ).fetchone()["c"]
    print(f"Всего строк fact_daily_attendance: {total_fact}")

    if has_column(conn, "fact_daily_attendance", "employee_uid") and has_column(
        conn, "dim_employee", "employee_uid"
    ):
        orphans = conn.execute(
            """
            SELECT COUNT(*) AS c
            FROM "fact_daily_attendance" f
            WHERE f."employee_uid" IS NULL
               OR f."employee_uid" = ''
               OR NOT EXISTS (
                    SELECT 1 FROM "dim_employee" d
                    WHERE d."employee_uid" = f."employee_uid"
               )
            """
        ).fetchone()["c"]
        pct_o = (100.0 * orphans / total_fact) if total_fact else 0.0
        print(f"Без связи / NULL employee_uid: {orphans} ({pct_o:.2f}%)")

        date_col = (
            "report_date"
            if has_column(conn, "fact_daily_attendance", "report_date")
            else "source_file"
        )
        samples = conn.execute(
            f"""
            SELECT f."tab_number" AS tab, f."{date_col}" AS dt, f."full_name" AS fio
            FROM "fact_daily_attendance" f
            WHERE f."employee_uid" IS NULL
               OR f."employee_uid" = ''
               OR NOT EXISTS (
                    SELECT 1 FROM "dim_employee" d
                    WHERE d."employee_uid" = f."employee_uid"
               )
            LIMIT 5
            """
        ).fetchall()
        if samples:
            print("Примеры (до 5):")
            for s in samples:
                print(f"  tab={s['tab']} | date/file={s['dt']} | fio={s['fio']}")
    else:
        print("SKIP: employee_uid ещё нет — перезапустите etl_loader.py")

    # --- 4. Даты ---
    section("4. Аномальные даты (fact_daily_attendance.report_date)")
    if has_column(conn, "fact_daily_attendance", "report_date"):
        today = date.today().isoformat()
        future = conn.execute(
            """
            SELECT COUNT(*) AS c FROM "fact_daily_attendance"
            WHERE "report_date" IS NOT NULL AND "report_date" > ?
            """,
            (today,),
        ).fetchone()["c"]
        old = conn.execute(
            """
            SELECT COUNT(*) AS c FROM "fact_daily_attendance"
            WHERE "report_date" IS NOT NULL AND "report_date" < '2000-01-01'
            """
        ).fetchone()["c"]
        print(f"Дат в будущем (>{today}): {future}")
        print(f"Дат раньше 2000-01-01: {old}")
        minmax = conn.execute(
            """
            SELECT MIN("report_date") AS mn, MAX("report_date") AS mx
            FROM "fact_daily_attendance"
            WHERE "report_date" IS NOT NULL
            """
        ).fetchone()
        print(f"Диапазон report_date: {minmax['mn']} … {minmax['mx']}")
    else:
        print("SKIP: report_date отсутствует — перезапустите etl_loader.py")

    section("DONE")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
