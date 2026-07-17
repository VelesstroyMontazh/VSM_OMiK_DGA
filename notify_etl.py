#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
notify_etl.py — обёртка для ETL-скриптов с Telegram-уведомлением при ошибке.

Пример:
    python notify_etl.py "python etl_loader.py"
    python notify_etl.py "python clean_data.py"
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: установите requests: python -m pip install --user requests", file=sys.stderr)
    sys.exit(2)

PROJECT_ROOT = Path(__file__).resolve().parent
ERROR_LOG = PROJECT_ROOT / "telegram_error.log"
ENV_FILE = PROJECT_ROOT / ".env"


def load_env_file() -> None:
    """Простая загрузка .env без внешних зависимостей."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def tail(text: str, limit: int = 500) -> str:
    text = text or ""
    if len(text) <= limit:
        return text
    return text[-limit:]


def send_telegram(message: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = requests.post(
            url,
            json={"chat_id": chat_id, "text": message},
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as exc:
        ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
        with ERROR_LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"[telegram send failed] {exc}\n")


def main() -> int:
    load_env_file()

    if len(sys.argv) < 2:
        print('Usage: python notify_etl.py "python etl_loader.py"', file=sys.stderr)
        return 2

    command = sys.argv[1]
    script_name = command.split()[1] if len(command.split()) > 1 else command

    # Пробрасываем stdout/stderr в консоль (и в bat-лог через >>)
    result = subprocess.run(
        command,
        shell=True,
        text=True,
        capture_output=True,
        cwd=str(PROJECT_ROOT),
    )

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)

    if result.returncode != 0:
        combined = (result.stdout or "") + "\n" + (result.stderr or "")
        snippet = tail(combined.strip())
        message = (
            f"❌ ETL ошибка\n"
            f"Скрипт: {script_name}\n"
            f"Код: {result.returncode}\n"
            f"--- последние 500 символов ---\n"
            f"{snippet}"
        )
        send_telegram(message)

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
