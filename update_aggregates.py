#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
update_aggregates.py — пересборка витрин agg_* без полного ETL.

Запуск:
    python update_aggregates.py
"""

from __future__ import annotations

import sqlite3
import sys

from warehouse_marts import (
    clean_garbage_tab_numbers,
    resolve_db_path,
    update_aggregates,
)


def main() -> int:
    db_path = resolve_db_path()
    if not db_path.exists():
        print(f"ERROR: DB not found: {db_path}")
        return 1

    print(f"Rebuild aggregates | DB = {db_path}")
    conn = sqlite3.connect(str(db_path))
    try:
        cleaned = clean_garbage_tab_numbers(conn)
        print("Cleaned rows:", cleaned)
        result = update_aggregates(conn)
    finally:
        conn.close()

    print(f"agg_daily_worksite_stats: {result['agg_days']} day(s)")
    print(f"agg_top_worksites: {result['agg_top_rows']} row(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
