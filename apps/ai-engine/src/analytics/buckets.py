from datetime import date

_GRANULARITIES = {"day", "week", "month"}


def bucket_key(d: date, granularity: str) -> str:
    if granularity == "week":
        iso = d.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    if granularity == "month":
        return f"{d.year:04d}-{d.month:02d}"
    return d.isoformat()


def sort_buckets(keys: list[str], granularity: str) -> list[str]:
    # Les clés jour/semaine/mois sont toutes lexicographiquement ordonnables
    # car zero-paddées (ISO date, YYYY-Www, YYYY-MM).
    return sorted(keys)
