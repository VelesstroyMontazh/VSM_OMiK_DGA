#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
smoke_test.py — проверка warehouse и (опционально) HTTP API дашборда.

Примеры:
    python smoke_test.py
    python smoke_test.py --http http://localhost:3000
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
DB_PATH = PROJECT_ROOT / "vsm_database.db"
DATE_RE = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")

REQUIRED_TABLES = [
    "agg_daily_worksite_stats",
    "agg_top_worksites",
    "fact_daily_attendance",
    "fact_hr_events",
    "fact_kpi",
]

API_ENDPOINTS = [
    "/api/dashboard/overview",
    "/api/dashboard/trend",
    "/api/dashboard/hr-trend?period=month",
    "/api/dashboard/kpi",
    "/api/dashboard/kpi/worksites",
    "/api/dashboard/tickets?limit=1",
    "/api/dashboard/flights?limit=1",
    "/api/admin/status",
]


def ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def fail(msg: str) -> None:
    print(f"  [FAIL] {msg}")


def check_db() -> list[str]:
    errors: list[str] = []
    print("\n== SQLite warehouse ==")

    if not DB_PATH.exists():
        fail(f"DB not found: {DB_PATH}")
        return ["database missing"]

    conn = sqlite3.connect(str(DB_PATH))
    try:
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        for table in REQUIRED_TABLES:
            if table in tables:
                cnt = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                ok(f"{table}: {cnt:,} rows")
            else:
                fail(f"missing table: {table}")
                errors.append(f"missing table {table}")

        if "agg_daily_worksite_stats" in tables:
            row = conn.execute(
                """
                SELECT report_date, total_employees
                FROM agg_daily_worksite_stats
                ORDER BY report_date DESC
                LIMIT 1
                """
            ).fetchone()
            if row:
                ok(f"latest agg date: {row[0]} ({row[1]:,} employees)")
            else:
                fail("agg_daily_worksite_stats is empty")
                errors.append("empty aggregates")

        log_dir = PROJECT_ROOT / "db" / "logs"
        if log_dir.exists():
            ok(f"log dir exists: {log_dir}")
        else:
            fail(f"log dir missing: {log_dir}")
            errors.append("log dir missing")

        etl_bat = PROJECT_ROOT / "run_etl.bat"
        if etl_bat.exists():
            ok("run_etl.bat present")
        else:
            fail("run_etl.bat missing")
            errors.append("run_etl.bat missing")

    finally:
        conn.close()

    return errors


def check_http(base_url: str) -> list[str]:
    errors: list[str] = []
    print(f"\n== HTTP API ({base_url}) ==")

    for path in API_ENDPOINTS:
        url = f"{base_url.rstrip('/')}{path}"
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                if resp.status != 200:
                    fail(f"{path} -> HTTP {resp.status}")
                    errors.append(path)
                    continue
                data = json.loads(body)
                if "date" in data and data["date"] is not None:
                    if not DATE_RE.match(str(data["date"])):
                        fail(f"{path} date format: {data['date']}")
                        errors.append(f"{path} date format")
                        continue
                if "data" in data and isinstance(data["data"], list):
                    for item in data["data"][:3]:
                        if isinstance(item, dict) and "date" in item:
                            if item["date"] and not DATE_RE.match(str(item["date"])):
                                fail(f"{path} item date: {item['date']}")
                                errors.append(f"{path} item date")
                                break
                    else:
                        ok(f"{path} -> 200")
                        continue
                ok(f"{path} -> 200")
        except urllib.error.URLError as exc:
            fail(f"{path} unreachable: {exc.reason}")
            errors.append(path)
        except json.JSONDecodeError:
            fail(f"{path} invalid JSON")
            errors.append(path)

    # compare endpoint smoke (if aggregates exist)
    compare_url = (
        f"{base_url.rstrip('/')}/api/dashboard/compare"
        "?dateA=01.07.2026&dateB=15.07.2026"
    )
    try:
        with urllib.request.urlopen(compare_url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if resp.status == 200 and "dateA" in data and "dateB" in data:
                ok("compare endpoint -> 200")
            else:
                fail("compare endpoint unexpected response")
                errors.append("compare")
    except Exception as exc:
        fail(f"compare endpoint: {exc}")
        errors.append("compare")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="VSM dashboard smoke test")
    parser.add_argument(
        "--http",
        metavar="URL",
        help="also test HTTP API (e.g. http://localhost:3000)",
    )
    args = parser.parse_args()

    print("VSM smoke test")
    print(f"Project: {PROJECT_ROOT}")

    all_errors = check_db()
    if args.http:
        all_errors.extend(check_http(args.http))

    print("\n== Summary ==")
    if all_errors:
        print(f"FAILED ({len(all_errors)} issue(s))")
        return 1

    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
