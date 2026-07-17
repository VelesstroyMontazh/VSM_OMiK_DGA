#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
clean_data.py — удаление мусорных tab_number и создание индексов.

Запуск из корня проекта:
    python clean_data.py
"""

from __future__ import annotations

import sqlite3
import sys

from warehouse_marts import clean_garbage_tab_numbers, resolve_db_path


def main() -> int:
    db_path = resolve_db_path()
    if not db_path.exists():
        print(f"ERROR: DB not found: {db_path}")
        return 1

    print(f"Cleaning garbage tab_number | DB = {db_path}")
    conn = sqlite3.connect(str(db_path))
    try:
        stats = clean_garbage_tab_numbers(conn)
    finally:
        conn.close()

    print("\nУдалено строк:")
    total = 0
    for table, n in stats.items():
        print(f"  {table}: {n}")
        total += n
    print(f"  ИТОГО: {total}")
    print("\nИндексы idx_fact_daily_tab / idx_fact_daily_date созданы.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
