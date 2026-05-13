"""Telegram notification helper.

Used to surface edge cases (e.g. an unknown airport IATA that neither
airports.json nor ourairports.csv can resolve) without crashing the
pipeline. If TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is unset, this
silently no-ops so the script keeps working in local/dev environments.
"""

import os
import requests


def telegram_notify(message: str) -> bool:
    """Send a message via Telegram bot. Returns True on success."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print(f"[telegram-skip] {message}")
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message, "disable_web_page_preview": True},
            timeout=10,
        )
        if r.status_code != 200:
            print(f"[telegram-fail] status={r.status_code} body={r.text[:200]}")
            return False
        return True
    except Exception as e:
        print(f"[telegram-error] {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    import sys
    msg = " ".join(sys.argv[1:]) or "Test from notify.py"
    print("sending:", msg)
    print("sent:", telegram_notify(msg))
