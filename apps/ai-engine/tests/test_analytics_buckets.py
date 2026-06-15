from datetime import date

from src.analytics.buckets import bucket_key, sort_buckets


def test_bucket_key_day_week_month() -> None:
    d = date(2026, 3, 18)
    assert bucket_key(d, "day") == "2026-03-18"
    assert bucket_key(d, "week") == "2026-W12"
    assert bucket_key(d, "month") == "2026-03"


def test_unknown_granularity_falls_back_to_day() -> None:
    assert bucket_key(date(2026, 3, 18), "decade") == "2026-03-18"


def test_sort_buckets_orders_chronologically() -> None:
    keys = ["2026-W12", "2026-W02", "2026-W09"]
    assert sort_buckets(keys, "week") == ["2026-W02", "2026-W09", "2026-W12"]
