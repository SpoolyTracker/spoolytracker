from collections import defaultdict
from datetime import date

from src.analytics.buckets import bucket_key, sort_buckets
from src.analytics.models import (
    AnalyticsOverview,
    BreakdownSlice,
    ConsumptionAnalytics,
    CostAnalytics,
    DepletionItem,
    DormantItem,
    PeriodDelta,
    SeriesPoint,
    StockAnalytics,
)
from src.domain.snapshots import (
    AppConsumptionSnapshot,
    AppFilamentSnapshot,
    AppOrganizationSettings,
)
from src.forecasting.depletion import ForecastingService
from src.forecasting.mock_history import TODAY


class AnalyticsService:
    def __init__(
        self,
        filaments: list[AppFilamentSnapshot],
        consumptions: list[AppConsumptionSnapshot],
        settings: AppOrganizationSettings,
        today: date = TODAY,
        is_pro: bool = False,
    ) -> None:
        self.filaments = filaments
        self.consumptions = consumptions
        self.settings = settings
        self.today = today
        self.is_pro = is_pro
        self._by_id = {f.id: f for f in filaments}
        self.source = "mock_fallback"

    def _price_per_gram(self, filament: AppFilamentSnapshot) -> float:
        if not filament.price or filament.weight_initial_g <= 0:
            return 0.0
        return filament.price / filament.weight_initial_g

    def consumption(self, granularity: str = "day") -> ConsumptionAnalytics:
        actual: dict[str, float] = defaultdict(float)
        planned: dict[str, float] = defaultdict(float)
        by_material: dict[str, float] = defaultdict(float)
        by_brand: dict[str, float] = defaultdict(float)
        material_hex: dict[str, str | None] = {}

        for log in self.consumptions:
            key = bucket_key(log.occurred_on, granularity)
            if log.is_planned:
                planned[key] += log.amount_g
                continue
            actual[key] += log.amount_g
            filament = self._by_id.get(log.filament_id)
            if filament:
                by_material[filament.material_name] += log.amount_g
                by_brand[filament.brand_name] += log.amount_g
                material_hex.setdefault(filament.material_name, filament.color_hex)

        buckets = sort_buckets(list(set(actual) | set(planned)), granularity)
        series = [
            SeriesPoint(bucket=b, value=round(actual.get(b, 0), 2), planned=round(planned.get(b, 0), 2))
            for b in buckets
        ]
        return ConsumptionAnalytics(
            series=series,
            by_material=[
                BreakdownSlice(key=m, label=m, value=round(v, 2), color_hex=material_hex.get(m))
                for m, v in sorted(by_material.items(), key=lambda kv: kv[1], reverse=True)
            ],
            by_brand=[
                BreakdownSlice(key=b, label=b, value=round(v, 2))
                for b, v in sorted(by_brand.items(), key=lambda kv: kv[1], reverse=True)
            ],
            delta=self._delta([log for log in self.consumptions if not log.is_planned], lambda log: log.amount_g),
        )

    def cost(self, granularity: str = "day") -> CostAnalytics:
        actual: dict[str, float] = defaultdict(float)
        planned: dict[str, float] = defaultdict(float)
        by_material: dict[str, float] = defaultdict(float)
        total = 0.0

        for log in self.consumptions:
            filament = self._by_id.get(log.filament_id)
            if not filament:
                continue
            cost = log.amount_g * self._price_per_gram(filament)
            key = bucket_key(log.occurred_on, granularity)
            if log.is_planned:
                planned[key] += cost
                continue
            actual[key] += cost
            by_material[filament.material_name] += cost
            total += cost

        buckets = sort_buckets(list(set(actual) | set(planned)), granularity)
        series = [
            SeriesPoint(bucket=b, value=round(actual.get(b, 0), 2), planned=round(planned.get(b, 0), 2))
            for b in buckets
        ]
        delta = self._delta(
            [l for l in self.consumptions if not l.is_planned and self._by_id.get(l.filament_id)],
            lambda l: l.amount_g * self._price_per_gram(self._by_id[l.filament_id]),
        )
        suggested = None
        if self.is_pro:
            # Budget conseillé = dépense moyenne mensuelle projetée (delta.current sur 30j).
            suggested = round(max(delta.current, 0), 2)
        return CostAnalytics(
            series=series,
            by_material=[
                BreakdownSlice(key=m, label=m, value=round(v, 2))
                for m, v in sorted(by_material.items(), key=lambda kv: kv[1], reverse=True)
            ],
            total_cost=round(total, 2),
            delta=delta,
            suggested_budget=suggested,
        )

    def _delta(self, logs, value_fn, window_days: int = 30) -> PeriodDelta:
        from datetime import timedelta

        cur_start = self.today - timedelta(days=window_days)
        prev_start = self.today - timedelta(days=2 * window_days)
        current = sum(value_fn(l) for l in logs if cur_start < l.occurred_on <= self.today)
        previous = sum(value_fn(l) for l in logs if prev_start < l.occurred_on <= cur_start)
        if previous > 0:
            pct = (current - previous) / previous * 100
        else:
            pct = 100.0 if current > 0 else 0.0
        return PeriodDelta(current=round(current, 2), previous=round(previous, 2), pct=round(pct, 1))

    def _refresh_index(self) -> None:
        self._by_id = {f.id: f for f in self.filaments}

    def _last_used(self) -> dict[str, date]:
        last: dict[str, date] = {}
        for log in self.consumptions:
            if log.is_planned:
                continue
            cur = last.get(log.filament_id)
            if cur is None or log.occurred_on > cur:
                last[log.filament_id] = log.occurred_on
        return last

    def _runway_days(self) -> int | None:
        from datetime import timedelta

        cutoff = self.today - timedelta(days=30)
        used_30d = sum(
            l.amount_g for l in self.consumptions
            if not l.is_planned and cutoff < l.occurred_on <= self.today
        )
        available = sum(f.forecastable_remaining_g for f in self.filaments)
        avg_daily = used_30d / 30
        if avg_daily <= 0:
            return None
        return round(available / avg_daily)

    def stock(self, dormant_after_days: int = 60) -> StockAnalytics:
        from collections import defaultdict

        last_used = self._last_used()
        total_value = 0.0
        available_value = 0.0
        dormant: list[DormantItem] = []
        inv_material: dict[str, float] = defaultdict(float)
        inv_brand: dict[str, float] = defaultdict(float)
        material_hex: dict[str, str | None] = {}

        for f in self.filaments:
            ppg = self._price_per_gram(f)
            value = f.weight_remaining_g * ppg
            total_value += value
            available_value += f.forecastable_remaining_g * ppg
            if f.weight_remaining_g <= 0:
                continue
            inv_material[f.material_name] += f.weight_remaining_g
            inv_brand[f.brand_name] += f.weight_remaining_g
            material_hex.setdefault(f.material_name, f.color_hex)
            used_on = last_used.get(f.id)
            days_idle = (self.today - used_on).days if used_on else None
            if used_on is None or (days_idle is not None and days_idle >= dormant_after_days):
                dormant.append(
                    DormantItem(
                        item_id=f.id, label=f.name, remaining_g=round(f.weight_remaining_g, 2),
                        value=round(value, 2), last_used_on=used_on, days_idle=days_idle,
                        color_hex=f.color_hex,
                    )
                )

        depletion: list[DepletionItem] = []
        if self.is_pro:
            depletion = self._depletion()

        return StockAnalytics(
            runway_days=self._runway_days(),
            total_value=round(total_value, 2),
            available_value=round(available_value, 2),
            by_material=[
                BreakdownSlice(key=m, label=m, value=round(v, 2), color_hex=material_hex.get(m))
                for m, v in sorted(inv_material.items(), key=lambda kv: kv[1], reverse=True)
            ],
            by_brand=[
                BreakdownSlice(key=b, label=b, value=round(v, 2))
                for b, v in sorted(inv_brand.items(), key=lambda kv: kv[1], reverse=True)
            ],
            dormant=sorted(dormant, key=lambda d: d.value, reverse=True),
            depletion=depletion,
        )

    def _depletion(self) -> list[DepletionItem]:
        stock_items = [f.to_stock_item() for f in self.filaments]
        history = [
            c.to_consumption_sample() for c in self.consumptions
            if not c.is_planned and c.print_status != "FAILED"
        ]
        service = ForecastingService(stock_items=stock_items, history=history, projects=[], today=self.today)
        items: list[DepletionItem] = []
        for forecast in service.forecast_all():
            if forecast.days_until_depletion is None:
                continue
            items.append(
                DepletionItem(
                    item_id=forecast.item_id, label=forecast.item_name,
                    days_left=forecast.days_until_depletion,
                    estimated_date=forecast.predicted_depletion_date,
                    color_hex=forecast.color_hex, risk_level=str(forecast.risk_level),
                )
            )
        return sorted(items, key=lambda i: i.days_left if i.days_left is not None else 1e9)

    def overview(self, granularity: str = "day") -> AnalyticsOverview:
        return AnalyticsOverview(
            plan="pro" if self.is_pro else "free",
            source=self.source,
            granularity=granularity,
            generated_on=self.today,
            consumption=self.consumption(granularity),
            cost=self.cost(granularity),
            stock=self.stock(),
        )

    @classmethod
    def from_snapshot(cls, snapshot, is_pro: bool, today: date = TODAY) -> "AnalyticsService":
        service = cls(
            filaments=snapshot.filaments,
            consumptions=snapshot.consumptions,
            settings=snapshot.settings,
            today=today,
            is_pro=is_pro,
        )
        service.source = snapshot.source
        return service
