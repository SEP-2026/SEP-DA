from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

VN_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def vn_now() -> datetime:
    return datetime.now(VN_TIMEZONE).replace(tzinfo=None)


def vn_today():
    return vn_now().date()


def ensure_vn_local_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(VN_TIMEZONE).replace(tzinfo=None)


def isoformat_vn(value: datetime | None, fallback_now: bool = False) -> str | None:
    if value is None:
        return vn_now().isoformat() if fallback_now else None
    return ensure_vn_local_naive(value).isoformat()
